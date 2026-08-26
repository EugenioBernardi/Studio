## =====================================================================
## 03_derive.R  --  build the analysis variables from the merged data
## =====================================================================

need(c("dplyr", "stringr"))
say_rule("STEP 5  Deriving analysis variables")

d <- merged

## helper: fetch a column that may have been suffixed by the join
grab <- function(df, candidates) {
  cands <- unlist(lapply(candidates, function(x) c(x, paste0(x, ".clin"), paste0(x, ".bio"))))
  get_col(df, cands)
}
present <- function(df, candidates) !is.na(pick_col(df, unlist(lapply(
  candidates, function(x) c(x, paste0(x, ".clin"), paste0(x, ".bio"))))))

## ---- SAA status ------------------------------------------------------
d$saa1_raw <- grab(d, SAA1_CANDIDATES)
d$saa2_raw <- grab(d, SAA2_CANDIDATES)
d$saa3_raw <- grab(d, SAA3_CANDIDATES)

d$saa1 <- recode_saa(d$saa1_raw)
d$saa2 <- recode_saa(d$saa2_raw)
d$saa3 <- recode_saa(d$saa3_raw)

saa1_src <- pick_col(d, unlist(lapply(SAA1_CANDIDATES, function(x)
              c(x, paste0(x, ".clin"), paste0(x, ".bio")))))
saa2_src <- pick_col(d, unlist(lapply(SAA2_CANDIDATES, function(x)
              c(x, paste0(x, ".clin"), paste0(x, ".bio")))))
say("SAA1 (Munich)  source column: ", saa1_src, " -> ",
    paste(names(table(d$saa1)), table(d$saa1), sep = "=", collapse = ", "),
    " ; missing=", sum(is.na(d$saa1)))
say("SAA2 (own site) source column: ", saa2_src, " -> ",
    paste(names(table(d$saa2)), table(d$saa2), sep = "=", collapse = ", "),
    " ; missing=", sum(is.na(d$saa2)))
unmatched <- unique(c(as.character(d$saa1_raw)[is.na(d$saa1) & !is.na(d$saa1_raw)],
                      as.character(d$saa2_raw)[is.na(d$saa2) & !is.na(d$saa2_raw)]))
if (length(unmatched))
  say("!! raw SAA values NOT recognised (check SAA_*_PATTERN in 00_config.R): ",
      paste(head(unmatched, 20), collapse = " | "))

## combined status: own site preferred, Munich as fallback
d$saa_any <- factor(dplyr::coalesce(as.character(d$saa2), as.character(d$saa1)),
                    levels = c("Negative", "Positive", "Indeterminate"))
d$saa_source <- ifelse(!is.na(d$saa2), "SAA2 (own site)",
                ifelse(!is.na(d$saa1), "SAA1 (Munich)", NA))

## ---- demographics ----------------------------------------------------
d$dob_d <- as_date_safe(grab(d, c("fnac")))
age_from_dates <- as.numeric(d$sample_date_d - d$dob_d) / 365.25
d$age_years <- dplyr::coalesce(age_from_dates,
                               num_safe(grab(d, c("AGE"))),
                               num_safe(grab(d, c("edad"))))
d$sex <- recode_sex(grab(d, c("SEX", "sexo")))
d$education_years <- num_safe(grab(d, c("EDUC")))

## APOE e4 carrier: genotype column first, then the plasma proteoform flags
apoe_geno <- grab(d, c("APOE"))
d$apoe4_carrier <- apoe4_from_genotype(apoe_geno)
if (all(is.na(d$apoe4_carrier))) {
  alt <- grab(d, c("PLASMA_APOE4_A0010", "PLASMA_APOE4_H0010"))
  d$apoe4_carrier <- recode_yesno(alt)
}
say("APOE e4 carrier available for ", sum(!is.na(d$apoe4_carrier)), " subjects")

## ---- cognition -------------------------------------------------------
d$moca_total        <- num_safe(grab(d, c("puntuaciones")))
if (all(is.na(d$moca_total))) d$moca_total <- num_safe(grab(d, c("resultado")))
d$moca_visuospatial <- num_safe(grab(d, c("visuoespacialp")))
d$moca_naming       <- num_safe(grab(d, c("identificacionp")))
d$moca_attention    <- num_safe(grab(d, c("atencionp")))
d$moca_language     <- num_safe(grab(d, c("lenguajep")))
d$moca_abstraction  <- num_safe(grab(d, c("abstraccionp")))
d$moca_orientation  <- num_safe(grab(d, c("orientacionp")))
d$moca_memory       <- num_safe(grab(d, c("mis")))
d$mmse              <- num_safe(grab(d, c("MMSE")))
d$gds_fast          <- num_safe(grab(d, c("gds_visit", "GDS", "gds_fast_last_visit")))

