# Revision (v2): warped atlas, PD dropped, optional subcortex, Euclidean or
# geodesic distance kernel, generative diffusion from seeds.
syn_v2 <- c("AD", "MCI", "FTD", "bvFTD", "svPPA", "nfvPPA")

#' Configurations: ctx400_euc, ctx400_geo, sub414_euc, ctx100_euc, ctx200_euc
prep_v2 <- function(config) {
  k <- as.integer(sub("^(ctx|sub)([0-9]+)_.*$", "\\2", config)); with_sub <- startsWith(config, "sub")
  kc <- if (with_sub) 400L else k
  f <- if (with_sub) "data/v2/parcellated_atrophy_schaefer400_tian14.csv" else sprintf("data/v2/parcellated_atrophy_schaefer%d.csv", k)
  info <- read.csv(f)
  A <- as.matrix(info[, syn_v2])
  H <- "data-raw/ENIGMA/enigmatoolbox/datasets/matrices/hcp_connectivity"
  rd <- function(x) { X <- unname(as.matrix(read.csv(file.path(H, x), header = FALSE))); diag(X) <- 0; X }
  if (with_sub) {
    lab <- strsplit(readLines(file.path(H, "strucLabels_with_sctx_schaefer_400.csv"), warn = FALSE), ",")[[1]]
    stopifnot(identical(trimws(lab), info$label))
    SC <- rd("strucMatrix_with_sctx_schaefer_400.csv"); FC <- rd("funcMatrix_with_ctx_schaefer_400.csv")
  } else { SC <- load_connectome(k, "SC"); FC <- load_connectome(k, "FC") }
  n_neg <- sum(SC[upper.tri(SC)] < 0); SC[SC < 0] <- 0; FC[FC < 0] <- 0
  E <- centroid_distance(info[, c("x", "y", "z")])
  Dk <- E
  if (endsWith(config, "_geo")) { Dk <- unname(as.matrix(read.csv(sprintf("data/v2/geodesic_schaefer%d.csv", k), header = FALSE))) }
  sph <- read.csv(sprintf("data/sphere_centroids_schaefer%d.csv", kc))
  stopifnot(identical(sph$label, info$label[seq_len(kc)]))
  list(config = config, k = k, n = nrow(info), info = info, A = A, SC = SC, FC = FC, n_negative_sc = n_neg,
       Dist = E, Dist_kernel = Dk, cortex = seq_len(kc), sub = if (with_sub) kc + 1:14 else integer(0),
       sph = as.matrix(sph[, c("x", "y", "z")]), hemi = toupper(sph$hemi))
}

#' Spin permutations for cortex (Hungarian), random permutation of subcortical nodes
spins_v2 <- function(d, n_perm = 1000, seed = 1) {
  P <- spin_permutations(d$sph, d$hemi, n_perm = n_perm, seed = seed)
  if (length(d$sub)) {
    set.seed(seed + 7)
    Ps <- replicate(n_perm, sample(d$sub))
    P <- rbind(P, matrix(Ps, nrow = length(d$sub)))
  }
  P
}

# homologue of each node in the other hemisphere: nearest centroid to the mirrored centroid
homologue <- function(d) {
  xyz <- as.matrix(d$info[, c("x", "y", "z")]); mir <- xyz; mir[, 1] <- -mir[, 1]
  h <- ifelse(d$info$hemi == "LH", "RH", "LH")
  sapply(seq_len(d$n), function(i) { cand <- which(d$info$hemi == h[i] & d$info$structure == d$info$structure[i]); cand[which.min(colSums((t(xyz[cand, , drop = FALSE]) - mir[i, ])^2))] })
}

# ---- generative diffusion from seeds --------------------------------------------------
# A "profile" matrix P (n x s): column j = predicted map from seed configuration j.
# Seeds: every node alone (unilateral) and every node with its homologue (bilateral).
seed_matrix <- function(d) {
  hom <- homologue(d)
  X0 <- cbind(diag(d$n), diag(d$n) + diag(d$n)[, hom])
  attr(X0, "seed") <- c(seq_len(d$n), seq_len(d$n)); attr(X0, "bilateral") <- rep(c(FALSE, TRUE), each = d$n)
  X0
}
t_grid <- exp(seq(log(0.05), log(50), length.out = 25))
ndm_profiles <- function(W, X0, ts = t_grid) {
  md <- laplacian_modes(W); Vt <- crossprod(md$vectors, X0)
  lapply(ts, function(t) md$vectors %*% (exp(-t * md$values) * Vt))
}
spatial_profiles <- function(Dist, X0, lambdas = lambda_grid) {
  lapply(lambdas, function(l) { K <- exp(-Dist / l); K[!is.finite(K)] <- 0; K %*% X0 })
}
# best seed and parameter per map: r, profile index, seed column
best_seed_fit <- function(profiles, A) {
  Az <- scale(A)
  best <- rep(-Inf, ncol(A)); bp <- bj <- integer(ncol(A))
  for (p in seq_along(profiles)) {
    Pz <- scale(profiles[[p]]); Pz[!is.finite(Pz)] <- 0
    C <- crossprod(Pz, Az) / (nrow(A) - 1)       # seeds x maps
    j <- max.col(t(C), ties.method = "first"); v <- C[cbind(j, seq_len(ncol(A)))]
    up <- v > best; best[up] <- v[up]; bp[up] <- p; bj[up] <- j[up]
  }
  list(r = best, param = bp, seedcol = bj)
}
generative_fits <- function(d, A, W_sc = d$SC, X0 = seed_matrix(d)) {
  prof <- list(NDM_SC = ndm_profiles(W_sc, X0), NDM_FC = ndm_profiles(d$FC, X0),
               spread_euclid = spatial_profiles(d$Dist, X0))
  if (!identical(d$Dist_kernel, d$Dist)) prof$spread_geodesic <- spatial_profiles(d$Dist_kernel, X0)
  out <- lapply(names(prof), function(m) { f <- best_seed_fit(prof[[m]], A)
    data.frame(model = m, col = seq_len(ncol(A)), r = f$r, param = f$param, seed = attr(X0, "seed")[f$seedcol], bilateral = attr(X0, "bilateral")[f$seedcol]) })
  do.call(rbind, out)
}
