# Step 2 analysis engine: similarity, hub susceptibility, network-constrained
# atrophy, epicentres, communication models, plus nulls. Heavy null loops are
# cached in output/cache/ by scripts/02_run_nulls.R.

model_names <- c("SC_direct", "SPE", "communicability", "search_prob", "navigation", "diffusion")
model_labels <- c(SC_direct = "SC (direct)", SPE = "Shortest-path eff.", communicability = "Communicability",
                  search_prob = "Search info. (2^-SI)", navigation = "Navigation eff.", diffusion = "Diffusion eff. (1/MFPT)",
                  heat = "Network diffusion kernel", distance = "Distance only", FC = "FC (positive)")
lambda_grid <- exp(seq(log(2), log(200), length.out = 40))  # mm, distance kernel exp(-d / lambda)
beta_grid <- exp(seq(log(0.1), log(100), length.out = 25))  # heat kernel expm(-beta L)
gamma_grid <- c(0.25, 0.5, 1, 2, 4, 8)                      # tuned power M^gamma
exclusion_radii <- c(0, 10, 20, 30, 40, 60)                  # mm

prep_resolution <- function(k) {
  info <- read_schaefer_labels(k)
  atro <- read.csv(sprintf("data/parcellated_atrophy_schaefer%d.csv", k))
  stopifnot(identical(atro$label, info$label), all(atro$included))
  A <- as.matrix(atro[, names(syndromes)])
  SC <- zero_negative(load_connectome(k, "SC")); n_neg <- attr(SC, "n_negative_edges")
  SC <- unclass(SC); attr(SC, "n_negative_edges") <- NULL
  FC <- load_connectome(k, "FC"); FC[FC < 0] <- 0
  sph <- read.csv(sprintf("data/sphere_centroids_schaefer%d.csv", k))
  stopifnot(identical(sph$label, info$label))
  list(k = k, info = info, A = A, SC = SC, FC = FC, n_negative_sc = n_neg,
       Dist = centroid_distance(info[, c("mni_x", "mni_y", "mni_z")]),
       sph = as.matrix(sph[, c("x", "y", "z")]), hemi = toupper(sph$hemi))
}

# column-wise Pearson correlation between matching columns of X and Y
colcor <- function(X, Y) {
  X <- sweep(X, 2, colMeans(X)); Y <- sweep(Y, 2, colMeans(Y))
  colSums(X * Y) / sqrt(colSums(X^2) * colSums(Y^2))
}

# restrict a model to pairs further apart than R mm (row-normalisation follows)
censor <- function(M, Dist, R) { if (R > 0) M[Dist <= R] <- 0; diag(M) <- 0; M }

# r(a, P_M) for each column of A (maps or spun surrogates). Nodes with no
# model weight (e.g. no SC edge beyond the exclusion radius) are dropped;
# the number dropped is attached as attribute "n_dropped".
model_r <- function(M, A) {
  P <- suppressWarnings(predict_from_model(M, A))
  P <- as.matrix(P); ok <- is.finite(P[, 1])
  r <- if (sum(ok) < 10) rep(NA_real_, ncol(A)) else colcor(A[ok, , drop = FALSE], P[ok, , drop = FALSE])
  attr(r, "n_dropped") <- sum(!ok)
  r
}

# best r over a family of kernels (one fitted parameter), per column of A
family_r <- function(Ms, A) {
  rr <- vapply(Ms, function(M) model_r(M, A), numeric(ncol(A)))
  rr <- matrix(rr, nrow = ncol(A))
  best <- max.col(replace(rr, !is.finite(rr), -Inf), ties.method = "first")
  list(r = rr[cbind(seq_len(nrow(rr)), best)], param = best)
}

# eigen-decomposition of the normalised Laplacian of W
norm_laplacian <- function(W) { s <- rowSums(W); diag(nrow(W)) - W / sqrt(outer(s, s)) }
laplacian_modes <- function(W) {
  e <- eigen(norm_laplacian(W), symmetric = TRUE)
  o <- order(e$values); list(values = e$values[o], vectors = e$vectors[, o])
}
heat_kernel <- function(modes, beta) {
  H <- modes$vectors %*% (exp(-beta * modes$values) * t(modes$vectors))
  H[H < 0] <- 0 # tiny negative round-off only
  H
}

