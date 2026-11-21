# Null models: spin permutations and degree(/geometry)-preserving rewiring.
# Stand-ins for connectomeR::rotate_parcellation / spin_test / rewire_degree;
# validated against neuromaps (spins) and by property checks (rewiring).

#' Uniform random rotation matrix
#' @return 3 x 3 proper rotation matrix (QR of a Gaussian matrix).
#' @export
random_rotation <- function() {
  q <- qr(matrix(stats::rnorm(9), 3, 3))
  Q <- qr.Q(q) %*% diag(sign(diag(qr.R(q))))
  if (det(Q) < 0) Q[, 1] <- -Q[, 1]
  Q
}

proxy_dist <- function(A, B) {
  sqrt(pmax(outer(rowSums(A^2), rowSums(B^2), "+") - 2 * A %*% t(B), 0))
}

#' Parcel-level spin permutations
#'
#' Random rotations of parcel centroids on the sphere (Alexander-Bloch et al.
#' 2018; Vasa et al. 2018) with one-to-one reassignment by the Hungarian
#' algorithm (Markello & Misic 2021). The left-hemisphere rotation is mirrored
#' (x -> -x) for the right hemisphere; parcels never cross hemispheres.
#' @param xyz n x 3 sphere coordinates of parcel centroids.
#' @param hemi character vector, "LH"/"RH" (case-insensitive).
#' @param n_perm number of permutations.
#' @param seed random seed.
#' @return integer matrix n x n_perm; `a[idx[, k]]` is the k-th spun map.
#' @export
spin_permutations <- function(xyz, hemi, n_perm = 1000, seed = 1) {
  set.seed(seed)
  hemi <- toupper(hemi)
  xyz <- as.matrix(xyz)
  F <- diag(c(-1, 1, 1))
  out <- matrix(NA_integer_, nrow(xyz), n_perm)
  for (k in seq_len(n_perm)) {
    R <- random_rotation()
    for (h in c("LH", "RH")) {
      ii <- which(hemi == h)
      Rh <- if (h == "LH") R else F %*% R %*% F
      rot <- xyz[ii, , drop = FALSE] %*% Rh
      cost <- proxy_dist(rot, xyz[ii, , drop = FALSE])
      sol <- as.integer(clue::solve_LSAP(cost))
      idx <- integer(length(ii))
      idx[sol] <- seq_along(ii)
      out[ii, k] <- ii[idx]
    }
  }
  out
}

#' Spin test for a correlation between two maps
#' @param x,y numeric maps over the same parcels; `x` is spun.
#' @param perms output of [spin_permutations()].
#' @param method correlation method passed to [stats::cor()].
#' @return list with `r`, two-sided `p` and the `null` correlations.
#' @export
spin_cor_test <- function(x, y, perms, method = "pearson") {
  r <- stats::cor(x, y, method = method, use = "complete.obs")
  null <- apply(perms, 2, function(p) stats::cor(x[p], y, method = method, use = "complete.obs"))
  list(r = r, p = (1 + sum(abs(null) >= abs(r))) / (1 + length(null)), null = null)
}

#' Degree-preserving rewiring
#'
#' Maslov & Sneppen (2002) edge swaps on an undirected weighted graph; weights
#' travel with edges, as `bct.randmio_und`.
#' @param W symmetric weight matrix.
#' @param iter swap attempts per edge.
#' @return rewired weight matrix (same degrees and multiset of weights).
#' @export
rewire_degree <- function(W, iter = 10) {
  rewire_cpp(unname(as.matrix(W)), as.integer(iter), matrix(0, 1, 1), numeric(0), FALSE)
}

#' Degree- and geometry-preserving rewiring
#'
#' A swap is accepted only if each new edge falls in the same edge-length bin
#' as the edge whose weight it inherits, so degrees are kept exactly and the
#' edge-length distribution and weight-length relation approximately (in the
#' spirit of Betzel & Bassett 2018 PNAS and Roberts et al. 2016 NeuroImage).
#' @param W symmetric weight matrix.
#' @param Dist n x n distance matrix.
#' @param nbins number of equal-count edge-length bins.
#' @param iter swap attempts per edge.
#' @return rewired weight matrix.
#' @export
rewire_geometry <- function(W, Dist, nbins = 20, iter = 50) {
  W <- unname(as.matrix(W)); Dist <- unname(as.matrix(Dist))
  len <- Dist[upper.tri(Dist) & W > 0]
  br <- unique(stats::quantile(len, probs = seq(0, 1, length.out = nbins + 1), names = FALSE))
  br[1] <- -Inf
  rewire_cpp(W, as.integer(iter), Dist, br[-length(br)], TRUE)
}

#' Fraction of edges of W1 absent from W2
#' @param W1,W2 adjacency or weight matrices.
#' @return proportion of W1's edges that W2 does not contain.
#' @export
edge_turnover <- function(W1, W2) {
  e1 <- W1[upper.tri(W1)] != 0; e2 <- W2[upper.tri(W2)] != 0
  sum(e1 & !e2) / sum(e1)
}
