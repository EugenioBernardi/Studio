# Project-level analysis helpers (R/analysis.R). Run from the project root:
# Rscript -e 'testthat::test_dir("tests/testthat")'
owd <- setwd(file.path("..", "..")); source("R/setup.R"); source("R/analysis.R"); setwd(owd)

test_that("Laplacian heat kernel and reconstruction behave as defined", {
  W <- matrix(0, 4, 4); W[1, 2] <- W[2, 1] <- W[2, 3] <- W[3, 2] <- W[3, 4] <- W[4, 3] <- 1
  md <- laplacian_modes(W)
  expect_equal(md$values[1], 0, tolerance = 1e-12)
  expect_equal(heat_kernel(md, 0), diag(4), tolerance = 1e-12)
  A <- cbind(rnorm(4), rnorm(4))
  expect_equal(unname(recon_curve(md$vectors, A, Ks = 4)[, 1]), c(1, 1), tolerance = 1e-12)
})

test_that("model_r drops nodes without model weight and family_r picks the best kernel", {
  set.seed(3)
  xyz <- matrix(runif(60), 20, 3); Dm <- as.matrix(dist(xyz)); dimnames(Dm) <- NULL
  a <- xyz[, 1] + rnorm(20, 0, 0.05)
  M <- comm_distance(Dm, 0.2); M[1, ] <- 0; M[, 1] <- 0
  r <- model_r(M, cbind(a))
  expect_equal(attr(r, "n_dropped"), 1L)
  f <- family_r(list(comm_distance(Dm, 0.01), comm_distance(Dm, 0.2), comm_distance(Dm, 100)), cbind(a))
  expect_equal(f$r, max(sapply(c(0.01, 0.2, 100), function(l) model_r(comm_distance(Dm, l), cbind(a)))))
})

test_that("censoring removes pairs within the radius", {
  Dm <- as.matrix(dist(c(0, 5, 20))); M <- matrix(1, 3, 3)
  C <- censor(M, Dm, 10)
  expect_equal(C[1, 2], 0); expect_equal(C[1, 3], 1); expect_equal(diag(C), rep(0, 3))
})
