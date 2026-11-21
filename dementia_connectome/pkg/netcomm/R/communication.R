# Network communication models on a weighted structural connectome.
#
# Written to be merged into connectomeR (R/communication.R, version 0.3.0).
# Validated against bctpy 0.6.1 and netneurotools 0.3.0 on the HCP
# Schaefer-400 structural connectome (see the analysis project's validation/).
#
# Conventions: W is a symmetric, non-negative weight matrix (diagonal ignored).
# Edge lengths are 1 / W (the Brain Connectivity Toolbox "inv" transform).
# Functions named comm_*() return an n x n matrix with zero diagonal in which
# larger values mean easier communication.

#' @useDynLib netcomm, .registration = TRUE
#' @importFrom Rcpp sourceCpp
NULL

.check_W <- function(W) {
  W <- unname(as.matrix(W))
  if (nrow(W) != ncol(W)) stop("W must be square")
  if (any(!is.finite(W))) stop("W has non-finite entries")
  if (any(W < 0)) stop("W has negative entries; set them to 0 first")
  if (!isSymmetric(W)) stop("W must be symmetric")
  diag(W) <- 0
  W
}

#' Edge lengths from weights
#'
#' BCT "inv" transform: L = 1 / W for W > 0, and 0 (no edge) elsewhere.
#' @param W non-negative weight matrix.
#' @return matrix of edge lengths.
#' @export
weights_to_lengths <- function(W) {
  L <- W
  L[W > 0] <- 1 / W[W > 0]
  L
}

#' Weighted shortest paths
#'
#' All-pairs shortest paths (Floyd-Warshall) on lengths L = 1 / W, as
#' `bct.distance_wei_floyd`.
#' @param W symmetric non-negative weight matrix.
#' @return list with `D` (path lengths), `hops` (edges per path) and
#'   `next_hop` (1-based index of the first node after i on a shortest path to
#'   j; -1 if none).
#' @export
#' @examples
#' W <- matrix(c(0, 2, 0, 2, 0, 1, 0, 1, 0), 3, 3)
#' shortest_paths(W)$D
shortest_paths <- function(W) {
  W <- .check_W(W)
  fw <- floyd_warshall_cpp(weights_to_lengths(W))
  nx <- fw$nexthop
  nx[nx >= 0] <- nx[nx >= 0] + 1L
  list(D = fw$D, hops = fw$hops, next_hop = nx, next0 = fw$nexthop)
}

#' Shortest-path efficiency
#'
#' E_ij = 1 / (weighted shortest-path length), lengths 1 / w.
#' @param W symmetric non-negative weight matrix.
#' @return n x n matrix, zero diagonal; 0 for unreachable pairs.
#' @export
#' @examples
#' W <- matrix(c(0, 2, 0, 2, 0, 1, 0, 1, 0), 3, 3)
#' comm_spe(W)
comm_spe <- function(W) {
  D <- shortest_paths(W)$D
  E <- 1 / D
  E[!is.finite(E)] <- 0
  diag(E) <- 0
  E
}

#' Weighted communicability
#'
#' Crofts & Higham (2009): expm(S^-1/2 W S^-1/2) with S = diag(strength).
#' The diagonal is set to 0, as in `netneurotools.metrics.communicability_wei`.
#' @param W symmetric non-negative weight matrix without isolated nodes.
#' @return n x n matrix, zero diagonal.
#' @references Crofts JJ, Higham DJ (2009) J R Soc Interface 6:411-414.
#' @export
#' @examples
#' comm_communicability(matrix(c(0, 3, 3, 0), 2))  # off-diagonal = sinh(1)
comm_communicability <- function(W) {
  W <- .check_W(W)
  s <- rowSums(W)
  if (any(s == 0)) stop("isolated nodes: communicability normalisation undefined")
  Dm <- diag(1 / sqrt(s))
  C <- expm::expm(Dm %*% W %*% Dm)
  diag(C) <- 0
  unname(as.matrix(C))
}

#' Search information
#'
#' Goni et al. (2014), without memory: SI_ij = -log2 of the probability that a
#' random walker at i follows the weighted shortest path to j, with transition
#' matrix T = W / strength. Matches `bct.search_information(W, "inv")`.
#' @param W symmetric non-negative weight matrix.
#' @return asymmetric n x n matrix in bits; diagonal 0, unreachable pairs `Inf`.
#' @references Goni J et al. (2014) PNAS 111:833-838.
#' @export
#' @examples
#' W <- matrix(c(0, 1, 0, 1, 0, 1, 0, 1, 0), 3, 3)
#' search_information(W)
search_information <- function(W) {
  W <- .check_W(W)
  T <- W / rowSums(W)
  sp <- shortest_paths(W)
  search_information_cpp(T, sp$next0)
}

#' Shortest-path probability from search information
#'
#' 2^-SI, symmetrised as the mean of both directions.
#' @inheritParams search_information
#' @return symmetric n x n matrix, zero diagonal.
#' @export
comm_search_probability <- function(W) {
  P <- 2^(-search_information(W))
  P <- (P + t(P)) / 2
  diag(P) <- 0
  P
}

