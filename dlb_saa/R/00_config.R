## =====================================================================
## 00_config.R  --  paths, options and variable mapping
## Project: DLB seed-amplification assay (SAA1 = Munich, SAA2 = own site)
## EDIT THIS FILE ONLY (in normal use). Everything else is generic.
## =====================================================================

## ---- 1. Paths -------------------------------------------------------
## Folder layout expected:
##   Desktop / Ricerca / Lewy_R / SAA / datafreeze_lewy.xlsx
##                                    / BIOFLUIDS_CLINICAL.xlsx
##                                    / Results/            <- created
SAA_DIR <- path.expand("~/Desktop/Ricerca/Lewy_R/SAA")

## Fallbacks for OneDrive-redirected Desktops (Windows) -- first hit wins
if (!dir.exists(SAA_DIR)) {
  cand <- c(
    path.expand("~/OneDrive/Desktop/Ricerca/Lewy_R/SAA"),
    path.expand("~/OneDrive/Escritorio/Ricerca/Lewy_R/SAA"),
    path.expand("~/Escritorio/Ricerca/Lewy_R/SAA"),
    file.path(Sys.getenv("USERPROFILE"), "Desktop", "Ricerca", "Lewy_R", "SAA"),
    file.path(Sys.getenv("USERPROFILE"), "OneDrive", "Desktop", "Ricerca", "Lewy_R", "SAA")
  )
  hit <- cand[dir.exists(cand)]
  if (length(hit)) SAA_DIR <- hit[1]
}

FILE_CLIN <- file.path(SAA_DIR, "datafreeze_lewy.xlsx")      # REDCap clinical
FILE_BIO  <- file.path(SAA_DIR, "BIOFLUIDS_CLINICAL.xlsx")   # biofluids + biomarkers
RES_DIR   <- file.path(SAA_DIR, "Results")

## ---- 2. Merge options ----------------------------------------------
## Pairing rule: for every subject (NHC) all clinical visits are crossed with
## all biofluid samples; the pair with the smallest |visit_date - SAMPLEDATE|
## is kept. One row per subject.
MAX_GAP_DAYS   <- 365   # discard pairs further apart than this (NA = no limit)
ONE_ROW_PER_ID <- TRUE  # FALSE -> keep best sample for *each* visit

## ---- 3. SAA assay columns ------------------------------------------
## SAA1 = Munich cohort/assay ; SAA2 = own hospital assay.
## Candidates are tried in order; the first column present in the merged
## data with at least one non-missing value is used.
SAA1_CANDIDATES <- c("CSF_ALPHASYN_SAA01", "saa_munich")
SAA2_CANDIDATES <- c("CSF_ALPHASYN_SAA02", "saa_hps")
SAA3_CANDIDATES <- c("CSF_ALPHASYN_SAA03", "saa_amprion")   # 3rd assay, descriptive only

## How raw SAA values are recoded. Anything not matched -> NA (+ flagged).
SAA_POS_PATTERN  <- "^(1|2|pos|positiv[oae]?|positive|\\+|p|detected|si|sí|yes)$"
SAA_NEG_PATTERN  <- "^(0|neg|negativ[oae]?|negative|-|n|not detected|no)$"
SAA_IND_PATTERN  <- "^(3|9|ind|indet|indeterminate|inconclusive|dudoso|equivocal|gray|grey)$"

## ---- 4. Variable mapping -------------------------------------------
## Left = analysis name, right = candidate source columns (first found wins).
## Add / reorder candidates here if a variable is not picked up.
VARMAP <- list(
  ## demographics
  age_years          = c("age_at_sample", "AGE", "edad"),
  sex                = c("SEX", "sexo"),
  education_years    = c("EDUC"),
  apoe4_carrier      = c("apoe4_carrier"),                 # derived from APOE
  ## global cognition / staging
  moca_total         = c("puntuaciones", "resultado"),
  moca_visuospatial  = c("visuoespacialp"),
  moca_naming        = c("identificacionp"),
  moca_attention     = c("atencionp"),
  moca_language      = c("lenguajep"),
  moca_abstraction   = c("abstraccionp"),
  moca_orientation   = c("orientacionp"),
  moca_memory        = c("mis"),
  mmse               = c("MMSE"),
  gds_fast           = c("gds_visit", "GDS", "gds_fast_last_visit"),
  ## motor
  updrs1a            = c("updrs1a_total_score"),
  updrs1b            = c("updrs1b_total_score"),
  updrs2             = c("updrs2_total_score"),
  updrs3             = c("updrs3_total_score"),
  updrs_total        = c("updrs_total_score"),             # derived (1a+1b+2+3)
  hoehn_yahr         = c("hoehn_yahr"),
  sppb_total         = c("sppb_total_score"),
  sppb_balance       = c("sppb_subtotal1"),
  sppb_gait          = c("sppb_subtotal2"),
  sppb_chair         = c("sppb_subtotal3"),
  ## fluctuations
  mayo_total         = c("mayo_total_score"),
  mayo_lethargic     = c("lethargic"),
  mayo_sleep_day     = c("sleep_day"),
  mayo_disorganized  = c("disorganized"),
  mayo_staring       = c("staring"),
  ## core clinical features
  core_fluctuations  = c("fluctuations"),
  core_hallucinations= c("hallucinations"),
  core_rbd           = c("rbdclinical"),
  core_parkinsonism  = c("parkinsonism"),
  n_core_features    = c("n_core_features"),               # derived
  ## indicative biomarkers
  datscan            = c("datscan"),
  mibg               = c("mibg"),
  psg_rbd            = c("psg"),
  ## AD biomarkers
  amyloid_status     = c("ASTATUS", "ASTATUS_Lumipulse", "ASTATUS_ELISA"),
  tau_status         = c("TSTATUS", "TSTATUS_Lumipulse", "TSTATUS_ELISA"),
  at_profile         = c("at_profile"),                    # derived A-/A+T-/A+T+
  ## motor phenotype
  pd_phenotype       = c("pd_phenotype"),                  # derived (Jankovic)
  tremor_score       = c("tremor_score"),                  # derived
  akrigid_score      = c("akrigid_score"),                 # derived
  ## imaging availability
  mri_available      = c("mri_available")                  # derived
)

