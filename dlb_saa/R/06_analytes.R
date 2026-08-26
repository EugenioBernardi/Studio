## =====================================================================
## 06_analytes.R  --  hypothesis-generating screen of CSF / plasma /
##                    serum analytes: SAA positive vs SAA negative
## =====================================================================

need(c("dplyr", "tibble", "readr", "purrr", "ggplot2"))
say_rule("STEP 8  Screening candidate analytes (SAA+ vs SAA-)")

## candidate columns -----------------------------------------------------
cand <- grep(paste0("^(", paste(ANALYTE_PREFIX, collapse = "|"), ")"),
             names(d), value = TRUE)
cand <- cand[!grepl(ANALYTE_EXCLUDE_PATTERN, cand)]
## strip join suffixes when checking, keep real names
cand <- unique(cand)
say("Columns matching an analyte prefix: ", length(cand))

## keep those that behave numerically ------------------------------------
numeric_ok <- vapply(cand, function(cc) {
  raw <- d[[cc]]
  if (all(is.na(raw))) return(FALSE)
  v <- num_safe(raw)
  ## at least 80% of the non-missing entries must parse as numbers
  mean(!is.na(v[!is.na(raw)])) >= 0.8 &&
    sum(!is.na(v)) >= 2 * ANALYTE_MIN_N &&
    length(unique(v[!is.na(v)])) > 2
}, logical(1))
analytes <- cand[numeric_ok]
say("Analytes with usable numeric data: ", length(analytes))
if (!length(analytes)) say("Nothing to screen - check ANALYTE_PREFIX / the merge.")

## testing ---------------------------------------------------------------
## Wilcoxon rank-sum (robust to the skew typical of these assays) plus a
## rank-biserial effect size and Hedges' g on log-transformed values.
screen_one <- function(cc, dat, cohort_label) {
  v <- num_safe(dat[[cc]]); g <- dat$saa_group
  ok <- !is.na(v) & !is.na(g)
  v <- v[ok]; g <- droplevels(g[ok])
  if (nlevels(g) != 2) return(NULL)
  n1 <- sum(g == "Positive"); n0 <- sum(g == "Negative")
  if (n1 < ANALYTE_MIN_N || n0 < ANALYTE_MIN_N) return(NULL)
  a <- v[g == "Positive"]; b <- v[g == "Negative"]
  w <- suppressWarnings(stats::wilcox.test(a, b, exact = FALSE))
  ## rank-biserial correlation from W
  U <- unname(w$statistic)
  rb <- 2 * U / (n1 * n0) - 1
  ## Hedges' g on log scale when all values are positive
  lg <- NA_real_
  if (all(v > 0)) {
    la <- log(a); lb <- log(b)
    sp <- sqrt(((n1 - 1) * var(la) + (n0 - 1) * var(lb)) / (n1 + n0 - 2))
    if (is.finite(sp) && sp > 0) {
      dcoh <- (mean(la) - mean(lb)) / sp
      lg <- dcoh * (1 - 3 / (4 * (n1 + n0) - 9))
    }
  }
  ## AUC of the analyte for SAA status
  auc <- U / (n1 * n0)
  tibble::tibble(
    cohort = cohort_label, analyte = cc,
    matrix = sub("_.*", "", cc),
    n_positive = n1, n_negative = n0,
    median_positive = signif(median(a), 4), iqr_positive = signif(IQR(a), 4),
    median_negative = signif(median(b), 4), iqr_negative = signif(IQR(b), 4),
    fold_change_pos_vs_neg = if (median(b) != 0) signif(median(a) / median(b), 3) else NA_real_,
    rank_biserial_r = round(rb, 3),
    hedges_g_log = round(lg, 3),
    auc = round(max(auc, 1 - auc), 3),
    auc_direction = ifelse(auc >= 0.5, "higher in SAA+", "higher in SAA-"),
    p_value = w$p.value)
}

run_screen <- function(dat, lab) {
  res <- purrr::map_dfr(analytes, screen_one, dat = dat, cohort_label = lab)
  if (!nrow(res)) return(res)
  res %>%
    mutate(q_BH = p.adjust(p_value, "BH"),
           p_bonferroni = p.adjust(p_value, "bonferroni"),
           n_tests = dplyr::n()) %>%
    arrange(p_value) %>%
    mutate(p_value = signif(p_value, 4), q_BH = signif(q_BH, 4),
           p_bonferroni = signif(p_bonferroni, 4))
}

