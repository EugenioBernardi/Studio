## =====================================================================
## 05_secondary.R
##   A. UPDRS vs SPPB correlation, by SAA group
##   B. MRI availability in the merged sample
##   C. SAA1 vs SAA2 concordance in subjects with both assays
## =====================================================================

need(c("dplyr", "tibble", "readr", "ggplot2", "purrr"))

## ---------------------------------------------------------------------
## A. UPDRS x SPPB correlation
## ---------------------------------------------------------------------
say_rule("STEP 7A  UPDRS vs SPPB correlation by SAA status")

cor_pair <- function(dat, xv, yv, grp_label) {
  x <- dat[[xv]]; y <- dat[[yv]]
  ok <- !is.na(x) & !is.na(y)
  n <- sum(ok)
  if (n < 5) return(tibble::tibble(group = grp_label, x = xv, y = yv, n = n,
                                   pearson_r = NA, pearson_p = NA,
                                   spearman_rho = NA, spearman_p = NA))
  pe <- suppressWarnings(stats::cor.test(x[ok], y[ok], method = "pearson"))
  sp <- suppressWarnings(stats::cor.test(x[ok], y[ok], method = "spearman", exact = FALSE))
  tibble::tibble(group = grp_label, x = xv, y = yv, n = n,
                 pearson_r = round(unname(pe$estimate), 3),
                 pearson_ci = sprintf("%.2f to %.2f", pe$conf.int[1], pe$conf.int[2]),
                 pearson_p = signif(pe$p.value, 3),
                 spearman_rho = round(unname(sp$estimate), 3),
                 spearman_p = signif(sp$p.value, 3))
}

updrs_vars <- intersect(c("updrs3", "updrs_total", "updrs2"), names(coh_both))
sppb_vars  <- intersect(c("sppb_total", "sppb_balance", "sppb_gait", "sppb_chair"),
                        names(coh_both))

cor_results <- purrr::map_dfr(list(
  list(dat = coh_both %>% filter(saa_group == "Positive"), lab = "SAA positive"),
  list(dat = coh_both %>% filter(saa_group == "Negative"), lab = "SAA negative"),
  list(dat = coh_both,                                     lab = "All (SAA1+SAA2)"),
  list(dat = coh_saa2,                                     lab = "All (SAA2 own site)")
), function(s) purrr::map_dfr(updrs_vars, function(uv)
    purrr::map_dfr(sppb_vars, function(sv) cor_pair(s$dat, uv, sv, s$lab))))

readr::write_csv(cor_results, file.path(RES_DIR, "Correlation_UPDRS_SPPB.csv"))
print(cor_results %>% filter(x == "updrs3", y == "sppb_total"))

## Fisher r-to-z test for a difference in correlation between SAA groups
fisher_z <- function(r1, n1, r2, n2) {
  if (any(is.na(c(r1, n1, r2, n2))) || n1 < 4 || n2 < 4) return(c(NA, NA))
  z1 <- atanh(r1); z2 <- atanh(r2)
  se <- sqrt(1 / (n1 - 3) + 1 / (n2 - 3))
  z <- (z1 - z2) / se
  c(z = round(z, 3), p = signif(2 * stats::pnorm(-abs(z)), 3))
}
grp_diff <- purrr::map_dfr(updrs_vars, function(uv) purrr::map_dfr(sppb_vars, function(sv) {
  a <- cor_results %>% filter(group == "SAA positive", x == uv, y == sv)
  b <- cor_results %>% filter(group == "SAA negative", x == uv, y == sv)
  if (!nrow(a) || !nrow(b)) return(NULL)
  zz <- fisher_z(a$spearman_rho, a$n, b$spearman_rho, b$n)
  tibble::tibble(x = uv, y = sv, rho_pos = a$spearman_rho, n_pos = a$n,
                 rho_neg = b$spearman_rho, n_neg = b$n,
                 fisher_z = zz[1], p_difference = zz[2])
}))
readr::write_csv(grp_diff, file.path(RES_DIR, "Correlation_UPDRS_SPPB_group_difference.csv"))

## scatter plot
plot_dat <- coh_both %>% filter(!is.na(updrs3), !is.na(sppb_total))
if (nrow(plot_dat) >= 5) {
  p <- ggplot2::ggplot(plot_dat,
        ggplot2::aes(x = updrs3, y = sppb_total, colour = saa_group)) +
    ggplot2::geom_point(alpha = .75, size = 2) +
    ggplot2::geom_smooth(method = "lm", se = TRUE, formula = y ~ x) +
    ggplot2::labs(x = "MDS-UPDRS III", y = "SPPB total",
                  colour = "CSF a-syn SAA",
                  title = "Motor severity vs physical performance by SAA status") +
    ggplot2::theme_minimal(base_size = 12)
  ggplot2::ggsave(file.path(RES_DIR, "Fig_UPDRS3_vs_SPPB.png"), p,
                  width = 7, height = 5, dpi = 300)
  say("Scatter plot saved (n = ", nrow(plot_dat), ")")
} else say("Too few complete UPDRS-III / SPPB pairs for a plot (n = ", nrow(plot_dat), ")")

