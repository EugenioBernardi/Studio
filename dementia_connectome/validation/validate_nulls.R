# Compare R spin permutations with neuromaps (Hungarian) on Schaefer-400, and
# check rewiring nulls on the HCP SC. Writes output/validation/spin_validation.csv
source("R/setup.R")
sph <- read.csv("data/sphere_centroids_schaefer400.csv")
a <- read.csv("data/parcellated_atrophy_schaefer400.csv")
syn <- names(syndromes)
t0 <- Sys.time()
P_r <- spin_permutations(sph[, c("x", "y", "z")], sph$hemi, n_perm = 1000, seed = 1234)
cat("R spins:", format(Sys.time() - t0), "\n")
P_n <- as.matrix(read.csv("output/validation/neuromaps_spins400.csv", header = FALSE)) + 1L
stopifnot(all(apply(P_n, 2, function(p) setequal(p, 1:400))))
pairs <- t(combn(syn, 2))
res <- do.call(rbind, lapply(seq_len(nrow(pairs)), function(i) {
  x <- a[[pairs[i, 1]]]; y <- a[[pairs[i, 2]]]
  r1 <- spin_cor_test(x, y, P_r); r2 <- spin_cor_test(x, y, P_n)
  data.frame(map1 = pairs[i, 1], map2 = pairs[i, 2], r = r1$r,
             p_spin_R = r1$p, p_spin_neuromaps = r2$p,
             null_sd_R = sd(r1$null), null_sd_neuromaps = sd(r2$null),
             ks_p_null = suppressWarnings(ks.test(r1$null, r2$null)$p.value))
}))
# displacement: mean distance (sphere) between a parcel and the parcel whose value it receives
disp <- function(P) colMeans(sqrt(rowSums((as.matrix(sph[, c("x","y","z")])[rep(1:400, ncol(P)), ] - as.matrix(sph[as.vector(P), c("x","y","z")]))^2)) |> matrix(400))
dr <- disp(P_r); dn <- disp(P_n)
cat(sprintf("mean displacement (mm on 100-mm sphere): R %.1f, neuromaps %.1f; KS p = %.3f\n", mean(dr), mean(dn), ks.test(dr, dn)$p.value))
cat(sprintf("p-value agreement: max |diff| = %.3f, cor = %.4f; null SD ratio range %.3f-%.3f\n",
            max(abs(res$p_spin_R - res$p_spin_neuromaps)), cor(res$p_spin_R, res$p_spin_neuromaps),
            min(res$null_sd_R / res$null_sd_neuromaps), max(res$null_sd_R / res$null_sd_neuromaps)))
write.csv(res, "output/validation/spin_validation.csv", row.names = FALSE)
saveRDS(P_r, "output/cache/spins400.rds")
print(res, digits = 3)
