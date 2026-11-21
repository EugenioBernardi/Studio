# Spatial-autocorrelation-preserving surrogates that work from a distance
# matrix (so they also apply to volumetric/subcortical parcels, unlike spins).
#
# 1. Variogram-matched surrogates: an R implementation of the BrainSMASH
#    "Base" algorithm (Burt et al. 2020 NeuroImage 220:117038), defaults as in
#    brainsmash: deltas 0.1..0.9, nh = 25 bins, pv = 25th distance percentile,
#    exponential kernel, Gaussian variogram smoothing with b = 3 * bin width,
#    surrogates rank-matched to the empirical values (resample = TRUE).
# 2. Moran spectral randomisation (Wagner & Dadi 2014 Methods Ecol Evol;
#    BrainSpace "singleton" procedure) with inverse-distance weights.

.variogram_setup <- function(Dist, pv = 25, nh = 25) {
  ut <- which(upper.tri(Dist))
  dd <- Dist[ut]
  keep <- dd <= quantile(dd, pv / 100)
  u <- dd[keep]
  h <- seq(min(u), max(u), length.out = nh)
  b <- 3 * (h[2] - h[1])
  Wh <- exp(-(2.68349 * outer(h, u, "-") / b)^2 / 2)
  Wh <- Wh / rowSums(Wh)
  ij <- arrayInd(ut[keep], dim(Dist))
  list(i = ij[, 1], j = ij[, 2], Wh = Wh, h = h)
}
# smoothed variogram(s) of the columns of X: nh x ncol
variogram <- function(X, vs) {
  X <- as.matrix(X)
  vs$Wh %*% (0.5 * (X[vs$i, , drop = FALSE] - X[vs$j, , drop = FALSE])^2)
}

variogram_surrogates <- function(x, Dist, n = 1000, seed = 1, deltas = seq(0.1, 0.9, 0.1),
                                 pv = 25, nh = 25, resample = TRUE, chunk = 250) {
  set.seed(seed)
  N <- length(x)
  vs <- .variogram_setup(Dist, pv, nh)
  gx <- drop(variogram(x, vs))
  # smoothing operators, one per delta: exponential kernel over the k nearest neighbours
  ord <- t(apply(Dist, 1, order))
  S <- lapply(deltas, function(dl) {
    k <- max(2, as.integer(dl * N))
    Sm <- matrix(0, N, N)
    for (i in seq_len(N)) {
      nb <- ord[i, seq_len(k)]
      dn <- Dist[i, nb]; w <- exp(-dn / max(dn))
      Sm[i, nb] <- w / sum(w)
    }
    Sm
  })
  out <- matrix(NA_real_, N, n)
  done <- 0
  while (done < n) {
    m <- min(chunk, n - done)
    Xp <- vapply(seq_len(m), function(z) sample(x), numeric(N))
    best_sse <- rep(Inf, m); best <- matrix(NA_real_, N, m)
    for (s in seq_along(S)) {
      Xs <- S[[s]] %*% Xp
      G <- variogram(Xs, vs)
      # per surrogate least squares: gx ~ alpha * g + beta
      gm <- colMeans(G); gxm <- mean(gx)
      alpha <- colSums((G - rep(gm, each = nh)) * (gx - gxm)) / colSums((G - rep(gm, each = nh))^2)
      beta <- gxm - alpha * gm
      sse <- colSums((gx - (G * rep(alpha, each = nh) + rep(beta, each = nh)))^2)
      better <- sse < best_sse
      if (any(better)) {
        z <- matrix(rnorm(N * sum(better)), N)
        best[, better] <- Xs[, better, drop = FALSE] * rep(sqrt(abs(alpha[better])), each = N) + z * rep(sqrt(abs(beta[better])), each = N)
        best_sse[better] <- sse[better]
      }
    }
    if (resample) best <- apply(best, 2, function(y) sort(x)[rank(y, ties.method = "first")])
    out[, done + seq_len(m)] <- best
    done <- done + m
  }
  attr(out, "variogram_empirical") <- gx
  attr(out, "variogram_h") <- vs$h
  attr(out, "variogram_surrogates_mean") <- rowMeans(variogram(out[, seq_len(min(n, 200)), drop = FALSE], vs))
  out
}

moran_surrogates <- function(x, Dist, n = 1000, seed = 1) {
  set.seed(seed)
  N <- length(x)
  Wt <- 1 / Dist; diag(Wt) <- 0
  C <- diag(N) - 1 / N
  e <- eigen(C %*% Wt %*% C, symmetric = TRUE)
  V <- e$vectors[, abs(e$values) > 1e-10 * max(abs(e$values)), drop = FALSE]
  coef <- drop(crossprod(V, x - mean(x)))
  signs <- matrix(sample(c(-1, 1), length(coef) * n, replace = TRUE), length(coef))
  out <- mean(x) + V %*% (coef * signs)
  attr(out, "moran_I") <- function(y) { yc <- y - mean(y); N / sum(Wt) * sum(Wt * outer(yc, yc)) / sum(yc^2) }
  out
}
