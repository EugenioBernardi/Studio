## =====================================================================
## 02_merge.R  --  read both workbooks, de-duplicate, merge by NHC with
##                 the closest clinical visit / sampling date
## =====================================================================

need(c("readxl", "dplyr", "tidyr", "stringr", "purrr", "tibble"))

say_rule("STEP 1  Reading source files")
stopifnot(file.exists(FILE_CLIN), file.exists(FILE_BIO))

clin_raw <- readxl::read_excel(FILE_CLIN, guess_max = 100000, .name_repair = "minimal")
bio_raw  <- readxl::read_excel(FILE_BIO,  guess_max = 100000, .name_repair = "minimal")

## drop unnamed / duplicated columns produced by Excel
dedupe_names <- function(df) {
  nm <- names(df)
  keep <- nm != "" & !is.na(nm)
  df <- df[, keep, drop = FALSE]
  df[, !duplicated(names(df)), drop = FALSE]
}
clin_raw <- dedupe_names(clin_raw)
bio_raw  <- dedupe_names(bio_raw)

say("datafreeze_lewy.xlsx    : ", nrow(clin_raw), " rows x ", ncol(clin_raw), " cols")
say("BIOFLUIDS_CLINICAL.xlsx : ", nrow(bio_raw),  " rows x ", ncol(bio_raw),  " cols")

## ---------------------------------------------------------------------
## 1. CLINICAL FILE -----------------------------------------------------
## REDCap long export: subject-level fields sit on the enrolment event,
## visit-level fields on repeating instances. We (a) carry subject-level
## fields down within each NHC and (b) keep one row per visit.
## ---------------------------------------------------------------------
say_rule("STEP 2  Reshaping the clinical (REDCap) export")

nhc_col <- grep("^nhc$", names(clin_raw), ignore.case = TRUE, value = TRUE)[1]
if (is.na(nhc_col)) stop("No 'nhc' column found in datafreeze_lewy.xlsx")
clin <- clin_raw %>% mutate(nhc_id = norm_id(.data[[nhc_col]]))
clin <- clin %>% filter(!is.na(nhc_id))

## dates used for pairing / age
clin$visit_date_d  <- as_date_safe(get_col(clin, c("visit_date")))
clin$visit_alt_d   <- as_date_safe(get_col(clin, c("visit_date_base_lewy", "fecha_um",
                                                   "date_last_medical_visit",
                                                   "last_visit_modulo_clinico")))
clin$visit_any_d   <- dplyr::coalesce(clin$visit_date_d, clin$visit_alt_d)
clin$dob_d         <- as_date_safe(get_col(clin, c("fnac")))

## subject-level columns = those that vary at most once per NHC and are
## mostly recorded on a single (non-repeating) row
visit_level_hint <- c("visit_date", "redcap_event_instance", "visitdiagnosis",
                      "gds_visit", "medication", "hoehn_yahr")
## Explicit and safer: define the set of columns that are *visit* level.
VISIT_COLS <- intersect(c(
  "visit_date_d", "visit_alt_d", "visit_any_d",
  "redcap_event_instance", "visit_date", "neurologist", "visitdiagnosis",
  "gds_visit", "medication", "hoehn_yahr", "diagnostico_visita",
  grep(paste0("^(updrs|sppb|mayo|zarit|a_|d_|ansiedad_had|depresion_had|",
              "movilidad|autocuidado|actividadescotidianas|dolor_|termometro|",
              "visuoespacial|identificacion|rostro|seda|templo|clavel|rojo|",
              "directos|inversos|letras|serie7|repeticion|fluidez|num_palab|",
              "abstraccion|at_|len_|orientacionp|puntuaciones|resultado|mis|",
              "speech|facial|rigidity|tapping|handmovements|pronation|legagility|",
              "arising|gait|freezing|postural|globalspont|kinetictremor|resttremor|",
              "constancy|dyskinesia|lethargic|sleep_day|disorganized|staring|",
              "fecha|any$|mes$|dia_semana|lugar|localidad|seguimiento|resumen_)"),
       names(clin), value = TRUE)
), names(clin))

SUBJECT_COLS <- setdiff(names(clin), c(VISIT_COLS, "nhc_id"))

clin <- clin %>%
  group_by(nhc_id) %>%
  mutate(across(all_of(SUBJECT_COLS),
                ~ if (all(is.na(.x))) .x else
                    dplyr::coalesce(.x, .x[which(!is.na(.x))[1]]))) %>%
  ungroup()

## drop rows that carry no visit information at all, then de-duplicate
clin_visits <- clin %>%
  filter(!is.na(visit_any_d)) %>%
  distinct(nhc_id, visit_any_d, .keep_all = TRUE) %>%
  arrange(nhc_id, visit_any_d)

## subjects whose only row has no date: keep them so they are not lost
clin_nodate <- clin %>%
  filter(!nhc_id %in% clin_visits$nhc_id) %>%
  distinct(nhc_id, .keep_all = TRUE)