## ---------------------------------------------------------------------
## B. MRI availability
## ---------------------------------------------------------------------
say_rule("STEP 7B  MRI availability among merged subjects")

mri_tab <- d %>%
  summarise(
    n_merged            = dplyr::n(),
    mri_any             = sum(mri_available == "Yes", na.rm = TRUE),
    mri_with_date       = sum(!is.na(mri_date)),
    mri_with_fazekas    = sum(!is.na(grab(d, c("fazekas")))),
    mri_with_mta        = sum(!is.na(grab(d, c("mta"))))
  ) %>%
  mutate(mri_pct = round(100 * mri_any / n_merged, 1))

mri_by_group <- bind_rows(
  coh_saa2 %>% count(cohort, saa_group, mri_available),
  coh_both %>% count(cohort, saa_group, mri_available)
)

readr::write_csv(mri_tab,      file.path(RES_DIR, "MRI_availability_overall.csv"))
readr::write_csv(mri_by_group, file.path(RES_DIR, "MRI_availability_by_SAA_group.csv"))
say("MRI available in ", mri_tab$mri_any, "/", mri_tab$n_merged,
    " merged subjects (", mri_tab$mri_pct, "%)")
print(as.data.frame(mri_tab)); print(as.data.frame(mri_by_group))

## ---------------------------------------------------------------------
## C. SAA1 vs SAA2 concordance
## ---------------------------------------------------------------------
say_rule("STEP 7C  SAA1 (Munich) vs SAA2 (own site) concordance")

both_assays <- d %>%
  filter(saa1 %in% c("Negative", "Positive"), saa2 %in% c("Negative", "Positive")) %>%
  mutate(saa1 = droplevels(saa1), saa2 = droplevels(saa2),
         concordant = saa1 == saa2)

say("Subjects with BOTH SAA1 and SAA2 results: ", nrow(both_assays))

if (nrow(both_assays) >= 2) {
  ct <- table(SAA1_Munich = both_assays$saa1, SAA2_own_site = both_assays$saa2)
  print(ct)
  agree <- sum(diag(ct)) / sum(ct)
  say("Overall agreement: ", round(100 * agree, 1), "% (",
      sum(diag(ct)), "/", sum(ct), ")")
  say("Discordant pairs : ", sum(ct) - sum(diag(ct)))

  ## Cohen's kappa (computed directly, no extra package needed)
  pe <- sum(rowSums(ct) * colSums(ct)) / sum(ct)^2
  kappa <- (agree - pe) / (1 - pe)
  se_k <- sqrt(agree * (1 - agree) / (sum(ct) * (1 - pe)^2))
  say("Cohen's kappa: ", round(kappa, 3),
      " (95% CI ", round(kappa - 1.96 * se_k, 3), " to ",
      round(kappa + 1.96 * se_k, 3), ")")

  mc <- if (all(dim(ct) == c(2, 2))) stats::mcnemar.test(ct, correct = TRUE) else NULL
  if (!is.null(mc))
    say("McNemar test (systematic direction of disagreement): p = ",
        signif(mc$p.value, 3))

  ## which subjects disagree, with the third assay for arbitration
  both_assays$diagnosis_last <- grab(both_assays, c("dxlewy_last",
                     "dx_estudio_last_visit", "diagnosis", "LAST_ETIOL"))
  disc <- both_assays %>%
    filter(!concordant) %>%
    transmute(nhc = nhc_id,
              visit_date = visit_any_d, sample_date = sample_date_d,
              gap_days = abs_gap,
              SAA1_Munich = saa1, SAA2_own_site = saa2,
              SAA3_Amprion = saa3,
              amyloid_status, at_profile,
              core_rbd, core_parkinsonism, core_hallucinations, core_fluctuations,
              datscan, psg_rbd,
              diagnosis = diagnosis_last)
  readr::write_csv(disc, file.path(RES_DIR, "SAA_discordant_subjects.csv"))

  conc_summary <- tibble::tibble(
    n_with_both = nrow(both_assays),
    n_concordant = sum(both_assays$concordant),
    n_discordant = sum(!both_assays$concordant),
    pct_agreement = round(100 * agree, 1),
    cohen_kappa = round(kappa, 3),
    kappa_lci = round(kappa - 1.96 * se_k, 3),
    kappa_uci = round(kappa + 1.96 * se_k, 3),
    mcnemar_p = if (is.null(mc)) NA_real_ else signif(mc$p.value, 4),
    saa1_pos_saa2_neg = sum(both_assays$saa1 == "Positive" & both_assays$saa2 == "Negative"),
    saa1_neg_saa2_pos = sum(both_assays$saa1 == "Negative" & both_assays$saa2 == "Positive")
  )
  readr::write_csv(conc_summary, file.path(RES_DIR, "SAA_concordance_summary.csv"))
  readr::write_csv(as.data.frame(ct), file.path(RES_DIR, "SAA_concordance_crosstab.csv"))
} else {
  say("Not enough subjects with both assays to assess concordance.")
}
