# Export node-level maps for the revised figures (cortex+subcortex, 414 nodes):
# atrophy, homotopic asymmetry, epicentre score, best generative seeds.
source("R/setup.R"); source("R/analysis.R"); source("R/analysis_v2.R"); source("R/results_v2.R")
d <- prep_v2("sub414_euc"); cc <- load_v2("sub414_euc"); syn <- colnames(d$A)
mir <- read.csv("data/v2/mirrored_atrophy_schaefer400_tian14.csv")
stopifnot(identical(mir$label, d$info$label))
z <- function(x) as.numeric(scale(x))
out <- list()
for (s in syn) {
  a <- d$A[, s]
  N <- predict_from_model(d$SC, a); sc <- epicentre_score(a, N)
  out[[length(out) + 1]] <- data.frame(syndrome = s, node = seq_len(d$n), label = d$info$label, map = "atrophy", value = a)
  out[[length(out) + 1]] <- data.frame(syndrome = s, node = seq_len(d$n), label = d$info$label, map = "atrophy_z", value = z(a))
  out[[length(out) + 1]] <- data.frame(syndrome = s, node = seq_len(d$n), label = d$info$label, map = "asym_LminusR",
                                       value = ifelse(d$info$hemi == "LH", (a - mir[[s]]) / sd(a), NA))
  out[[length(out) + 1]] <- data.frame(syndrome = s, node = seq_len(d$n), label = d$info$label, map = "epicentre_rank",
                                       value = rank(-sc, ties.method = "min"))
}
g <- cc$observed$generative; g$syndrome <- syn[g$col]
hom <- cc$meta$homologue
seeds <- do.call(rbind, lapply(seq_len(nrow(g)), function(i) {
  v <- rep(0, d$n); v[g$seed[i]] <- 1; if (g$bilateral[i]) v[hom[g$seed[i]]] <- 1
  data.frame(syndrome = g$syndrome[i], node = seq_len(d$n), label = d$info$label, map = paste0("seed_", g$model[i]), value = v)
}))
dir.create("output/maps_v2", showWarnings = FALSE)
write.csv(rbind(do.call(rbind, out), seeds), "output/maps_v2/node_maps_sub414.csv", row.names = FALSE)
cat("exported\n")
