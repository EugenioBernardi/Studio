# Load project code. The network functions live in the netcomm package
# (pkg/netcomm; written to be merged into connectomeR as R/communication.R).
suppressPackageStartupMessages({
  if (!requireNamespace("netcomm", quietly = TRUE) || utils::packageVersion("netcomm") < "0.1.0")
    install.packages("pkg/netcomm", repos = NULL, type = "source")
  library(netcomm)
})
for (f in c("R/parcellate.R", "R/step1.R")) source(f)

load_connectome <- function(k, type = c("SC", "FC")) {
  type <- match.arg(type)
  f <- file.path(paths$enigma_mat, sprintf("%sMatrix_ctx_schaefer_%d.csv", ifelse(type == "SC", "struc", "func"), k))
  X <- unname(as.matrix(read.csv(f, header = FALSE)))
  diag(X) <- 0
  X
}
# Stand-in for connectomeR::handle_negative(): set negative weights to 0.
zero_negative <- function(X) { n_neg <- sum(X[upper.tri(X)] < 0); X[X < 0] <- 0; attr(X, "n_negative_edges") <- n_neg; X }