## ---- motor -----------------------------------------------------------
d$updrs1a <- num_safe(grab(d, c("updrs1a_total_score")))
d$updrs1b <- num_safe(grab(d, c("updrs1b_total_score")))
d$updrs2  <- num_safe(grab(d, c("updrs2_total_score")))
d$updrs3  <- num_safe(grab(d, c("updrs3_total_score")))
d$updrs_total <- sum_strict(d$updrs1a, d$updrs1b, d$updrs2, d$updrs3)
d$hoehn_yahr <- num_safe(grab(d, c("hoehn_yahr")))

d$sppb_total   <- num_safe(grab(d, c("sppb_total_score")))
d$sppb_balance <- num_safe(grab(d, c("sppb_subtotal1")))
d$sppb_gait    <- num_safe(grab(d, c("sppb_subtotal2")))
d$sppb_chair   <- num_safe(grab(d, c("sppb_subtotal3")))

## ---- Mayo Fluctuations Scale ----------------------------------------
d$mayo_total        <- num_safe(grab(d, c("mayo_total_score")))
d$mayo_lethargic    <- recode_yesno(grab(d, c("lethargic")))
d$mayo_sleep_day    <- recode_yesno(grab(d, c("sleep_day")))
d$mayo_disorganized <- recode_yesno(grab(d, c("disorganized")))
d$mayo_staring      <- recode_yesno(grab(d, c("staring")))

## ---- core clinical features -----------------------------------------
d$core_fluctuations   <- recode_yesno(grab(d, c("fluctuations")))
d$core_hallucinations <- recode_yesno(grab(d, c("hallucinations")))
d$core_rbd            <- recode_yesno(grab(d, c("rbdclinical")))
d$core_parkinsonism   <- recode_yesno(grab(d, c("parkinsonism")))
core_mat <- cbind(as.integer(d$core_fluctuations   == "Yes"),
                  as.integer(d$core_hallucinations == "Yes"),
                  as.integer(d$core_rbd            == "Yes"),
                  as.integer(d$core_parkinsonism   == "Yes"))
d$n_core_features <- ifelse(rowSums(!is.na(core_mat)) == 0, NA_real_,
                            rowSums(core_mat, na.rm = TRUE))

## ---- indicative biomarkers ------------------------------------------
d$datscan  <- recode_yesno(grab(d, c("datscan")))
d$mibg     <- recode_yesno(grab(d, c("mibg")))
d$psg_rbd  <- recode_yesno(grab(d, c("psg")))

## ---- AD biomarker status --------------------------------------------
recode_at <- function(x) {
  v <- lower_chr(x)
  out <- rep(NA_character_, length(v))
  out[grepl("^(0|neg|negative|negativo|normal|a-|t-|-)$", v)] <- "Negative"
  out[grepl("^(1|pos|positive|positivo|abnormal|a\\+|t\\+|\\+)$", v)] <- "Positive"
  factor(out, levels = c("Negative", "Positive"))
}
d$amyloid_status <- recode_at(grab(d, c("ASTATUS", "ASTATUS_Lumipulse", "ASTATUS_ELISA")))
d$tau_status     <- recode_at(grab(d, c("TSTATUS", "TSTATUS_Lumipulse", "TSTATUS_ELISA")))
d$at_profile <- factor(dplyr::case_when(
  is.na(d$amyloid_status)                                  ~ NA_character_,
  d$amyloid_status == "Negative"                           ~ "A-",
  d$amyloid_status == "Positive" & d$tau_status == "Negative" ~ "A+T-",
  d$amyloid_status == "Positive" & d$tau_status == "Positive" ~ "A+T+",
  d$amyloid_status == "Positive"                           ~ "A+T unknown"
), levels = c("A-", "A+T-", "A+T+", "A+T unknown"))
say("Amyloid status available: ", sum(!is.na(d$amyloid_status)),
    " ; A/T profile available: ", sum(!is.na(d$at_profile)))

## ---- MRI availability -----------------------------------------------
mri_date <- as_date_safe(grab(d, c("mridate")))
faz <- grab(d, c("fazekas")); mta <- grab(d, c("mta"))
d$mri_available <- factor(ifelse(!is.na(mri_date) | !is.na(faz) | !is.na(mta),
                                 "Yes", "No"), levels = c("No", "Yes"))
d$mri_date <- mri_date

