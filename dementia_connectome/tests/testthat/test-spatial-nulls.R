set.seed(5)
n <- 120
xyz <- matrix(runif(n * 3, 0, 100), n, 3)
Dm <- as.matrix(dist(xyz)); dimnames(Dm) <- NULL
# smooth map: sum of two Gaussian bumps + noise
x <- exp(-rowSums(sweep(xyz, 2, c(30, 30, 30))^2) / 800) + exp(-rowSums(sweep(xyz, 2, c(70, 60, 50))^2) / 1200) + rnorm(n, 0, 0.05)

test_that("Moran spectral randomisation preserves mean, variance and Moran's I exactly", {
  S <- moran_surrogates(x, Dm, n = 20, seed = 1)
  mI <- attr(S, "moran_I")
  expect_equal(colMeans(S), rep(mean(x), 20))
  expect_equal(apply(S, 2, var), rep(var(x), 20))
  expect_equal(apply(S, 2, mI), rep(mI(x), 20))
  expect_false(isTRUE(all.equal(S[, 1], x)))
})

test_that("variogram surrogates keep the value distribution and approximate the variogram", {
  S <- variogram_surrogates(x, Dm, n = 50, seed = 2)
  expect_true(all(apply(S, 2, function(s) isTRUE(all.equal(sort(s), sort(x))))))
  g <- attr(S, "variogram_empirical"); gs <- attr(S, "variogram_surrogates_mean")
  expect_gt(cor(g, gs), 0.8)
  # surrogates are smoother than plain permutations of x
  vs <- .variogram_setup(Dm)
  gp <- rowMeans(variogram(replicate(50, sample(x)), vs))
  expect_lt(mean(abs(gs - g)), mean(abs(gp - g)))
})

test_that("Laplacian heat kernel and reconstruction behave as defined", {
  source_if <- function(f) if (!exists("laplacian_modes")) source(f)
  owd <- setwd(proj); source_if("R/analysis.R"); setwd(owd)
  W <- matrix(0, 4, 4); W[1, 2] <- W[2, 1] <- W[2, 3] <- W[3, 2] <- W[3, 4] <- W[4, 3] <- 1
  md <- laplacian_modes(W)
  expect_equal(md$values[1], 0, tolerance = 1e-12)
  expect_equal(heat_kernel(md, 0), diag(4), tolerance = 1e-12)
  A <- cbind(rnorm(4), rnorm(4))
  expect_equal(unname(recon_curve(md$vectors, A, Ks = 4)[, 1]), c(1, 1), tolerance = 1e-12)
})
