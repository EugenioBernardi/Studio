# Run and cache all permutation and rewiring nulls for one resolution.
# Usage: Rscript scripts/02_run_nulls.R <k> [n_perm] [n_rewire] [cores]
args <- commandArgs(TRUE)
k <- as.integer(args[1]); n_perm <- as.integer(if (length(args) > 1) args[2] else 1000)
n_rew <- as.integer(if (length(args) > 2) args[3] else 1000); cores <- as.integer(if (length(args) > 3) args[4] else 4)
source("R/setup.R"); source("R/analysis.R")
dir.create("output/cache", showWarnings = FALSE, recursive = TRUE)
f <- function(x) sprintf("output/cache/%s_k%d.rds", x, k)
log <- function(...) cat(format(Sys.time(), "%H:%M:%S"), sprintf(...), "\n")
d <- prep_resolution(k)
log("k = %d, n_perm = %d, n_rewire = %d", k, n_perm, n_rew)

perms <- spin_permutations(d$sph, d$hemi, n_perm = n_perm, seed = 1000 + k)
saveRDS(perms, f("spins")); log("spins done")

models <- c(communication_models(d$SC, d$Dist), list(FC = d$FC))
modes <- laplacian_modes(d$SC)
saveRDS(attr(models$navigation, "success_ratio"), f("nav_success"))
obs <- fit_all(models, modes, d$Dist, d$A); obs$syndrome <- colnames(d$A)[obs$col]
saveRDS(obs, f("observed")); log("observed fits done")
As <- do.call(cbind, lapply(colnames(d$A), function(s) spin_maps(d$A[, s], perms)))
sp <- fit_all(models, modes, d$Dist, As)
sp$syndrome <- rep(colnames(d$A), each = ncol(perms))[sp$col]; sp$perm <- ((sp$col - 1) %% ncol(perms)) + 1
saveRDS(sp[, c("R", "model", "syndrome", "perm", "r", "param")], f("spin_null")); log("spin null fits done")

run_rewire <- function(type, seed) {
  RNGkind("L'Ecuyer-CMRG"); set.seed(seed)
  res <- parallel::mclapply(seq_len(n_rew), function(b) {
    Wr <- if (type == "degree") rewire_degree(d$SC, iter = 10) else rewire_geometry(d$SC, d$Dist, nbins = 20, iter = 2000)
    rewired_fits(d, Wr)
  }, mc.cores = cores, mc.set.seed = TRUE)
  bad <- vapply(res, inherits, TRUE, "try-error"); if (any(bad)) stop(sum(bad), " rewiring runs failed")
  fits <- do.call(rbind, Map(function(x, b) cbind(x$fits, rewire = b), res, seq_along(res)))
  fits$syndrome <- colnames(d$A)[fits$col]
  list(fits = subset(fits, model != "distance"),                  # distance does not depend on the SC
       N_sc = simplify2array(lapply(res, `[[`, "N_sc")),          # n x syndromes x B
       smooth = sapply(res, `[[`, "smooth"),                      # syndromes x B
       recon = simplify2array(lapply(res, `[[`, "recon")))        # syndromes x K x B
}
saveRDS(run_rewire("degree", 2000 + k), f("rewire_degree")); log("degree rewiring done")
saveRDS(run_rewire("geometry", 3000 + k), f("rewire_geometry")); log("geometry rewiring done")
log("finished")
