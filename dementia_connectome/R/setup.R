# Load project code: R helpers + compiled C++ kernels.
suppressPackageStartupMessages({ library(Rcpp) })
Rcpp::sourceCpp("src/netcpp.cpp", cacheDir = "output/cache/rcpp")
for (f in c("R/parcellate.R", "R/step1.R", "R/communication.R", "R/nulls.R", "R/spatial_nulls.R")) source(f)

load_connectome <- function(k, type = c("SC", "FC")) {
  type <- match.arg(type)
  f <- file.path(paths$enigma_mat, sprintf("%sMatrix_ctx_schaefer_%d.csv", ifelse(type == "SC", "struc", "func"), k))
  X <- unname(as.matrix(read.csv(f, header = FALSE)))
  diag(X) <- 0
  X
}
# Stand-in for connectomeR::handle_negative(): set negative weights to 0.
zero_negative <- function(X) { n_neg <- sum(X[upper.tri(X)] < 0); X[X < 0] <- 0; attr(X, "n_negative_edges") <- n_neg; X }
