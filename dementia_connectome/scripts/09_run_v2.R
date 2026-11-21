# Revision run: all model fits and nulls for one configuration.
# Usage: Rscript scripts/09_run_v2.R <config> [n_null] [n_rewire] [cores]
#   config: ctx400_euc | ctx400_geo | sub414_euc | ctx100_euc | ctx200_euc
# Caches: output/cache_v2/<what>_<config>.rds
args <- commandArgs(TRUE)
config <- args[1]; n_null <- as.integer(if (length(args) > 1) args[2] else 1000)
n_rew <- as.integer(if (length(args) > 2) args[3] else 1000); cores <- as.integer(if (length(args) > 3) args[4] else 4)
source("R/setup.R"); source("R/analysis.R"); source("R/analysis_v2.R")
dir.create("output/cache_v2", showWarnings = FALSE, recursive = TRUE)
f <- function(x) sprintf("output/cache_v2/%s_%s.rds", x, config)
log <- function(...) cat(format(Sys.time(), "%H:%M:%S"), config, sprintf(...), "\n")
seed0 <- c(ctx400_euc = 1, ctx400_geo = 1, sub414_euc = 2, ctx100_euc = 3, ctx200_euc = 4)[[config]] * 10000
d <- prep_v2(config); syn <- colnames(d$A)
log("n = %d nodes, %d negative SC edges set to 0", d$n, d$n_negative_sc)

# proportional thresholding of FC (reviewer point 3): keep the strongest 10% / 20% of edges
prop_threshold <- function(X, q) { u <- X[upper.tri(X)]; thr <- quantile(u, 1 - q); Y <- X; Y[Y < thr] <- 0; diag(Y) <- 0; Y }
models <- c(communication_models(d$SC, d$Dist), list(FC = d$FC, FC_top20 = prop_threshold(d$FC, 0.20), FC_top10 = prop_threshold(d$FC, 0.10)))
modes <- laplacian_modes(d$SC)
X0 <- seed_matrix(d)
saveRDS(list(nav_success = attr(models$navigation, "success_ratio"), info = d$info, homologue = homologue(d)), f("meta"))

label_cols <- function(fit, n_per) { fit$syndrome <- rep(syn, each = n_per)[fit$col]; fit$perm <- ((fit$col - 1) %% n_per) + 1; fit }

obs <- fit_all(models, modes, d$Dist, d$A, Dist_kernel = d$Dist_kernel); obs$syndrome <- syn[obs$col]
gen <- generative_fits(d, d$A, X0 = X0); gen$syndrome <- syn[gen$col]
saveRDS(list(fits = obs, generative = gen), f("observed")); log("observed done")

perms <- spins_v2(d, n_null, seed = seed0 + 1); saveRDS(perms, f("spins"))
surr <- list(
  spin = do.call(cbind, lapply(syn, function(s) spin_maps(d$A[, s], perms))),
  variogram = do.call(cbind, lapply(seq_along(syn), function(i) { x <- variogram_surrogates(d$A[, i], d$Dist, n = n_null, seed = seed0 + 100 + i); attributes(x) <- list(dim = dim(x)); x })),
  moran = do.call(cbind, lapply(seq_along(syn), function(i) { x <- moran_surrogates(d$A[, i], d$Dist, n = n_null, seed = seed0 + 200 + i); attributes(x) <- list(dim = dim(x)); x })))
saveRDS(surr, f("surrogates")); log("surrogates done")
for (nm in names(surr)) {
  fit <- label_cols(fit_all(models, modes, d$Dist, surr[[nm]], Dist_kernel = d$Dist_kernel), n_null)
  g <- label_cols(generative_fits(d, surr[[nm]], X0 = X0), n_null)
  saveRDS(list(fits = fit[, c("R", "model", "syndrome", "perm", "r", "param")], generative = g), f(paste0("null_", nm)))
  log("%s null done", nm)
}

if (n_rew > 0) {
  run_rewire <- function(type, seed) {
    RNGkind("L'Ecuyer-CMRG"); set.seed(seed)
    res <- parallel::mclapply(seq_len(n_rew), function(b) {
      Wr <- if (type == "degree") rewire_degree(d$SC, iter = 10) else rewire_geometry(d$SC, d$Dist, nbins = 20, iter = 2000)
      M <- communication_models(Wr, d$Dist); md <- laplacian_modes(Wr)
      fits <- fit_all(M, md, d$Dist, d$A, tuned = TRUE); fits <- fits[fits$model != "distance", ]
      gf <- best_seed_fit(ndm_profiles(Wr, X0), d$A)
      list(fits = fits, gen = data.frame(model = "NDM_SC", col = seq_along(syn), r = gf$r),
           N_sc = predict_from_model(Wr, d$A), smooth = graph_smoothness(Wr, d$A))
    }, mc.cores = cores, mc.set.seed = TRUE)
    bad <- vapply(res, inherits, TRUE, "try-error"); if (any(bad)) stop(sum(bad), " rewiring runs failed")
    fits <- do.call(rbind, Map(function(x, b) cbind(x$fits, rewire = b), res, seq_along(res))); fits$syndrome <- syn[fits$col]
    gen <- do.call(rbind, Map(function(x, b) cbind(x$gen, rewire = b), res, seq_along(res))); gen$syndrome <- syn[gen$col]
    list(fits = fits, generative = gen, N_sc = simplify2array(lapply(res, `[[`, "N_sc")), smooth = sapply(res, `[[`, "smooth"))
  }
  saveRDS(run_rewire("degree", seed0 + 2000), f("rewire_degree")); log("degree rewiring done")
  saveRDS(run_rewire("geometry", seed0 + 3000), f("rewire_geometry")); log("geometry rewiring done")
}
log("finished")
