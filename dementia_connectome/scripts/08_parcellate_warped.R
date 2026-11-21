# Re-parcellate the atrophy maps with the nonlinearly warped atlases
# (scripts/07_register_atlases.py), already on the t-map grid. PD is dropped.
# Outputs:
#   data/v2/parcellated_atrophy_schaefer{100,200,400}.csv      cortex only
#   data/v2/parcellated_atrophy_schaefer400_tian14.csv         cortex + 14 subcortical
#   data/v2/mirrored_atrophy_schaefer400_tian14.csv            same, from left-right mirrored maps
#   data/v2/warp_vs_worldNN_k400.csv                           agreement with the earlier parcellation
source("R/setup.R")
dir.create("data/v2", showWarnings = FALSE, recursive = TRUE)
syn2 <- c(AD = "AD", MCI = "MCI", FTD = "FTD", bvFTD = "bvFTD", svPPA = "svPPA", nfvPPA = "pnfaPPA")
tpath <- function(s) file.path(paths$zenodo, sprintf("%s_vs_Control_Tstat_Map_icbm152_nlin_sym.nii", syn2[[s]]))
maps <- lapply(names(syn2), function(s) as.array(RNifti::readNifti(tpath(s)))); names(maps) <- names(syn2)
sub_names <- c("Laccumb", "Lamyg", "Lcaud", "Lhippo", "Lpal", "Lput", "Lthal", "Raccumb", "Ramyg", "Rcaud", "Rhippo", "Rpal", "Rput", "Rthal")
g <- nifti_grid(tpath("AD"))
dcsf <- as.array(RNifti::readNifti("data/atlas_warped/dist_to_csf_mm.nii.gz"))
core_mm <- 3   # subcortical nodes: sample only voxels >= 3 mm from template CSF (DBM ventricular spill-over)

node_table <- function(k, with_sub) {
  info <- read_schaefer_labels(k)[, c("parcel", "label", "hemi", "network", "mni_x", "mni_y", "mni_z")]
  info$structure <- "cortex"
  if (with_sub) info <- rbind(info, data.frame(parcel = k + 1:14, label = sub_names, hemi = ifelse(substr(sub_names, 1, 1) == "L", "LH", "RH"),
                                               network = "Subcortex", mni_x = NA, mni_y = NA, mni_z = NA, structure = "subcortex"))
  info
}
centroids_from_labels <- function(lab, n) {
  idx <- which(lab > 0 & lab <= n, arr.ind = TRUE)
  l <- lab[idx]
  w <- cbind(idx - 1, 1) %*% t(g$affine)
  t(sapply(seq_len(n), function(p) colMeans(w[l == p, 1:3, drop = FALSE])))
}
run <- function(k, with_sub, flip = FALSE, core = TRUE) {
  f <- if (with_sub) sprintf("data/atlas_warped/schaefer%d_tian14_icbm2009csym.nii.gz", k) else sprintf("data/atlas_warped/schaefer%d_icbm2009csym.nii.gz", k)
  lab <- array(as.integer(RNifti::readNifti(f)), dim = g$dim)
  n <- k + if (with_sub) 14 else 0
  lab_c <- lab
  if (with_sub && core) lab_c[lab > k & dcsf < core_mm] <- 0L   # core of subcortical structures only
  info <- node_table(k, with_sub)
  cen <- centroids_from_labels(lab, n)                    # centroids in ICBM2009cSym space (warped atlas)
  info$x <- cen[, 1]; info$y <- cen[, 2]; info$z <- cen[, 3]
  cov <- NULL
  for (s in names(syn2)) {
    m <- maps[[s]]; if (flip) m <- m[dim(m)[1]:1, , ]
    pm <- parcel_means(m, lab_c, n)
    info[[s]] <- -pm$mean_value
    cov <- cbind(cov, pm$coverage)
  }
  info$coverage <- apply(cov, 1, min); info$n_vox <- pm$n_vox_grid
  info
}
for (k in c(100, 200, 400)) write.csv(run(k, FALSE), sprintf("data/v2/parcellated_atrophy_schaefer%d.csv", k), row.names = FALSE)
a414 <- run(400, TRUE); write.csv(a414, "data/v2/parcellated_atrophy_schaefer400_tian14.csv", row.names = FALSE)
write.csv(run(400, TRUE, flip = TRUE), "data/v2/mirrored_atrophy_schaefer400_tian14.csv", row.names = FALSE)
write.csv(run(400, TRUE, core = FALSE), "data/v2/parcellated_atrophy_schaefer400_tian14_allvoxels.csv", row.names = FALSE)

old <- read.csv("data/parcellated_atrophy_schaefer400.csv")
cmp <- data.frame(syndrome = names(syn2), r_warped_vs_worldNN = sapply(names(syn2), function(s) cor(old[[s]], a414[[s]][1:400])))
write.csv(cmp, "data/v2/warp_vs_worldNN_k400.csv", row.names = FALSE)
print(cmp, row.names = FALSE)
cat("coverage min (cortex / subcortex):", round(min(a414$coverage[1:400]), 3), "/", round(min(a414$coverage[401:414]), 3), "\n")
print(a414[401:414, c("label", "n_vox", "coverage", "AD", "MCI", "bvFTD", "svPPA", "nfvPPA")], row.names = FALSE, digits = 3)