screen_saa2 <- run_screen(coh_saa2, "SAA2 (own site)")
screen_both <- run_screen(coh_both, "SAA1 + SAA2")
screen_all  <- bind_rows(screen_saa2, screen_both)

readr::write_csv(screen_all, file.path(RES_DIR, "Analyte_screen_SAApos_vs_SAAneg.csv"))

if (nrow(screen_both)) {
  hits <- screen_both %>% filter(q_BH < ANALYTE_FDR)
  say("Analytes tested (SAA1+SAA2): ", nrow(screen_both),
      " ; significant at FDR ", ANALYTE_FDR, ": ", nrow(hits))
  say("\nTop 20 candidates (SAA1+SAA2 cohort, ranked by p):")
  top <- screen_both %>% slice_head(n = 20) %>%
    select(analyte, n_positive, n_negative, median_positive, median_negative,
           fold_change_pos_vs_neg, hedges_g_log, auc, auc_direction, p_value, q_BH)
  print(as.data.frame(top), row.names = FALSE)
  readr::write_csv(top, file.path(RES_DIR, "Analyte_screen_top20.csv"))

  ## replication check: candidates that point the same way in both cohorts
  repl <- inner_join(
    screen_saa2 %>% select(analyte, p_saa2 = p_value, g_saa2 = hedges_g_log,
                           r_saa2 = rank_biserial_r, n_pos_saa2 = n_positive),
    screen_both %>% select(analyte, p_both = p_value, g_both = hedges_g_log,
                           r_both = rank_biserial_r, q_both = q_BH),
    by = "analyte") %>%
    mutate(same_direction = sign(r_saa2) == sign(r_both)) %>%
    filter(p_saa2 < 0.05, p_both < 0.05, same_direction) %>%
    arrange(p_both)
  readr::write_csv(repl, file.path(RES_DIR, "Analyte_screen_consistent_both_cohorts.csv"))
  say("Analytes nominally significant in BOTH cohorts and in the same direction: ",
      nrow(repl))

  ## volcano-style plot
  vp <- screen_both %>% filter(!is.na(hedges_g_log), !is.na(p_value))
  if (nrow(vp) >= 5) {
    vp$significant <- vp$q_BH < ANALYTE_FDR
    g <- ggplot2::ggplot(vp, ggplot2::aes(hedges_g_log, -log10(p_value),
                                          colour = significant)) +
      ggplot2::geom_point(alpha = .8) +
      ggplot2::geom_hline(yintercept = -log10(0.05), linetype = 2) +
      ggplot2::geom_vline(xintercept = 0, linetype = 3) +
      ggplot2::labs(x = "Hedges' g (log scale), SAA+ vs SAA-",
                    y = expression(-log[10](p)),
                    colour = paste0("FDR < ", ANALYTE_FDR),
                    title = "Analyte screen: SAA positive vs SAA negative",
                    subtitle = "Exploratory / hypothesis-generating") +
      ggplot2::theme_minimal(base_size = 12)
    if (requireNamespace("ggrepel", quietly = TRUE))
      g <- g + ggrepel::geom_text_repel(
        data = utils::head(vp[order(vp$p_value), ], 12),
        ggplot2::aes(label = analyte), size = 2.6, max.overlaps = 30)
    ggplot2::ggsave(file.path(RES_DIR, "Fig_analyte_volcano.png"), g,
                    width = 8, height = 6, dpi = 300)
  }
}

## coverage report: how many subjects have each analyte at all -----------
coverage <- tibble::tibble(
  analyte = cand,
  n_non_missing = vapply(cand, function(cc) sum(!is.na(num_safe(d[[cc]]))), integer(1)),
  numeric_usable = cand %in% analytes) %>%
  arrange(desc(n_non_missing))
readr::write_csv(coverage, file.path(RES_DIR, "Analyte_coverage.csv"))
say("Analyte coverage table written (", nrow(coverage), " columns).")