## ---- PD motor phenotype (Jankovic tremor / akinetic-rigid ratio) -----
## MDS-UPDRS III items are on a 0-4 scale in this export.
TREMOR_ITEMS <- c("posturaltremorr", "posturaltremorl", "kinetictremorr",
                  "kinetictremorl", "resttremorrue", "resttremorlue",
                  "resttremorrle", "resttremorlle", "resttremorlipjaw",
                  "constancy")
AR_ITEMS <- c("speech", "facialexpression", "rigidityneck", "rigidityrue",
              "rigiditylue", "rigidityrle", "rigiditylle", "tappingrue",
              "tappinglue", "handmovementsr", "handmovementsl",
              "pronationsupinationr", "pronationsupinationl", "tappingrle",
              "tappinglle", "legagilityr", "legagilityl", "arising", "gait",
              "freezing", "posturalstability", "posture", "globalspontaneityl")

grab_items <- function(df, items) {
  got <- character()
  m <- lapply(items, function(it) {
    cc <- pick_col(df, c(it, paste0(it, ".clin"), paste0(it, ".bio")))
    if (is.na(cc)) return(NULL)
    got <<- c(got, it); num_safe(df[[cc]])
  })
  m <- Filter(Negate(is.null), m)
  list(mat = if (length(m)) do.call(cbind, m) else NULL, used = got)
}
tr <- grab_items(d, TREMOR_ITEMS); ar <- grab_items(d, AR_ITEMS)
say("UPDRS-III tremor items found: ", length(tr$used), "/", length(TREMOR_ITEMS),
    " ; akinetic-rigid items found: ", length(ar$used), "/", length(AR_ITEMS))

d$tremor_score  <- if (!is.null(tr$mat)) mean_avail(tr$mat, min_items = max(3, ncol(tr$mat) %/% 2)) else NA_real_
d$akrigid_score <- if (!is.null(ar$mat)) mean_avail(ar$mat, min_items = max(5, ncol(ar$mat) %/% 2)) else NA_real_
d$tremor_ar_ratio <- ifelse(!is.na(d$akrigid_score) & d$akrigid_score > 0,
                            d$tremor_score / d$akrigid_score, NA_real_)
## Jankovic cut-offs: >=1.0 tremor-dominant, <=0.8 akinetic-rigid, between = mixed
d$pd_phenotype <- factor(dplyr::case_when(
  is.na(d$tremor_ar_ratio)      ~ NA_character_,
  d$tremor_ar_ratio >= 1.0      ~ "Tremor-dominant",
  d$tremor_ar_ratio <= 0.8      ~ "Akinetic-rigid",
  TRUE                          ~ "Mixed/indeterminate"
), levels = c("Akinetic-rigid", "Mixed/indeterminate", "Tremor-dominant"))
say("Motor phenotype classifiable in ", sum(!is.na(d$pd_phenotype)), " subjects")

## ---- analysis datasets ----------------------------------------------
## Indeterminate SAA results are excluded from the group comparisons but
## reported separately.
n_ind <- sum(d$saa_any == "Indeterminate", na.rm = TRUE)
if (n_ind) say("Indeterminate SAA results excluded from group comparisons: ", n_ind)

coh_saa2 <- d %>% filter(saa2 %in% c("Negative", "Positive")) %>%
  mutate(saa_group = droplevels(factor(saa2, levels = c("Negative", "Positive"))),
         cohort = "SAA2 (own site)")
coh_both <- d %>% filter(saa_any %in% c("Negative", "Positive")) %>%
  mutate(saa_group = droplevels(factor(saa_any, levels = c("Negative", "Positive"))),
         cohort = "SAA1 + SAA2")

say("Cohort SAA2      : n = ", nrow(coh_saa2),
    " (Positive ", sum(coh_saa2$saa_group == "Positive"),
    " / Negative ", sum(coh_saa2$saa_group == "Negative"), ")")
say("Cohort SAA1+SAA2 : n = ", nrow(coh_both),
    " (Positive ", sum(coh_both$saa_group == "Positive"),
    " / Negative ", sum(coh_both$saa_group == "Negative"), ")")

## report which source column ended up feeding each analysis variable
varmap_report <- tibble::tibble(
  analysis_variable = names(VARMAP),
  source_column = vapply(VARMAP, function(cands) {
    cc <- pick_col(d, unlist(lapply(cands, function(x)
      c(x, paste0(x, ".clin"), paste0(x, ".bio")))))
    if (is.na(cc)) "(derived / not found)" else cc
  }, character(1)),
  n_non_missing = vapply(names(VARMAP), function(v)
    if (v %in% names(d)) sum(!is.na(d[[v]])) else NA_integer_, integer(1))
)