#' Fit every model at every exclusion radius.
#' @param models named list of raw model matrices (SC models; may include FC)
#' @param modes Laplacian modes of the SC used (for the heat kernel)
#' @param tuned also fit M^gamma for the SC communication models
#' @return data.frame(R, model, col, r, param); for raw models param = nodes dropped
fit_all <- function(models, modes, Dist, A, tuned = TRUE, Dist_kernel = Dist) {
  # Dist: Euclidean distances, used for censoring (exclusion radius) in every model;
  # Dist_kernel: distances for the distance-only kernel (Euclidean or geodesic).
  out <- list()
  add <- function(R, model, r, param = NA) out[[length(out) + 1]] <<- data.frame(R = R, model = model, col = seq_along(r), r = r, param = param)
  heat <- lapply(beta_grid, function(b) heat_kernel(modes, b))
  dk <- lapply(lambda_grid, function(l) comm_distance(Dist_kernel, l))
  for (R in exclusion_radii) {
    for (m in names(models)) { r <- model_r(censor(models[[m]], Dist, R), A); add(R, m, r, attr(r, "n_dropped")) }
    f <- family_r(lapply(dk, censor, Dist = Dist, R = R), A); add(R, "distance", f$r, lambda_grid[f$param])
    f <- family_r(lapply(heat, censor, Dist = Dist, R = R), A); add(R, "heat", f$r, beta_grid[f$param])
    if (tuned) for (m in intersect(model_names, names(models))) {
      f <- family_r(lapply(gamma_grid, function(g) censor(models[[m]]^g, Dist, R)), A)
      add(R, paste0(m, "_tuned"), f$r, gamma_grid[f$param])
    }
  }
  do.call(rbind, out)
}

# spun copies of one map: n x n_perm
spin_maps <- function(a, perms) matrix(a[perms], nrow = length(a))

p_two <- function(obs, null) (1 + sum(abs(null) >= abs(obs), na.rm = TRUE)) / (1 + sum(is.finite(null)))
p_upper <- function(obs, null) (1 + sum(null >= obs, na.rm = TRUE)) / (1 + sum(is.finite(null)))

# epicentre score: mean of the node's rank on atrophy and on neighbour atrophy
epicentre_score <- function(a, N) (rank(a) + rank(N)) / 2

# ---- graph signal processing --------------------------------------------------
harmonic_Ks <- c(5, 10, 20, 50, 100)
recon_curve <- function(B, A, Ks = harmonic_Ks) {
  sapply(Ks, function(K) { X <- B[, seq_len(K), drop = FALSE]; Q <- qr.Q(qr(X)); colcor(A, Q %*% crossprod(Q, A)) })
}
# normalised Dirichlet energy of z-scored maps on the graph (lower = smoother)
graph_smoothness <- function(W, A) { Az <- scale(A); colSums(Az * (norm_laplacian(W) %*% Az)) / colSums(Az^2) }

# ---- one rewired network --------------------------------------------------------
rewired_fits <- function(d, Wr) {
  M <- communication_models(Wr, d$Dist)
  md <- laplacian_modes(Wr)
  list(fits = fit_all(M, md, d$Dist, d$A, tuned = TRUE),
       N_sc = predict_from_model(Wr, d$A),
       smooth = graph_smoothness(Wr, d$A),
       recon = recon_curve(md$vectors, d$A))
}

# ---- A. similarity -----------------------------------------------------------
analysis_similarity <- function(d, perms) {
  syn <- colnames(d$A); pr <- t(combn(syn, 2))
  out <- do.call(rbind, lapply(seq_len(nrow(pr)), function(i) {
    x <- d$A[, pr[i, 1]]; y <- d$A[, pr[i, 2]]
    null <- colcor(spin_maps(x, perms), matrix(y, length(y), ncol(perms)))
    r <- cor(x, y)
    data.frame(map1 = pr[i, 1], map2 = pr[i, 2], r = r, p_spin = p_two(r, null))
  }))
  out$p_fdr <- p.adjust(out$p_spin, "BH")
  out
}

# ---- B. hub susceptibility -----------------------------------------------------
analysis_hubs <- function(d, perms) {
  st <- list(SC = rowSums(d$SC), FC = rowSums(d$FC))
  out <- do.call(rbind, lapply(names(st), function(m) do.call(rbind, lapply(colnames(d$A), function(s) {
    a <- d$A[, s]; r <- cor(st[[m]], a, method = "spearman")
    null <- apply(spin_maps(a, perms), 2, cor, y = st[[m]], method = "spearman")
    data.frame(matrix = m, syndrome = s, rho = r, p_spin = p_two(r, null))
  }))))
  out$p_fdr <- p.adjust(out$p_spin, "BH")
  out
}