clin_use <- bind_rows(clin_visits, clin_nodate)

say("clinical: ", n_distinct(clin$nhc_id), " unique NHC, ",
    nrow(clin_visits), " dated visits, ",
    nrow(clin_nodate), " subjects without any usable date")

## ---------------------------------------------------------------------
## 2. BIOFLUIDS FILE ----------------------------------------------------
## ---------------------------------------------------------------------
say_rule("STEP 3  Preparing the biofluids file")

bio <- bio_raw %>%
  mutate(nhc_id  = norm_id(.data[["NHC"]]),
         nhc_id2 = if ("NHC2" %in% names(bio_raw)) norm_id(.data[["NHC2"]]) else NA_character_)
## use NHC2 as a fallback identifier when NHC is empty
bio$nhc_id <- dplyr::coalesce(bio$nhc_id, bio$nhc_id2)
bio <- bio %>% filter(!is.na(nhc_id))

bio$sample_date_d <- as_date_safe(get_col(bio, c("SAMPLEDATE", "GROUPED_BY_DATE",
                                                 "DATA_CAPTURE", "FUPDATE")))
bio <- bio %>%
  distinct(across(everything()), .keep_all = TRUE) %>%   # exact duplicate rows
  arrange(nhc_id, sample_date_d)

say("biofluids: ", n_distinct(bio$nhc_id), " unique NHC, ", nrow(bio), " sample rows (after exact-dup removal)")

## overlap
ids_clin <- unique(clin_use$nhc_id); ids_bio <- unique(bio$nhc_id)
say("NHC in both files       : ", length(intersect(ids_clin, ids_bio)))
say("NHC only in clinical    : ", length(setdiff(ids_clin, ids_bio)))
say("NHC only in biofluids   : ", length(setdiff(ids_bio, ids_clin)))

## ---------------------------------------------------------------------
## 3. NEAREST-DATE PAIRING ---------------------------------------------
## ---------------------------------------------------------------------
say_rule("STEP 4  Pairing visits and samples on the closest date")

suffix_clash <- function(a, b) intersect(names(a), names(b))
clash <- setdiff(suffix_clash(clin_use, bio), c("nhc_id"))
if (length(clash))
  say("Columns present in both files (suffixed .clin / .bio): ",
      paste(clash, collapse = ", "))

join_args <- list(
  x = clin_use %>% select(nhc_id, visit_any_d, everything()),
  y = bio      %>% select(nhc_id, sample_date_d, everything()),
  by = "nhc_id", suffix = c(".clin", ".bio"))
if (utils::packageVersion("dplyr") >= "1.1.0")
  join_args$relationship <- "many-to-many"
pair_tbl <- suppressWarnings(do.call(dplyr::inner_join, join_args)) %>%
  mutate(gap_days = as.numeric(sample_date_d - visit_any_d),
         abs_gap  = abs(gap_days))

## pairs where one of the dates is missing get an infinite gap but are kept
## as a last resort (so a subject with a sample and an undated visit survives)
pair_tbl <- pair_tbl %>% mutate(abs_gap_rank = ifelse(is.na(abs_gap), Inf, abs_gap))

if (!is.na(MAX_GAP_DAYS)) {
  dropped <- pair_tbl %>% group_by(nhc_id) %>%
    summarise(best = suppressWarnings(min(abs_gap_rank, na.rm = TRUE)), .groups = "drop") %>%
    filter(is.finite(best), best > MAX_GAP_DAYS)
  say("Subjects whose closest visit-sample gap exceeds ", MAX_GAP_DAYS,
      " days: ", nrow(dropped), " (kept, but flagged in gap_exceeds_limit)")
}

key <- if (ONE_ROW_PER_ID) "nhc_id" else c("nhc_id", "visit_any_d")

merged <- pair_tbl %>%
  group_by(across(all_of(key))) %>%
  arrange(abs_gap_rank, visit_any_d, sample_date_d, .by_group = TRUE) %>%
  slice(1) %>%
  ungroup() %>%
  mutate(gap_exceeds_limit = !is.na(MAX_GAP_DAYS) & is.finite(abs_gap) &
                             abs_gap > MAX_GAP_DAYS)

say("Merged dataset: ", nrow(merged), " rows / ", n_distinct(merged$nhc_id), " subjects")
say("Absolute visit-sample gap (days): median ",
    round(median(merged$abs_gap, na.rm = TRUE), 1),
    " [IQR ", paste(round(quantile(merged$abs_gap, c(.25, .75), na.rm = TRUE), 1),
                    collapse = "-"), "]",
    "; max ", if (all(is.na(merged$abs_gap))) "NA" else
                 round(max(merged$abs_gap, na.rm = TRUE), 1))
say("Pairs with gap <= 90 days: ", sum(merged$abs_gap <= 90, na.rm = TRUE),
    " / ", sum(!is.na(merged$abs_gap)))
