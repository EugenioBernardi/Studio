## =====================================================================
## 04_tables.R  --  demographic / clinical table by SAA status
##                  with p value, mean (risk) difference and SMD
## =====================================================================

need(c("gtsummary", "gt", "dplyr", "tibble", "purrr"))
say_rule("STEP 6  Demographic and clinical tables (gtsummary)")

## custom add_stat functions --------------------------------------------
fn_md <- function(data, variable, by, ...) {
  md_value(data[[variable]], data[[by]])
}
fn_smd <- function(data, variable, by, ...) {
  v <- smd_value(data[[variable]], data[[by]])
  if (is.na(v)) return(NA_character_)
  sprintf("%.2f", v)
}

build_table1 <- function(dat, cohort_label) {
  vars <- intersect(TABLE1_VARS, names(dat))
  ## drop variables that are entirely missing or constant
  usable <- vars[vapply(vars, function(v) {
    x <- dat[[v]]
    sum(!is.na(x)) >= 3 && length(unique(x[!is.na(x)])) > 1
  }, logical(1))]
  skipped <- setdiff(vars, usable)
  if (length(skipped))
    say("[", cohort_label, "] variables omitted (all missing / constant / n<3): ",
        paste(skipped, collapse = ", "))

  labs <- TABLE1_LABELS[usable]
  labs <- labs[!is.na(labs)]

  tb <- dat %>%
    select(all_of(usable), saa_group) %>%
    gtsummary::tbl_summary(
      by = saa_group,
      missing = "ifany",
      missing_text = "Missing",
      label = as.list(labs),
      statistic = list(
        gtsummary::all_continuous()  ~ "{mean} ({sd}) / {median} [{p25}, {p75}]",
        gtsummary::all_categorical() ~ "{n} ({p}%)"),
      digits = list(gtsummary::all_continuous() ~ 1)
    ) %>%
    gtsummary::add_n() %>%
    gtsummary::add_p(
      test = list(gtsummary::all_continuous()  ~ "wilcox.test",
                  gtsummary::all_categorical() ~ "fisher.test"),
      pvalue_fun = function(x) gtsummary::style_pvalue(x, digits = 3)
    ) %>%
    gtsummary::add_stat(fns = gtsummary::everything() ~ fn_md) %>%
    gtsummary::modify_header(add_stat_1 = "**Difference (95% CI)**") %>%
    gtsummary::add_stat(fns = gtsummary::everything() ~ fn_smd) %>%
    gtsummary::modify_header(add_stat_2 = "**SMD**") %>%
    gtsummary::add_q(method = "BH") %>%
    gtsummary::bold_labels() %>%
    gtsummary::modify_spanning_header(
      gtsummary::all_stat_cols() ~ paste0("**", cohort_label, " - CSF alpha-syn SAA**")) %>%
    gtsummary::modify_caption(paste0(
      "**Table 1. ", cohort_label,
      ": demographic, cognitive, motor and biomarker profile by SAA status.** ",
      "Continuous variables: mean (SD) / median [IQR]; Wilcoxon rank-sum test. ",
      "Categorical: n (%); Fisher exact test. ",
      "Difference = Positive minus Negative (mean difference for continuous, ",
      "risk difference for binary). SMD = standardized mean difference. ",
      "q = Benjamini-Hochberg adjusted p."))
  tb
}

## Older/newer gtsummary versions differ in add_stat/add_q support; fall back
## to a plain table plus a separate effect-size CSV if the enriched call fails.
safe_table1 <- function(dat, lab) {
  out <- try(build_table1(dat, lab), silent = TRUE)
  if (!inherits(out, "try-error")) return(out)
  say("!! enriched gtsummary table failed for ", lab, " (",
      conditionMessage(attr(out, "condition")),
      ") - falling back to a basic table; effect sizes are still in the CSV")
  vars <- intersect(TABLE1_VARS, names(dat))
  dat %>% select(all_of(vars), saa_group) %>%
    gtsummary::tbl_summary(by = saa_group, missing = "ifany") %>%
    gtsummary::add_n() %>% gtsummary::add_p()
}

## effect sizes computed independently of gtsummary (always produced)
effect_table <- function(dat, lab) {
  vars <- intersect(TABLE1_VARS, names(dat))
  purrr::map_dfr(vars, function(v) {
    x <- dat[[v]]; g <- dat$saa_group
    if (sum(!is.na(x)) < 3) return(NULL)
    p <- try(if (is.numeric(x)) stats::wilcox.test(x ~ g)$p.value
             else stats::fisher.test(table(x, g), simulate.p.value = TRUE)$p.value,
             silent = TRUE)
    tibble::tibble(
      cohort = lab, variable = v,
      label = unname(ifelse(is.na(TABLE1_LABELS[v]), v, TABLE1_LABELS[v])),
      n_negative = sum(!is.na(x) & g == "Negative"),
      n_positive = sum(!is.na(x) & g == "Positive"),
      difference_pos_minus_neg = md_value(x, g),
      smd = round(smd_value(x, g), 3),
      p_value = if (inherits(p, "try-error")) NA_real_ else as.numeric(p))
  }) %>% mutate(q_BH = p.adjust(p_value, "BH"))
}

tbl_saa2 <- safe_table1(coh_saa2, "SAA2 (own site)")
tbl_both <- safe_table1(coh_both, "SAA1 + SAA2")

eff_all <- bind_rows(effect_table(coh_saa2, "SAA2 (own site)"),
                     effect_table(coh_both, "SAA1 + SAA2"))

## side-by-side merge of the two cohorts
tbl_merged <- try(
  gtsummary::tbl_merge(list(tbl_saa2, tbl_both),
                       tab_spanner = c("**SAA2 (own site)**", "**SAA1 + SAA2**")),
  silent = TRUE)

## ---- save -------------------------------------------------------------
save_tbl <- function(tb, stem) {
  if (inherits(tb, "try-error")) return(invisible(NULL))
  gt_obj <- gtsummary::as_gt(tb)
  gt::gtsave(gt_obj, file.path(RES_DIR, paste0(stem, ".html")))
  try(gt::gtsave(gt_obj, file.path(RES_DIR, paste0(stem, ".docx"))), silent = TRUE)
  readr::write_csv(gtsummary::as_tibble(tb, col_labels = TRUE),
                   file.path(RES_DIR, paste0(stem, ".csv")))
}
need(c("readr"))
save_tbl(tbl_saa2,   "Table1_SAA2_own_site")
save_tbl(tbl_both,   "Table1_SAA1_plus_SAA2")
save_tbl(tbl_merged, "Table1_both_cohorts_side_by_side")
readr::write_csv(eff_all, file.path(RES_DIR, "Table1_effect_sizes_p_MD_SMD.csv"))

say("Tables written to ", RES_DIR)
