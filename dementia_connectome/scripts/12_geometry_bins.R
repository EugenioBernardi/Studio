# Sensitivity of the geometry-preserving rewiring null to the edge-length bin
# width (reviewer point 5). Cortex-400, models SC_direct / search_prob /
# navigation / communicability / heat, R = 0 and 30 mm, 300 networks per setting.
source("R/setup.R"); source("R/analysis.R"); source("R/analysis_v2.R")
d <- prep_v2("ctx400_euc"); syn <- colnames(d$A)
sel <- c("SC_direct", "search_prob", "navigation", "communicability", "heat")
res <- list()
for (nb in c(5, 10, 20, 40)) {
  RNGkind("L'Ecuyer-CMRG"); set.seed(5000 + nb)
  out <- parallel::mclapply(1:300, function(b) {
    Wr <- rewire_geometry(d$SC, d$Dist, nbins = nb, iter = 2000)
    M <- communication_models(Wr, d$Dist); md <- laplacian_modes(Wr)
    f <- fit_all(M, md, d$Dist, d$A, tuned = FALSE); f <- f[f$model %in% sel & f$R %in% c(0, 30), ]
    f$turnover <- edge_turnover(d$SC, Wr); f$rewire <- b; f
  }, mc.cores = 4, mc.set.seed = TRUE)
  x <- do.call(rbind, out); x$syndrome <- syn[x$col]; x$nbins <- nb; res[[as.character(nb)]] <- x
  cat(format(Sys.time(), "%H:%M:%S"), "bins", nb, "turnover", round(mean(x$turnover), 3), "\n")
}
saveRDS(do.call(rbind, res), "output/cache_v2/geometry_bins_ctx400_euc.rds")
