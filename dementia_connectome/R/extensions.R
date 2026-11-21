# Extension analyses computed at render time from cached surrogates.

# Partial correlation r(a, P_M | P_distance) with the distance kernel refitted
# per map; vectorised over the columns of A (maps or surrogates).
partial_beyond_distance <- function(M, A, Dist, R = 0) {
  dk <- lapply(lambda_grid, function(l) censor(comm_distance(Dist, l), Dist, R))
  f <- family_r(dk, A)
  Pd <- matrix(NA_real_, nrow(A), ncol(A))
  for (j in unique(f$param)) { cols <- which(f$param == j); Pd[, cols] <- predict_from_model(dk[[j]], A[, cols, drop = FALSE]) }
  Pm <- suppressWarnings(as.matrix(predict_from_model(censor(M, Dist, R), A)))
  ok <- is.finite(Pm[, 1])
  A <- A[ok, , drop = FALSE]; Pd <- Pd[ok, , drop = FALSE]; Pm <- Pm[ok, , drop = FALSE]
  r_am <- colcor(A, Pm); r_ad <- colcor(A, Pd); r_md <- colcor(Pm, Pd)
  (r_am - r_ad * r_md) / sqrt((1 - r_ad^2) * (1 - r_md^2))
}

# Geometric eigenmode basis at parcel level, columns ordered by eigenvalue
geometric_basis <- function(k) {
  B <- as.matrix(read.csv(sprintf("data/eigenmodes/geometric_modes_schaefer%d.csv", k), check.names = FALSE))
  ev <- read.csv("data/eigenmodes/geometric_eigenvalues.csv")
  vals <- c(ev$lh, ev$rh)
  B[, order(vals, rep(1:2, each = nrow(ev)))]
}

# Voxel-level laterality on the symmetric template: mirror correlation and
# laterality index of positive atrophy within the cortical atlas mask.
voxel_laterality <- function(k = 400) {
  atlas_path <- file.path(paths$schaefer, sprintf("Schaefer2018_%dParcels_7Networks_order_FSLMNI152_1mm.nii.gz", k))
  g <- nifti_grid(tmap_path("AD"))
  lab <- resample_labels_nn(atlas_path, g)
  x <- (seq_len(g$dim[1]) - 1) + g$affine[1, 4]
  left <- array(x < 0, dim = g$dim) # recycled: x is the fastest-varying index
  ctx <- lab > 0
  do.call(rbind, lapply(names(syndromes), function(s) {
    t <- as.array(RNifti::readNifti(tmap_path(s))); a <- -t; m <- a[g$dim[1]:1, , ]
    sel <- ctx & left & t != 0 & m != 0
    Lp <- sum(pmax(a[ctx & left], 0)); Rp <- sum(pmax(a[ctx & !left], 0))
    data.frame(syndrome = s, mirror_r = cor(a[sel], m[sel]), LI_positive_atrophy = (Lp - Rp) / (Lp + Rp))
  }))
}
