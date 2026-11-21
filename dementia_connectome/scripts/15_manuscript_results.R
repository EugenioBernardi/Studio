# Collect all results for the revised manuscript into output/manuscript_results.rds
source("R/setup.R"); source("R/analysis.R"); source("R/analysis_v2.R"); source("R/results.R"); source("R/results_v2.R")
suppressPackageStartupMessages(library(dplyr))
cfgs <- c("ctx400_euc", "ctx400_geo", "sub414_euc", "ctx200_euc", "ctx100_euc")
D <- lapply(setNames(cfgs, cfgs), prep_v2)
CC <- lapply(setNames(cfgs, cfgs), load_v2)
epi <- read.csv("data/v2/epi_signal_schaefer400_tian14.csv")
res <- list(configs = cfgs)
sc_models <- c("SC_direct", "SPE", "communicability", "search_prob", "navigation", "diffusion", "heat")
fc_models <- c("FC", "FC_top20", "FC_top10")

# geodesic config has no rewiring of its own: rewiring results are identical to ctx400_euc
CC$ctx400_geo$rew_deg <- CC$ctx400_euc$rew_deg; CC$ctx400_geo$rew_geo <- CC$ctx400_euc$rew_geo

res$models <- lapply(CC, model_table_v2)
res$vs_distance <- lapply(CC, function(cc) difference_v2(cc, "distance", c(sc_models, fc_models), R_sel = c(0, 30)))
res$generative <- lapply(CC[c("ctx400_euc", "ctx400_geo", "sub414_euc")], generative_v2)
res$nav_success <- sapply(CC, function(cc) cc$meta$nav_success)
res$registration <- jsonlite::fromJSON("data/atlas_warped/registration_validation.json")
res$warp_vs_old <- read.csv("data/v2/warp_vs_worldNN_k400.csv")

# similarity between syndromes (cortex+subcortex and cortex), spin and variogram p
sim <- function(cfg) {
  d <- D[[cfg]]; cc <- CC[[cfg]]; syn <- colnames(d$A); n_null <- ncol(cc$spins)
  S <- cc$surrogates; pr <- t(combn(syn, 2))
  out <- do.call(rbind, lapply(seq_len(nrow(pr)), function(i) {
    a <- pr[i, 1]; b <- pr[i, 2]; ia <- match(a, syn); cols <- (ia - 1) * n_null + seq_len(n_null)
    r <- cor(d$A[, a], d$A[, b]); y <- matrix(d$A[, b], d$n, n_null)
    data.frame(map1 = a, map2 = b, r = r, p_spin = p_two(r, colcor(S$spin[, cols], y)),
               p_variogram = p_two(r, colcor(S$variogram[, cols], y)), p_moran = p_two(r, colcor(S$moran[, cols], y)))
  }))
  for (pc in c("p_spin", "p_variogram", "p_moran")) out[[sub("p_", "q_", pc)]] <- p.adjust(out[[pc]], "BH")
  out
}
res$similarity <- list(sub414 = sim("sub414_euc"), ctx400 = sim("ctx400_euc"))

# FC hubs, raw and controlling for EPI signal
res$hubs <- list(ctx400 = hubs_v2(D$ctx400_euc, CC$ctx400_euc, epi[1:400, ]), sub414 = hubs_v2(D$sub414_euc, CC$sub414_euc, epi))
res$epi_by_network <- epi %>% mutate(network = ifelse(grepl("^7Networks", label), sub("7Networks_[LR]H_([A-Za-z]+)_.*", "\\1", label), "Subcortex")) %>%
  group_by(network) %>% summarise(epi_signal = mean(epi_signal), .groups = "drop")

# partial correlation beyond the distance kernel (Euclidean or geodesic), spin and variogram nulls
partial_tab <- function(cfg) {
  d <- D[[cfg]]; cc <- CC[[cfg]]; syn <- colnames(d$A); n_null <- ncol(cc$spins)
  prop_threshold <- function(X, q) { u <- X[upper.tri(X)]; thr <- quantile(u, 1 - q); Y <- X; Y[Y < thr] <- 0; diag(Y) <- 0; Y }
  M <- list(SC_direct = d$SC, search_prob = comm_search_probability(d$SC), FC = d$FC, FC_top10 = prop_threshold(d$FC, 0.1))
  pbd <- function(Mm, A, R) {
    dk <- lapply(lambda_grid, function(l) censor(comm_distance(d$Dist_kernel, l), d$Dist, R))
    f <- family_r(dk, A); Pd <- matrix(NA_real_, nrow(A), ncol(A))
    for (j in unique(f$param)) { cols <- which(f$param == j); Pd[, cols] <- predict_from_model(dk[[j]], A[, cols, drop = FALSE]) }
    Pm <- suppressWarnings(as.matrix(predict_from_model(censor(Mm, d$Dist, R), A))); ok <- is.finite(Pm[, 1]) & is.finite(Pd[, 1])
    A <- A[ok, , drop = FALSE]; Pd <- Pd[ok, , drop = FALSE]; Pm <- Pm[ok, , drop = FALSE]
    r_am <- colcor(A, Pm); r_ad <- colcor(A, Pd); r_md <- colcor(Pm, Pd)
    (r_am - r_ad * r_md) / sqrt((1 - r_ad^2) * (1 - r_md^2))
  }
  out <- list()
  for (R in c(0, 30)) for (m in names(M)) {
    o <- pbd(M[[m]], d$A, R)
    ns <- matrix(pbd(M[[m]], cc$surrogates$spin, R), ncol = length(syn)); nv <- matrix(pbd(M[[m]], cc$surrogates$variogram, R), ncol = length(syn))
    out[[length(out) + 1]] <- data.frame(R = R, model = m, syndrome = syn, partial_r = o,
                                         p_spin = sapply(seq_along(syn), function(i) p_upper(o[i], ns[, i])),
                                         p_variogram = sapply(seq_along(syn), function(i) p_upper(o[i], nv[, i])))
  }
  x <- do.call(rbind, out)
  x$q_spin <- ave(x$p_spin, x$R, FUN = function(p) p.adjust(p, "BH")); x$q_variogram <- ave(x$p_variogram, x$R, FUN = function(p) p.adjust(p, "BH"))
  x
}
res$partial <- lapply(setNames(c("ctx400_euc", "ctx400_geo", "sub414_euc"), c("ctx400_euc", "ctx400_geo", "sub414_euc")), partial_tab)

