# DLB — CSF α-synuclein SAA: merge and analysis pipeline (R)

Merges `datafreeze_lewy.xlsx` (REDCap clinical) with `BIOFLUIDS_CLINICAL.xlsx`
(biofluids + biomarkers) **by NHC, keeping the clinical visit closest in time to
the biofluid sampling**, then runs the requested analyses.

## How to run

1. Copy the `dlb_saa` folder anywhere (e.g. inside `Desktop/Ricerca/Lewy_R/`).
2. Open `run_all.R` in RStudio and source it — or `Rscript run_all.R`.
3. Missing packages are installed on first run
   (`readxl dplyr tidyr stringr purrr tibble readr writexl gtsummary gt ggplot2`;
   optionally `ggrepel`, `MASS`).

Paths are set at the top of `R/00_config.R` and default to
`~/Desktop/Ricerca/Lewy_R/SAA` (with automatic fallbacks for OneDrive-redirected
Desktops on Windows). Everything is written to `SAA/Results/`.

## Read this first, before trusting any table

`Results/variable_mapping.csv` lists, for every analysis variable, **which source
column was actually used** and how many subjects have it. `Results/analysis_log.txt`
records the merge diagnostics, any SAA values the recoder did not recognise, and
every variable dropped from the tables. Check both; adjust the candidate lists in
`R/00_config.R` (`VARMAP`, `SAA*_CANDIDATES`) if something was picked up wrongly.

## Merge logic

- **De-duplication.** Clinical: subject-level REDCap fields are carried down
  within each NHC, then one row per *dated visit* is kept (identical
  NHC + date rows collapsed). Biofluids: exact duplicate rows removed; `NHC2`
  used as a fallback identifier when `NHC` is empty.
- **Pairing.** Every visit is crossed with every sample of the same NHC and the
  pair with the smallest `|visit_date − SAMPLEDATE|` wins. One row per subject
  (`ONE_ROW_PER_ID <- TRUE`; set to `FALSE` for one row per visit).
- **Gap.** `MAX_GAP_DAYS <- 365` — pairs beyond this are kept but flagged in
  `gap_exceeds_limit`, and the gap distribution is reported in the log so you can
  tighten it (90 or 180 days is a defensible choice for a paper).
- NHC is normalised (leading zeros stripped, punctuation removed) so `0012345`
  matches `12345`.

## Analyses produced

| Output | Content |
|---|---|
| `Table1_SAA2_own_site.*`, `Table1_SAA1_plus_SAA2.*`, `Table1_both_cohorts_side_by_side.*` | gtsummary tables (HTML + DOCX + CSV), SAA+ vs SAA− |
| `Table1_effect_sizes_p_MD_SMD.csv` | p, mean/risk difference with 95% CI, SMD, BH-q — computed independently of gtsummary |
| `Correlation_UPDRS_SPPB*.csv`, `Fig_UPDRS3_vs_SPPB.png` | Pearson + Spearman per group, Fisher r-to-z test for a group difference |
| `MRI_availability_*.csv` | how many merged subjects have an MRI (date, Fazekas or MTA) |
| `SAA_concordance_summary.csv`, `SAA_concordance_crosstab.csv`, `SAA_discordant_subjects.csv` | SAA1 vs SAA2 agreement, Cohen's κ with 95% CI, McNemar, and a line-listing of every discordant subject with the third assay and AD biomarkers for arbitration |
| `Analyte_screen_*.csv`, `Fig_analyte_volcano.png` | exploratory screen of all CSF/plasma/serum analytes |
| `merged_dataset.csv` / `.xlsx` | the merged, derived dataset |

### Table 1 variables and where they come from

age (from `fnac` + `SAMPLEDATE`, falling back to `AGE`/`edad`) · sex · `EDUC` ·
APOE ε4 carrier (from the `APOE` genotype string) · MoCA total (`puntuaciones`)
and the six domain sub-scores · MMSE · GDS-FAST · MDS-UPDRS IA/IB/II/III + a
strict total · Hoehn & Yahr · Mayo Fluctuations total and its four items ·
the four core LBD features and their count · DaT-SCAN · PSG-confirmed RBD · MIBG ·
amyloid status and the A/T profile (`ASTATUS`/`TSTATUS`) · motor phenotype.

**Motor phenotype** is derived Jankovic-style from the MDS-UPDRS III items:
mean tremor score (rest/postural/kinetic tremor + constancy) ÷ mean
akinetic-rigid score (rigidity, tapping, hand movements, pronation–supination,
leg agility, arising, gait, posture, postural stability, speech, facial
expression); ratio ≥ 1.0 = tremor-dominant, ≤ 0.8 = akinetic-rigid, in between =
mixed. The log reports how many items were actually found.

## Statistics

- Continuous: Wilcoxon rank-sum (small, skewed groups); reported as mean (SD) /
  median [IQR]. Categorical: Fisher exact.
- **Difference** = SAA-positive minus SAA-negative: mean difference (Welch 95% CI)
  for continuous, risk difference (%) for binary.
- **SMD**: (m₁−m₂)/√((s₁²+s₂²)/2) for continuous; the Yang–Dalton multinomial SMD
  for categorical (unsigned when >2 levels).
- BH-adjusted q values are added because Table 1 tests many variables — quote
  them, and treat everything as exploratory.
- Analyte screen: Wilcoxon, rank-biserial r, Hedges' g on the log scale, AUC,
  BH and Bonferroni. Analytes needing ≥ 10 subjects per group
  (`ANALYTE_MIN_N`). SAA/α-synuclein and sample-inventory columns are excluded
  (circular / not analytes). `Analyte_screen_consistent_both_cohorts.csv` keeps
  only candidates nominally significant in both cohorts and in the same
  direction — that list is the one worth following up.

## Caveats

- Indeterminate SAA results are excluded from the group comparisons and counted
  in the log.
- The combined cohort prefers the own-site (SAA2) result and falls back to
  Munich (SAA1); it is therefore a union of subjects, not an independent
  replication sample, and it overlaps the SAA2 cohort. The two Table 1 columns
  are not independent of each other.
- The analyte screen is hypothesis-generating: no adjustment for age, sex, APOE
  or assay batch, and the number of tests is large relative to the sample.
