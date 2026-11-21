# Extensions that need caching:
#  (1) variogram-matched and Moran-spectral surrogates run through the same
#      model-fitting engine as the spin null (null-model comparison);
#  (2) parcellation of left-right mirrored t-maps (laterality control for
#      epicentres; the ICBM 2009c template is symmetric about x = 0).
# Usage: Rscript scripts/03_extensions.R <k> [n_surrogates]
args <- commandArgs(TRUE)
k <- as.integer(args[1]); n_sur <- as.integer(if (length(args) > 1) args[2] else 1000)
source("R/setup.R"); source("R/analysis.R"); source("R/spatial_nulls.R")
f <- function(x) sprintf("output/cache/%s_k%d.rds", x, k)
log <- function(...) cat(format(Sys.time(), "%H:%M:%S"), sprintf(...), "\n")
d <- prep_resolution(k)
models <- c(communication_models(d$SC, d$Dist), list(FC = d$FC))
modes <- laplacian_modes(d$SC)
syn <- colnames(d$A)

for (type in c("variogram", "moran")) {
  gen <- if (type == "variogram") variogram_surrogates else moran_surrogates
  S <- lapply(seq_along(syn), function(i) unclass(gen(d$A[, i], d$Dist, n = n_sur, seed = 4000 + 10 * i + k)))
  S <- lapply(S, function(x) { attributes(x) <- list(dim = dim(x)); x })
  saveRDS(S, f(paste0("surrogates_", type)))
  As <- do.call(cbind, S)
  fit <- fit_all(models, modes, d$Dist, As, tuned = TRUE)
  fit$syndrome <- rep(syn, each = n_sur)[fit$col]; fit$perm <- ((fit$col - 1) %% n_sur) + 1
  saveRDS(fit[, c("R", "model", "syndrome", "perm", "r", "param")], f(paste0(type, "_null")))
  log("%s null done", type)
}

# (2) mirrored maps: flip each t-map along x on its own (symmetric) grid, parcellate
info <- read_schaefer_labels(k)
atlas_path <- file.path(paths$schaefer, sprintf("Schaefer2018_%dParcels_7Networks_order_FSLMNI152_1mm.nii.gz", k))
g <- nifti_grid(tmap_path("AD"))
stopifnot(g$affine[1, 1] == 1, g$affine[1, 4] == -(g$dim[1] - 1) / 2) # x symmetric about 0
lab <- resample_labels_nn(atlas_path, g)
flip <- sapply(syn, function(s) {
  t <- as.array(RNifti::readNifti(tmap_path(s)))
  -parcel_means(t[dim(t)[1]:1, , ], lab, k)$mean_value
})
saveRDS(flip, f("flipped_atrophy")); log("flipped parcellation done")