## Variables that go into the demographic table, in display order.
TABLE1_VARS <- c(
  "age_years", "sex", "education_years", "apoe4_carrier",
  "moca_total", "moca_visuospatial", "moca_naming", "moca_attention",
  "moca_language", "moca_abstraction", "moca_orientation", "moca_memory",
  "mmse", "gds_fast",
  "updrs1a", "updrs1b", "updrs2", "updrs3", "updrs_total", "hoehn_yahr",
  "mayo_total", "mayo_lethargic", "mayo_sleep_day", "mayo_disorganized",
  "mayo_staring",
  "core_fluctuations", "core_hallucinations", "core_rbd", "core_parkinsonism",
  "n_core_features",
  "datscan", "psg_rbd", "mibg",
  "amyloid_status", "at_profile",
  "pd_phenotype"
)

## Pretty labels for the table
TABLE1_LABELS <- c(
  age_years           = "Age at sampling, years",
  sex                 = "Sex",
  education_years     = "Education, years",
  apoe4_carrier       = "APOE e4 carrier",
  moca_total          = "MoCA total",
  moca_visuospatial   = "MoCA visuospatial/executive",
  moca_naming         = "MoCA naming",
  moca_attention      = "MoCA attention",
  moca_language       = "MoCA language",
  moca_abstraction    = "MoCA abstraction",
  moca_orientation    = "MoCA orientation",
  moca_memory         = "MoCA memory index",
  mmse                = "MMSE",
  gds_fast            = "GDS-FAST stage",
  updrs1a             = "MDS-UPDRS I-A",
  updrs1b             = "MDS-UPDRS I-B",
  updrs2              = "MDS-UPDRS II",
  updrs3              = "MDS-UPDRS III",
  updrs_total         = "MDS-UPDRS total (IA+IB+II+III)",
  hoehn_yahr          = "Hoehn & Yahr",
  mayo_total          = "Mayo Fluctuations Scale, total",
  mayo_lethargic      = "Mayo: daytime lethargy",
  mayo_sleep_day      = "Mayo: daytime sleep >2 h",
  mayo_disorganized   = "Mayo: disorganised speech",
  mayo_staring        = "Mayo: staring spells",
  core_fluctuations   = "Core: cognitive fluctuations",
  core_hallucinations = "Core: visual hallucinations",
  core_rbd            = "Core: RBD (clinical)",
  core_parkinsonism   = "Core: parkinsonism",
  n_core_features     = "Number of core features",
  datscan             = "DaT-SCAN abnormal",
  psg_rbd             = "PSG-confirmed RBD",
  mibg                = "MIBG abnormal",
  amyloid_status      = "Amyloid status (A)",
  at_profile          = "AD biomarker profile (A/T)",
  pd_phenotype        = "Motor phenotype"
)

## ---- 5. Analyte screening options ----------------------------------
ANALYTE_PREFIX   <- c("CSF_", "PLASMA_", "SERUM_")
ANALYTE_MIN_N    <- 10     # min non-missing per SAA group to test
ANALYTE_FDR      <- 0.05
## Excluded from screening: sample-inventory / admin columns and the SAA
## columns themselves (those define the grouping -> circular).
ANALYTE_EXCLUDE_PATTERN <- paste(
  "SAA[0-9]*$", "ALPHASYN", "PROTEOMICS", "METABOLOMICS",
  "SAMPLECODE", "STOCK", "VOLUME", "PROTOCOL", "SAMPLETIME", "SAMPLECHRONOLOGY",
  "^PLASMA_B[0-9]+$", "^PLASMA_BQ[0-9]+$", "^SERUM_D[0-9]+$", "^CSF_E[0-9]+$",
  sep = "|"
)

set.seed(20260826)