#' Greedy navigation
#'
#' Seguin et al. (2018): from the current node, move to the neighbour closest
#' (in `Dist`) to the target; the path fails if that neighbour is the node just
#' left or the hop count exceeds `max_hops`. Replicates `bct.navigation_wu`.
#' @param W symmetric non-negative weight matrix.
#' @param Dist n x n distance matrix (e.g. Euclidean distance between centroids).
#' @param max_hops maximum number of hops (default n, as bctpy).
#' @return list with `success_ratio`, `PL_bin` (hops), `PL_wei` (sum of 1/w along
#'   the path) and `PL_dis` (sum of `Dist` along the path); failed paths are
#'   `NA` / `Inf`.
#' @references Seguin C, van den Heuvel MP, Zalesky A (2018) PNAS 115:6297-6302.
#' @export
navigation <- function(W, Dist, max_hops = nrow(W)) {
  W <- .check_W(W)
  navigation_cpp(weights_to_lengths(W), unname(as.matrix(Dist)), as.integer(max_hops))
}

#' Navigation efficiency
#'
#' 1 / navigation path length (sum of 1/w along the greedy path); 0 for failed
#' paths; symmetrised as the mean of both directions.
#' @inheritParams navigation
#' @return symmetric n x n matrix, zero diagonal, with attribute `success_ratio`.
#' @export
comm_navigation <- function(W, Dist) {
  nv <- navigation(W, Dist)
  E <- 1 / nv$PL_wei
  E[!is.finite(E)] <- 0
  E <- (E + t(E)) / 2
  diag(E) <- 0
  attr(E, "success_ratio") <- nv$success_ratio
  E
}

#' Mean first passage time
#'
#' Random walk with T = W / strength; Kemeny-Snell fundamental matrix, as
#' `bct.mean_first_passage_time`.
#' @param W symmetric non-negative weight matrix (connected).
#' @return asymmetric n x n matrix, zero diagonal.
#' @export
#' @examples
#' mean_first_passage_time(matrix(c(0, 1, 0, 1, 0, 1, 0, 1, 0), 3, 3))
mean_first_passage_time <- function(W) {
  W <- .check_W(W)
  n <- nrow(W)
  P <- W / rowSums(W)
  w <- rowSums(W) / sum(W)
  Z <- solve(diag(n) - P + matrix(1, n, 1) %*% matrix(w, 1, n))
  M <- (matrix(diag(Z), n, n, byrow = TRUE) - Z) / matrix(w, n, n, byrow = TRUE)
  diag(M) <- 0
  M
}

#' Diffusion efficiency
#'
#' Goni et al. (2013): 1 / mean first passage time, symmetrised. Note: on large
#' graphs the MFPT to j is dominated by j's stationary probability (strength),
#' so this measure is close to a function of node strength.
#' @inheritParams mean_first_passage_time
#' @return symmetric n x n matrix, zero diagonal.
#' @references Goni J et al. (2013) PLoS One 8:e58070.
#' @export
comm_diffusion <- function(W) {
  E <- 1 / mean_first_passage_time(W)
  E[!is.finite(E)] <- 0
  E <- (E + t(E)) / 2
  diag(E) <- 0
  E
}

#' Distance-only kernel
#'
#' exp(-d / lambda), with no connectome information.
#' @param Dist n x n distance matrix.
#' @param lambda length scale (same unit as `Dist`).
#' @return n x n matrix, zero diagonal.
#' @export
comm_distance <- function(Dist, lambda) {
  K <- exp(-unname(as.matrix(Dist)) / lambda)
  diag(K) <- 0
  K
}

#' Euclidean distance matrix between centroids
#' @param xyz n x 3 matrix or data frame of coordinates.
#' @return n x n distance matrix.
#' @export
centroid_distance <- function(xyz) unname(as.matrix(stats::dist(xyz)))

#' Network-weighted prediction of a nodal map
#'
#' P_i = sum_{j != i} M_ij a_j / sum_{j != i} M_ij. With M = W this is the
#' "neighbour atrophy" of Zeighami et al. (2015) and Shafiei et al. (2023).
#' @param M n x n non-negative model matrix.
#' @param a numeric vector of length n, or an n x k matrix (one map per column).
#' @return vector or matrix of predictions; `NA` for nodes with no model weight.
#' @export
#' @examples
#' M <- matrix(c(0, 1, 1, 1, 0, 0, 1, 0, 0), 3, 3)
#' predict_from_model(M, c(1, 2, 4))
predict_from_model <- function(M, a) {
  diag(M) <- 0
  rs <- rowSums(M)
  if (any(rs == 0)) warning(sum(rs == 0), " node(s) with no model weight; prediction NA")
  P <- (M %*% as.matrix(a)) / rs
  P[rs == 0, ] <- NA
  if (is.null(dim(a))) drop(P) else P
}

#' All structural communication models for one connectome
#' @param W symmetric non-negative weight matrix.
#' @param Dist n x n distance matrix (for navigation).
#' @return named list of n x n matrices: `SC_direct`, `SPE`, `communicability`,
#'   `search_prob`, `navigation`, `diffusion`.
#' @export
communication_models <- function(W, Dist) {
  list(
    SC_direct = .check_W(W),
    SPE = comm_spe(W),
    communicability = comm_communicability(W),
    search_prob = comm_search_probability(W),
    navigation = comm_navigation(W, Dist),
    diffusion = comm_diffusion(W)
  )
}
