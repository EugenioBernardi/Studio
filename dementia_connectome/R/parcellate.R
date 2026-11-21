# Parcellation of voxel-wise maps with a volumetric atlas.
#
# The atlas is resampled to the map's grid (nearest neighbour, via world
# coordinates); the map itself is never resampled. All affines are taken from
# the NIfTI sform (RNifti::xform), which maps 0-based voxel indices to RAS mm.

#' 4x4 voxel(0-based) -> world affine of a NIfTI image
nifti_affine <- function(img) {
  A <- unclass(RNifti::xform(img, useQuaternionFirst = FALSE))
  attributes(A) <- list(dim = c(4L, 4L))
  A
}

#' Grid description: dimensions, voxel size, affine, orientation code
nifti_grid <- function(path) {
  img <- RNifti::readNifti(path, internal = TRUE)
  h <- RNifti::niftiHeader(img)
  list(
    path = path,
    dim = dim(img)[1:3],
    pixdim = h$pixdim[2:4],
    affine = nifti_affine(img),
    orientation = RNifti::orientation(img),
    sform_code = h$sform_code,
    qform_code = h$qform_code
  )
}

#' Resample an integer label atlas onto a target grid by nearest neighbour.
#'
#' For each target voxel centre, its world coordinate is mapped into atlas
#' voxel space and rounded to the nearest atlas voxel. Target voxels that fall
#' outside the atlas field of view get label 0.
#' @return integer array with the target grid's dimensions
resample_labels_nn <- function(atlas_path, target_grid) {
  atlas <- RNifti::readNifti(atlas_path)
  lab <- array(as.integer(round(as.numeric(atlas))), dim = dim(atlas)[1:3])
  stopifnot(all(abs(as.numeric(atlas) - lab) < 1e-6)) # atlas must hold integers
  A_atlas_inv <- solve(nifti_affine(atlas))
  M <- A_atlas_inv %*% target_grid$affine # target voxel -> atlas voxel (both 0-based)

  d <- target_grid$dim
  # Separable evaluation of M %*% [i, j, k, 1] to keep memory low
  i <- 0:(d[1] - 1); j <- 0:(d[2] - 1); k <- 0:(d[3] - 1)
  out <- integer(prod(d))
  da <- dim(lab)
  ij <- as.matrix(expand.grid(i = i, j = j))
  for (kk in seq_along(k)) {
    p <- cbind(ij, k[kk], 1) %*% t(M)
    v <- round(p[, 1:3, drop = FALSE])
    ok <- v[, 1] >= 0 & v[, 1] < da[1] & v[, 2] >= 0 & v[, 2] < da[2] & v[, 3] >= 0 & v[, 3] < da[3]
    vals <- integer(nrow(v))
    vals[ok] <- lab[cbind(v[ok, 1] + 1, v[ok, 2] + 1, v[ok, 3] + 1)]
    out[(kk - 1) * nrow(ij) + seq_len(nrow(ij))] <- vals
  }
  array(out, dim = d)
}

#' Mean of a voxel map within each parcel, with coverage.
#'
#' A voxel counts as covered when the map value is finite and non-zero (the
#' DBM t-maps are zero outside their brain mask).
#' @param map numeric array on the same grid as `labels`
#' @param labels integer array (0 = background)
#' @param n_parcels number of parcels (labels 1..n_parcels)
#' @return data.frame: parcel, n_vox_grid, n_vox_valid, coverage, mean_value
parcel_means <- function(map, labels, n_parcels) {
  stopifnot(identical(dim(map), dim(labels)))
  lab <- as.integer(labels)
  x <- as.numeric(map)
  valid <- is.finite(x) & x != 0
  in_parc <- lab >= 1L & lab <= n_parcels
  n_grid <- tabulate(lab[in_parc], nbins = n_parcels)
  sel <- in_parc & valid
  n_valid <- tabulate(lab[sel], nbins = n_parcels)
  sums <- vapply(split(x[sel], factor(lab[sel], levels = seq_len(n_parcels))), sum, numeric(1))
  data.frame(
    parcel = seq_len(n_parcels),
    n_vox_grid = n_grid,
    n_vox_valid = n_valid,
    coverage = ifelse(n_grid > 0, n_valid / n_grid, 0),
    mean_value = ifelse(n_valid > 0, sums / pmax(n_valid, 1), NA_real_)
  )
}
