## =====================================================================
## run_all.R  --  DLB / CSF alpha-synuclein SAA analysis pipeline
##
## HOW TO RUN
##   1. Open this file in RStudio (or run  Rscript run_all.R  ).
##   2. Check the paths at the top of R/00_config.R.
##   3. Source this file. Everything is written to  SAA/Results/.
##
## Missing packages are installed automatically on first run.
## =====================================================================

HERE <- tryCatch(dirname(normalizePath(sys.frame(1)$ofile)), error = function(e) getwd())
if (!dir.exists(file.path(HERE, "R"))) HERE <- getwd()

source(file.path(HERE, "R", "00_config.R"), local = FALSE, encoding = "UTF-8")
source(file.path(HERE, "R", "01_utils.R"),  local = FALSE, encoding = "UTF-8")

dir.create(RES_DIR, showWarnings = FALSE, recursive = TRUE)

say_rule(paste0("DLB SAA pipeline - ", format(Sys.time(), "%Y-%m-%d %H:%M")))
say("Data folder   : ", SAA_DIR)
say("Results folder: ", RES_DIR)

source(file.path(HERE, "R", "02_merge.R"),     encoding = "UTF-8")
source(file.path(HERE, "R", "03_derive.R"),    encoding = "UTF-8")

## save the merged, derived dataset before any analysis
need(c("readr", "writexl"))
readr::write_csv(d, file.path(RES_DIR, "merged_dataset.csv"), na = "")
try(writexl::write_xlsx(
  list(merged = d %>% dplyr::select(nhc_id, visit_any_d, sample_date_d, gap_days,
                                    dplyr::any_of(c("saa1", "saa2", "saa3", "saa_any",
                                                    TABLE1_VARS, "mri_available"))),
       variable_map = varmap_report),
  file.path(RES_DIR, "merged_dataset.xlsx")), silent = TRUE)
readr::write_csv(varmap_report, file.path(RES_DIR, "variable_mapping.csv"))
say("\nMerged dataset and variable mapping saved. ",
    "Please check variable_mapping.csv before trusting the tables.")

source(file.path(HERE, "R", "04_tables.R"),    encoding = "UTF-8")
source(file.path(HERE, "R", "05_secondary.R"), encoding = "UTF-8")
source(file.path(HERE, "R", "06_analytes.R"),  encoding = "UTF-8")

say_rule("DONE")
say("All outputs are in: ", RES_DIR)
write_log(file.path(RES_DIR, "analysis_log.txt"))
cat("\nLog written to ", file.path(RES_DIR, "analysis_log.txt"), "\n", sep = "")
