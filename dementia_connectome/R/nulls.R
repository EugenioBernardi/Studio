# Null models. Stand-ins for connectomeR::rotate_parcellation / spin_test /
# rewire_degree until the package source is available; validated in
# validation/validate_nulls.R.

#' Uniform random rotation matrix in SO(3) (QR of a Gaussian matrix).
random_rotation <- function() {
  q <- qr(matrix(rnorm(9), 3, 3))
  Q <- qr.Q(q) %*% diag(sign(diag(qr.R(q))))
  if (det(Q) < 0) Q[, 1] <- -Q[, 1]
  Q
}

#' Parcel-level spin permutations (Alexander-Bloch et al. 2018; Vasa et al.
#' 2018), with one-to-one reassignment by the Hungarian algorithm (Markello &
#' Misic 2021). The left-hemisphere rotation is mirrored (x -> -x) for the
#' right hemisphere. Parcels never move between hemispheres.
#' @param xyz n x 3 sphere coordinates of parcel centroids
#' @param hemi character vector "LH"/"RH" (or "lh"/"rh")
#' @return integer matrix n x n_perm; a[idx[, k]] is the k-th spun map
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
      cost <- as.matrix(proxy_dist(rot, xyz[ii, , drop = FALSE]))
      sol <- as.integer(clue::solve_LSAP(cost)) # rotated parcel i -> location sol[i]
      idx <- integer(length(ii))
      idx[sol] <- seq_along(ii)                  # location j takes value of parcel idx[j]
      out[ii, k] <- ii[idx]
    }
  }
  out
}

proxy_dist <- function(A, B) {
  sqrt(pmax(outer(rowSums(A^2), rowSums(B^2), "+") - 2 * A %*% t(B), 0))
}

#' Spin-test p-value for a correlation between two maps (two-sided), spinning x.
spin_cor_test <- function(x, y, perms, method = "pearson") {
  r <- cor(x, y, method = method, use = "complete.obs")
  null <- apply(perms, 2, function(p) cor(x[p], y, method = method, use = "complete.obs"))
  list(r = r, p = (1 + sum(abs(null) >= abs(r))) / (1 + length(null)), null = null)
}

#' Degree-preserving rewiring (Maslov & Sneppen 2002; weights travel with
#' edges, as BCT randmio_und). iter = swap attempts per edge.
rewire_degree <- function(W, iter = 10) {
  rewire_cpp(unname(as.matrix(W)), as.integer(iter), matrix(0, 1, 1), numeric(0), FALSE)
}

#' Degree- and geometry-preserving rewiring: a swap is accepted only if each
#' new edge stays in the same edge-length bin as the edge whose weight it
#' takes, so degree is kept exactly and the edge-length distribution and the
#' weight-length relationship approximately (in the spirit of Betzel & Bassett
#' 2018 PNAS and Roberts et al. 2016 NeuroImage).
rewire_geometry <- function(W, Dist, nbins = 20, iter = 50) {
  W <- unname(as.matrix(W)); Dist <- unname(as.matrix(Dist))
  len <- Dist[upper.tri(Dist) & W > 0]
  br <- unique(quantile(len, probs = seq(0, 1, length.out = nbins + 1), names = FALSE))
  br[1] <- -Inf
  rewire_cpp(W, as.integer(iter), Dist, br[-length(br)], TRUE)
}

#' Fraction of edges of W1 that are absent in W2 (how far rewiring moved).
edge_turnover <- function(W1, W2) {
  e1 <- W1[upper.tri(W1)] != 0; e2 <- W2[upper.tri(W2)] != 0
  sum(e1 & !e2) / sum(e1)
}
