# Network communication models on a weighted structural connectome.
#
# Written in package form (roxygen) so the functions can be moved into
# connectomeR (R/communication.R) once its source is available. Until then they
# live in this project and are validated against bctpy / netneurotools
# (validation/validate_communication.R). C++ kernels: src/netcpp.cpp.
#
# Conventions: W is a symmetric, non-negative weight matrix with zero diagonal.
# Lengths are 1 / W (BCT "inv" transform). Every function returns an n x n
# matrix with zero diagonal in which larger values mean easier communication,
# except search_information(), which returns bits (larger = harder) and is
# turned into a probability by comm_search_probability().

.check_W <- function(W) {
  W <- unname(as.matrix(W))
  if (nrow(W) != ncol(W)) stop("W must be square")
  if (any(!is.finite(W))) stop("W has non-finite entries")
  if (any(W < 0)) stop("W has negative entries; set them to 0 first")
  if (!isSymmetric(W)) stop("W must be symmetric")
  diag(W) <- 0
  W
}

#' Edge lengths from weights (BCT 'inv' transform): L = 1/W, 0 where W = 0.
weights_to_lengths <- function(W) {
  L <- W
  L[W > 0] <- 1 / W[W > 0]
  L
}

#' Weighted shortest-path lengths (Floyd-Warshall on L = 1/W).
#' @return list(D = path lengths, hops, next = next-hop matrix, 1-based)
shortest_paths <- function(W) {
  W <- .check_W(W)
  fw <- floyd_warshall_cpp(weights_to_lengths(W))
  nx <- fw$nexthop
  nx[nx >= 0] <- nx[nx >= 0] + 1L
  list(D = fw$D, hops = fw$hops, next_hop = nx, next0 = fw$nexthop)
}

#' Shortest-path efficiency: E_ij = 1 / (weighted shortest-path length).
#' @param W symmetric non-negative weight matrix
#' @return n x n matrix, zero diagonal (0 for unreachable pairs)
comm_spe <- function(W) {
  D <- shortest_paths(W)$D
  E <- 1 / D
  E[!is.finite(E)] <- 0
  diag(E) <- 0
  E
}

#' Weighted communicability (Crofts & Higham 2009): expm(S^-1/2 W S^-1/2),
#' S = diag(strength). Diagonal set to 0, as in netneurotools.
comm_communicability <- function(W) {
  W <- .check_W(W)
  s <- rowSums(W)
  if (any(s == 0)) stop("isolated nodes: communicability normalisation undefined")
  Dm <- diag(1 / sqrt(s))
  C <- expm::expm(Dm %*% W %*% Dm)
  diag(C) <- 0
  unname(C)
}

#' Search information (Goni et al. 2014), no memory, in bits.
#' SI_ij = -log2 of the probability that a random walker starting at i follows
#' the weighted shortest path to j, with transition matrix T = W / strength.
#' Asymmetric. Diagonal 0; unreachable pairs Inf.
search_information <- function(W) {
  W <- .check_W(W)
  T <- W / rowSums(W)
  sp <- shortest_paths(W)
  search_information_cpp(T, sp$next0)
}

#' Shortest-path probability 2^-SI, symmetrised as the mean of both directions.
comm_search_probability <- function(W) {
  P <- 2^(-search_information(W))
  P <- (P + t(P)) / 2
  diag(P) <- 0
  P
}

#' Greedy navigation (Seguin et al. 2018), replicating bctpy navigation_wu.
#' @param W weights; @param Dist inter-node Euclidean distance matrix (mm)
#' @param max_hops maximum number of hops (default n, as bctpy)
#' @return list(success_ratio, PL_bin, PL_wei, PL_dis); failed paths are Inf/NA
navigation <- function(W, Dist, max_hops = nrow(W)) {
  W <- .check_W(W)
  navigation_cpp(weights_to_lengths(W), unname(as.matrix(Dist)), as.integer(max_hops))
}

#' Navigation efficiency: 1 / navigation path length (sum of 1/w along the
#' greedy path); 0 for failed paths. Symmetrised as the mean of both directions.
comm_navigation <- function(W, Dist) {
  nv <- navigation(W, Dist)
  E <- 1 / nv$PL_wei
  E[!is.finite(E)] <- 0
  E <- (E + t(E)) / 2
  diag(E) <- 0
  attr(E, "success_ratio") <- nv$success_ratio
  E
}

#' Mean first passage time of a random walk with T = W / strength
#' (Kemeny & Snell fundamental matrix; as BCT mean_first_passage_time).
mean_first_passage_time <- function(W) {
  W <- .check_W(W)
  n <- nrow(W)
  P <- W / rowSums(W)
  w <- rowSums(W) / sum(W) # stationary distribution of an undirected walk
  Z <- solve(diag(n) - P + matrix(1, n, 1) %*% matrix(w, 1, n))
  M <- (matrix(diag(Z), n, n, byrow = TRUE) - Z) / matrix(w, n, n, byrow = TRUE)
  diag(M) <- 0
  M
}

#' Diffusion efficiency (Goni et al. 2013): 1 / MFPT, symmetrised.
comm_diffusion <- function(W) {
  E <- 1 / mean_first_passage_time(W)
  E[!is.finite(E)] <- 0
  E <- (E + t(E)) / 2
  diag(E) <- 0
  E
}

#' Distance-only kernel exp(-d / lambda) (no connectome).
comm_distance <- function(Dist, lambda) {
  K <- exp(-unname(as.matrix(Dist)) / lambda)
  diag(K) <- 0
  K
}

#' Euclidean distance matrix between parcel centroids (n x 3 coordinates).
centroid_distance <- function(xyz) unname(as.matrix(dist(xyz)))

#' Network-weighted prediction of a nodal map:
#' P_i = sum_{j != i} M_ij a_j / sum_{j != i} M_ij.
#' `a` may be a vector or a matrix (one column per map or per permutation).
predict_from_model <- function(M, a) {
  diag(M) <- 0
  rs <- rowSums(M)
  if (any(rs == 0)) warning(sum(rs == 0), " node(s) with no model weight; prediction NA")
  P <- (M %*% as.matrix(a)) / rs
  P[rs == 0, ] <- NA
  if (is.null(dim(a))) drop(P) else P
}

#' All structural communication models for one connectome.
#' @return named list of n x n matrices (larger = easier communication)
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