# null diagnostics: short-range variogram ratio and nearest-neighbour autocorrelation
nd <- function(cfg) {
  d <- D[[cfg]]; cc <- CC[[cfg]]; syn <- colnames(d$A); n_null <- ncol(cc$spins)
  vs <- variogram_setup(d$Dist); nn <- apply(d$Dist + diag(Inf, d$n), 1, which.min)
  do.call(rbind, lapply(seq_along(syn), function(i) {
    x <- d$A[, i]; g <- drop(variogram(x, vs)); cols <- (i - 1) * n_null + seq_len(min(200, n_null))
    sets <- list(spin = cc$surrogates$spin[, cols], variogram = cc$surrogates$variogram[, cols], moran = cc$surrogates$moran[, cols])
    data.frame(syndrome = syn[i], null = names(sets),
               variogram_ratio_bins1to5 = sapply(sets, function(X) mean(rowMeans(variogram(X, vs))[1:5] / g[1:5])),
               variogram_ratio_bin1 = sapply(sets, function(X) rowMeans(variogram(X, vs))[1] / g[1]),
               nn_corr_null = sapply(sets, function(X) median(colcor(X, X[nn, , drop = FALSE]))), nn_corr_obs = cor(x, x[nn]))
  }))
}
res$null_diag <- nd("ctx400_euc")

# homotopic asymmetry (cortex and subcortex) with the warped atlas
d <- D$sub414_euc; mir <- read.csv("data/v2/mirrored_atrophy_schaefer400_tian14.csv")
lh <- d$info$hemi == "LH"
res$asymmetry <- do.call(rbind, lapply(colnames(d$A), function(s) {
  a <- d$A[, s]; f <- mir[[s]]; thr <- quantile(a, 0.8); sel <- lh & (a >= thr | f >= thr)
  data.frame(syndrome = s, mirror_r = cor(a, f), mean_LminusR_SD = mean(a[lh] - f[lh]) / sd(a),
             top20_LminusR_SD = mean(a[sel] - f[sel]) / sd(a), top20_left_greater = mean(a[sel] > f[sel]),
             sign_test_p = binom.test(sum(a[sel] > f[sel]), sum(sel))$p.value)
}))
res$mirror_vs_distance <- do.call(rbind, lapply(c("ctx400_euc", "ctx400_geo"), function(cfg) {
  d <- D[[cfg]]; mt <- res$models[[cfg]]
  data.frame(config = cfg, syndrome = colnames(d$A),
             r_distance = sapply(colnames(d$A), function(s) mt$r[mt$R == 0 & mt$model == "distance" & mt$syndrome == s]),
             lambda = sapply(colnames(d$A), function(s) mt$param[mt$R == 0 & mt$model == "distance" & mt$syndrome == s]),
             r_mirror = sapply(colnames(d$A), function(s) cor(d$A[seq_len(400), s], mir[[s]][1:400])))
}))

# epicentres (data-driven) on cortex+subcortex, spin and rewiring p
ep <- function(cfg) {
  d <- D[[cfg]]; cc <- CC[[cfg]]; P <- cc$spins
  do.call(rbind, lapply(colnames(d$A), function(s) {
    a <- d$A[, s]; N <- predict_from_model(d$SC, a); sc <- epicentre_score(a, N)
    As <- spin_maps(a, P); Ns <- predict_from_model(d$SC, As)
    S0 <- (apply(As, 2, rank) + apply(Ns, 2, rank)) / 2
    Nr <- cc$rew_deg$N_sc[, s, ]; Sr <- (rank(a) + apply(Nr, 2, rank)) / 2
    data.frame(syndrome = s, node = seq_len(d$n), label = d$info$label, structure = d$info$structure, atrophy = a, score = sc,
               rank = rank(-sc, ties.method = "min"), p_spin = (1 + rowSums(S0 >= sc)) / (1 + ncol(P)), p_rewire = (1 + rowSums(Sr >= sc)) / (1 + ncol(Nr)))
  }))
}
res$epicentres <- list(sub414 = ep("sub414_euc"))

# eigenmodes within hemisphere
res$eigen <- eigen_within_hemi(D$ctx400_euc, CC$ctx400_euc)

# geometry-null bin sensitivity
if (file.exists("output/cache_v2/geometry_bins_ctx400_euc.rds")) {
  gb <- readRDS("output/cache_v2/geometry_bins_ctx400_euc.rds"); obs <- res$models$ctx400_euc
  m <- merge(gb, obs[, c("R", "model", "syndrome", "r")], by = c("R", "model", "syndrome"), suffixes = c("_null", ""))
  res$geometry_bins <- m %>% group_by(nbins, R, model, syndrome) %>%
    summarise(r = first(r), null_median = median(r_null), p = (1 + sum(r_null >= r)) / (1 + n()), turnover = mean(turnover), .groups = "drop")
}
saveRDS(res, "output/manuscript_results.rds")
cat("saved\n")
