# Validate R/communication.R against bctpy / netneurotools on the HCP
# Schaefer-400 SC (negative weights set to 0). Reference values come from
# validation/reference_bctpy.py. Writes output/validation/communication_validation.csv
source("R/setup.R")
W <- as.matrix(read.csv("output/validation/W400.csv", header = FALSE)); dimnames(W) <- NULL
Dm <- as.matrix(read.csv("output/validation/D400.csv", header = FALSE)); dimnames(Dm) <- NULL
ref <- function(f) { X <- as.matrix(read.csv(file.path("output/validation", paste0(f, ".csv")), header = FALSE)); dimnames(X) <- NULL; X }
cmp <- function(name, mine, theirs, note = "") {
  off <- row(mine) != col(mine)            # bctpy stores Inf/NaN on some diagonals
  mine <- mine[off]; theirs <- theirs[off]
  ok <- is.finite(mine) & is.finite(theirs)
  data.frame(quantity = name, reference = note,
             max_abs_diff = max(abs(mine[ok] - theirs[ok])),
             max_rel_diff = max(abs(mine[ok] - theirs[ok]) / pmax(abs(theirs[ok]), 1e-300)),
             offdiag_nonfinite_pattern_identical = identical(is.finite(mine), is.finite(theirs)))
}
sp <- shortest_paths(W)
si <- search_information(W)
nv <- navigation(W, Dm)
mf <- mean_first_passage_time(W)
de <- 1 / mf; diag(de) <- 0
res <- rbind(
  cmp("shortest-path length (L = 1/W)", sp$D, ref("bct_distance_wei"), "bct.distance_wei"),
  cmp("weighted communicability", comm_communicability(W), ref("nnt_communicability_wei"), "netneurotools.metrics.communicability_wei"),
  cmp("search information (bits)", si, ref("bct_search_information"), "bct.search_information(transform='inv')"),
  cmp("navigation path length (sum 1/w)", nv$PL_wei, ref("bct_nav_PLwei"), "bct.navigation_wu"),
  cmp("navigation hops", ifelse(is.na(nv$PL_bin), Inf, nv$PL_bin), ref("bct_nav_PLbin"), "bct.navigation_wu"),
  cmp("mean first passage time", mf, ref("bct_mfpt"), "bct.mean_first_passage_time"),
  cmp("diffusion efficiency (1/MFPT)", de, ref("bct_diffusion_efficiency"), "bct.diffusion_efficiency")
)
res$navigation_success_ratio <- c(NA, NA, NA, nv$success_ratio, nv$success_ratio, NA, NA)
print(res, digits = 3)
write.csv(res, "output/validation/communication_validation.csv", row.names = FALSE)
