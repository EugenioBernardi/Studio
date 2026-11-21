# Step 1: parcellate the DBM t-maps with Schaefer-2018 (7 networks).
# Sourced by analysis.Rmd; can also be run on its own from the project root.

source("R/parcellate.R")

paths <- list(
  zenodo = "data-raw/zenodo",
  schaefer = "data-raw/CBIG/stable_projects/brain_parcellation/Schaefer2018_LocalGlobal/Parcellations/MNI",
  enigma_mat = "data-raw/ENIGMA/enigmatoolbox/datasets/matrices/hcp_connectivity"
)

# Syndrome name -> file stem on Zenodo. pnfaPPA on Zenodo = nfvPPA in the report.
syndromes <- c(
  AD = "AD", MCI = "MCI", PD = "PD", FTD = "FTD",
  bvFTD = "bvFTD", svPPA = "svPPA", nfvPPA = "pnfaPPA"
)
tmap_path <- function(s) file.path(paths$zenodo, sprintf("%s_vs_Control_Tstat_Map_icbm152_nlin_sym.nii", syndromes[[s]]))
resolutions <- c(100L, 200L, 400L)
coverage_min <- 0.5

read_schaefer_labels <- function(k) {
  lut <- read.table(file.path(paths$schaefer, "freeview_lut", sprintf("Schaefer2018_%dParcels_7Networks_order.txt", k)),
                    header = FALSE, stringsAsFactors = FALSE)[, 1:2]
  names(lut) <- c("parcel", "label")
  cen <- read.csv(file.path(paths$schaefer, "Centroid_coordinates",
                            sprintf("Schaefer2018_%dParcels_7Networks_order_FSLMNI152_1mm.Centroid_RAS.csv", k)))
  sc <- strsplit(readLines(file.path(paths$enigma_mat, sprintf("strucLabels_ctx_schaefer_%d.csv", k)), warn = FALSE), ",")[[1]]
  fc <- strsplit(readLines(file.path(paths$enigma_mat, sprintf("funcLabels_ctx_schaefer_%d.csv", k)), warn = FALSE), ",")[[1]]
  checks <- c(
    ids_are_1_to_N = identical(lut$parcel, seq_len(k)),
    cbig_eq_enigma_SC = identical(lut$label, trimws(sc)),
    cbig_eq_enigma_FC = identical(lut$label, trimws(fc)),
    cbig_eq_centroid_table = identical(lut$label, cen$ROI.Name)
  )
  if (!all(checks)) stop(sprintf("Schaefer-%d label check failed: %s", k, paste(names(checks)[!checks], collapse = ", ")))
  parts <- strsplit(sub("^7Networks_", "", lut$label), "_")
  data.frame(
    parcel = lut$parcel,
    label = lut$label,
    hemi = vapply(parts, `[`, "", 1),
    network = vapply(parts, `[`, "", 2),
    subregion = vapply(parts, function(p) if (length(p) > 3) paste(p[3:(length(p) - 1)], collapse = "_") else "", ""),
    mni_x = cen$R, mni_y = cen$A, mni_z = cen$S,
    stringsAsFactors = FALSE
  )
}

run_step1 <- function(write = TRUE) {
  grids <- lapply(names(syndromes), function(s) nifti_grid(tmap_path(s)))
  names(grids) <- names(syndromes)
  same_grid <- vapply(grids, function(g) isTRUE(all.equal(g$affine, grids[[1]]$affine)) && identical(g$dim, grids[[1]]$dim), TRUE)

  maps <- lapply(names(syndromes), function(s) as.array(RNifti::readNifti(tmap_path(s))))
  names(maps) <- names(syndromes)

  out <- list()
  for (k in resolutions) {
    info <- read_schaefer_labels(k)
    atlas_path <- file.path(paths$schaefer, sprintf("Schaefer2018_%dParcels_7Networks_order_FSLMNI152_1mm.nii.gz", k))
    native <- tabulate(as.integer(RNifti::readNifti(atlas_path)), nbins = k)
    res <- list(); cov <- list(); lab_cache <- NULL; lab_key <- NULL
    for (s in names(syndromes)) {
      key <- paste(grids[[s]]$dim, collapse = "x")
      if (!identical(key, lab_key) || !same_grid[[s]]) { # resample once per distinct grid
        lab_cache <- resample_labels_nn(atlas_path, grids[[s]]); lab_key <- key
      }
      pm <- parcel_means(maps[[s]], lab_cache, k)
      res[[s]] <- -pm$mean_value # atrophy = -t
      cov[[s]] <- pm
    }
    covdf <- data.frame(info[, c("parcel", "label")], n_vox_native = native,
                        n_vox_grid = cov[[1]]$n_vox_grid)
    for (s in names(syndromes)) covdf[[paste0("coverage_", s)]] <- cov[[s]]$coverage
    covdf$coverage_min <- apply(covdf[, grep("^coverage_", names(covdf)), drop = FALSE], 1, min)
    covdf$included <- covdf$coverage_min >= coverage_min

    atro <- data.frame(info, coverage = covdf$coverage_min, included = covdf$included)
    for (s in names(syndromes)) atro[[s]] <- ifelse(covdf$included, res[[s]], NA_real_)
    if (write) write.csv(atro, sprintf("data/parcellated_atrophy_schaefer%d.csv", k), row.names = FALSE)
    out[[as.character(k)]] <- list(atrophy = atro, coverage = covdf)
  }
  attr(out, "grids") <- grids
  attr(out, "same_grid") <- same_grid
  out
}

if (sys.nframe() == 0L) {
  r <- run_step1()
  for (k in names(r)) {
    cat("Schaefer", k, ": excluded parcels =", sum(!r[[k]]$atrophy$included), "\n")
  }
}
