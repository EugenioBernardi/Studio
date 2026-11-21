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
  vs <- variogram_setup(Dm)
  gp <- rowMeans(variogram(replicate(50, sample(x)), vs))
  expect_lt(mean(abs(gs - g)), mean(abs(gp - g)))
})

