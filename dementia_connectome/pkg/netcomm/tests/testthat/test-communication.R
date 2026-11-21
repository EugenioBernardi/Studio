path3 <- matrix(c(0, 2, 0,
                  2, 0, 1,
                  0, 1, 0), 3, 3, byrow = TRUE)

test_that("shortest-path efficiency matches a hand-computed path graph", {
  E <- comm_spe(path3)
  expect_equal(E[1, 2], 2)           # 1 / (1/2)
  expect_equal(E[1, 3], 1 / 1.5)     # 1 / (1/2 + 1/1)
  expect_equal(diag(E), rep(0, 3))
  expect_true(isSymmetric(E))
})

test_that("communicability of a single edge is sinh(1)", {
  W <- matrix(c(0, 3, 3, 0), 2, 2)
  C <- comm_communicability(W)
  expect_equal(C[1, 2], sinh(1))
  expect_equal(diag(C), c(0, 0))
})

test_that("search information follows the transition probabilities", {
  W <- matrix(c(0, 1, 0, 1, 0, 1, 0, 1, 0), 3, 3)
  SI <- search_information(W)
  expect_equal(SI[1, 2], 0)          # node 1 has one neighbour: p = 1
  expect_equal(SI[1, 3], 1)          # 1 -> 2 (p = 1), 2 -> 3 (p = 1/2)
  expect_equal(SI[2, 1], 1)          # node 2 has two neighbours
  expect_equal(comm_search_probability(W)[1, 3], 0.5)
})

test_that("mean first passage time is 1 on a two-node graph and matches theory on a path", {
  expect_equal(mean_first_passage_time(matrix(c(0, 1, 1, 0), 2))[1, 2], 1)
  # unweighted 3-node path: from an end to the far end takes 4 steps on average
  W <- matrix(c(0, 1, 0, 1, 0, 1, 0, 1, 0), 3, 3)
  M <- mean_first_passage_time(W)
  expect_equal(M[1, 3], 4)
  expect_equal(M[2, 1], 3)
})

test_that("navigation on a geometric line succeeds and equals shortest paths", {
  W <- matrix(0, 4, 4); for (i in 1:3) W[i, i + 1] <- W[i + 1, i] <- i
  Dm <- as.matrix(dist(1:4))
  nv <- navigation(W, Dm)
  expect_equal(nv$success_ratio, 1)
  expect_equal(nv$PL_wei, shortest_paths(W)$D)
})

test_that("navigation reports failure when greedy routing turns back", {
  # target 4 is spatially closest to node 2, but 2 is a dead end
  W <- matrix(0, 4, 4); W[1, 2] <- W[2, 1] <- 1; W[1, 3] <- W[3, 1] <- 1; W[3, 4] <- W[4, 3] <- 1
  xyz <- rbind(c(0, 0, 0), c(1, 0, 0), c(0, 5, 0), c(1.2, 0, 0))
  nv <- navigation(W, as.matrix(dist(xyz)))
  expect_true(is.infinite(nv$PL_wei[1, 4]))
  expect_lt(nv$success_ratio, 1)
})

test_that("distance kernel and prediction behave as defined", {
  Dm <- as.matrix(dist(c(0, 1, 3)))
  K <- comm_distance(Dm, lambda = 1)
  expect_equal(K[1, 2], exp(-1))
  a <- c(1, 2, 4)
  P <- predict_from_model(K, a)
  expect_equal(P[1], (exp(-1) * 2 + exp(-3) * 4) / (exp(-1) + exp(-3)))
  expect_equal(dim(predict_from_model(K, cbind(a, a))), c(3L, 2L))
})

test_that("input checks reject negative or asymmetric weights", {
  expect_error(comm_spe(matrix(c(0, -1, -1, 0), 2)), "negative")
  expect_error(comm_spe(matrix(c(0, 1, 2, 0), 2)), "symmetric")
})
