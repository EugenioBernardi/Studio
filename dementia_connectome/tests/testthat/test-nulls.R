set.seed(11)
n <- 30
W <- matrix(0, n, n); up <- which(upper.tri(W))
W[sample(up, 120)] <- runif(120, 0.1, 3); W <- W + t(W)
xyz <- matrix(rnorm(n * 3), n, 3)
Dm <- as.matrix(dist(xyz)); dimnames(Dm) <- NULL

test_that("degree-preserving rewiring keeps degrees, weights and symmetry", {
  R <- rewire_degree(W, iter = 20)
  expect_true(isSymmetric(R))
  expect_equal(rowSums(R != 0), rowSums(W != 0))
  expect_equal(sort(R[upper.tri(R)][R[upper.tri(R)] != 0]), sort(W[upper.tri(W)][W[upper.tri(W)] != 0]))
  expect_gt(edge_turnover(W, R), 0.5)
  expect_equal(diag(R), rep(0, n))
})

test_that("geometry-preserving rewiring keeps degrees and edge-length bins", {
  R <- rewire_geometry(W, Dm, nbins = 5, iter = 50)
  expect_equal(rowSums(R != 0), rowSums(W != 0))
  expect_true(isSymmetric(R))
  br <- quantile(Dm[upper.tri(Dm) & W > 0], seq(0, 1, length.out = 6))
  b1 <- table(cut(Dm[upper.tri(Dm) & W > 0], br, include.lowest = TRUE))
  b2 <- table(cut(Dm[upper.tri(Dm) & R > 0], c(-Inf, br[-c(1, 6)], Inf)))
  expect_equal(as.vector(b1), as.vector(b2))
})

test_that("spin permutations are hemisphere-respecting permutations", {
  sph <- matrix(rnorm(40 * 3), 40, 3); sph <- 100 * sph / sqrt(rowSums(sph^2))
  hemi <- rep(c("LH", "RH"), each = 20)
  P <- spin_permutations(sph, hemi, n_perm = 25, seed = 3)
  expect_true(all(apply(P, 2, function(p) setequal(p, 1:40))))
  expect_true(all(P[1:20, ] <= 20) && all(P[21:40, ] > 20))
  expect_identical(P, spin_permutations(sph, hemi, n_perm = 25, seed = 3)) # seeded
})

test_that("random rotations are proper rotations", {
  R <- random_rotation()
  expect_equal(crossprod(R), diag(3), tolerance = 1e-10)
  expect_equal(det(R), 1, tolerance = 1e-10)
})
