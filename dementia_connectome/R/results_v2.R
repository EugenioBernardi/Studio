# Result tables from the revision caches (output/cache_v2/*_<config>.rds).
# Conventions (reviewer point 5): p-values are one-sided (null r >= observed r);
# a test counts as evidence of a positive network constraint only if r > 0 AND
# FDR q < 0.05 ("supported"). Differences between models are two-sided.
# FDR (BH) runs across syndromes x models within each null, radius and table.

load_v2 <- function(config) {
  f <- function(x) sprintf("output/cache_v2/%s_%s.rds", x, config)
  rd <- function(x) if (file.exists(f(x))) readRDS(f(x)) else NULL
  list(config = config, meta = rd("meta"), observed = rd("observed"), spins = rd("spins"), surrogates = rd("surrogates"),
       null_spin = rd("null_spin"), null_variogram = rd("null_variogram"), null_moran = rd("null_moran"),
       rew_deg = rd("rewire_degree"), rew_geo = rd("rewire_geometry"))
}

.pv <- function(obs, null, keys, name) {
  m <- merge(obs[, c(keys, "r")], null[, c(keys, "r")], by = keys, suffixes = c("", "_null"))
  m$ge <- as.integer(m$r_null >= m$r); m$ok <- as.integer(is.finite(m$r_null)); m$ge[is.na(m$ge)] <- 0L
  a <- aggregate(cbind(ge, ok) ~ ., data = m[, c(keys, "ge", "ok")], FUN = sum)
  a[[name]] <- (1 + a$ge) / (1 + a$ok)
  a[, c(keys, name)]
}

pvals <- function(obs, nulls, keys) {
  tab <- obs
  for (nm in names(nulls)) if (!is.null(nulls[[nm]])) tab <- merge(tab, .pv(obs, nulls[[nm]], keys, paste0("p_", nm)), by = keys, all.x = TRUE)
  tab
}

add_q <- function(tab, by, models) {
  for (pc in grep("^p_", names(tab), value = TRUE)) {
    q <- rep(NA_real_, nrow(tab)); sel_all <- tab$model %in% models & !is.na(tab[[pc]])
    grp <- if (length(by)) interaction(tab[by], drop = TRUE) else factor(rep(1, nrow(tab)))
    for (g in levels(grp)) { sel <- sel_all & grp == g; q[sel] <- p.adjust(tab[[pc]][sel], "BH") }
    tab[[sub("^p_", "q_", pc)]] <- q
  }
  tab
}

fdr_models_v2 <- c("SC_direct", "SPE", "communicability", "search_prob", "navigation", "diffusion", "heat", "distance", "FC", "FC_top20", "FC_top10")

model_table_v2 <- function(cc) {
  keys <- c("R", "model", "syndrome")
  obs <- cc$observed$fits[, c(keys, "r", "param")]
  nulls <- list(spin = cc$null_spin$fits, variogram = cc$null_variogram$fits, moran = cc$null_moran$fits,
                rew_deg = cc$rew_deg$fits, rew_geo = cc$rew_geo$fits)
  tab <- pvals(obs, nulls, keys)
  tab <- add_q(tab, "R", fdr_models_v2)
  for (nm in c("spin", "variogram", "moran", "rew_deg", "rew_geo")) {
    qc <- paste0("q_", nm); if (qc %in% names(tab)) tab[[paste0("supported_", nm)]] <- !is.na(tab[[qc]]) & tab[[qc]] < 0.05 & tab$r > 0
  }
  tab[order(tab$R, tab$syndrome, -tab$r), ]
}

# paired difference model - reference, two-sided, per null (spatial nulls only)
difference_v2 <- function(cc, ref, models, R_sel = c(0, 30)) {
  keys <- c("R", "syndrome")
  obs <- cc$observed$fits
  o <- merge(obs[obs$model %in% models & obs$R %in% R_sel, c(keys, "model", "r")],
             obs[obs$model == ref & obs$R %in% R_sel, c(keys, "r")], by = keys, suffixes = c("", "_ref"))
  o$diff <- o$r - o$r_ref
  for (nm in c("spin", "variogram", "moran")) {
    nl <- cc[[paste0("null_", nm)]]$fits; if (is.null(nl)) next
    nl <- nl[nl$R %in% R_sel, ]
    a <- merge(nl[nl$model %in% models, c(keys, "perm", "model", "r")], nl[nl$model == ref, c(keys, "perm", "r")], by = c(keys, "perm"), suffixes = c("", "_ref"))
    a$dn <- a$r - a$r_ref
    a <- merge(a, o[, c(keys, "model", "diff")], by = c(keys, "model"))
    a$ge <- as.integer(abs(a$dn) >= abs(a$diff)); a$ok <- as.integer(is.finite(a$dn)); a$ge[is.na(a$ge)] <- 0L
    p <- aggregate(cbind(ge, ok) ~ R + syndrome + model, data = a, FUN = sum)
    p[[paste0("p_", nm)]] <- (1 + p$ge) / (1 + p$ok)
    o <- merge(o, p[, c(keys, "model", paste0("p_", nm))], by = c(keys, "model"), all.x = TRUE)
  }
  for (pc in grep("^p_", names(o), value = TRUE)) o[[sub("^p_", "q_", pc)]] <- ave(o[[pc]], o$R, FUN = function(p) p.adjust(p, "BH"))
  o[order(o$R, o$syndrome, -o$diff), ]
}

# generative (seeded) models: observed best fit, p vs spatial nulls (refitted seed and
# parameter in every surrogate), NDM_SC vs rewired SCs, and paired differences
generative_v2 <- function(cc) {
  keys <- c("model", "syndrome")
  g <- cc$observed$generative
  g$seed_label <- cc$meta$info$label[g$seed]
  nulls <- list(spin = cc$null_spin$generative, variogram = cc$null_variogram$generative, moran = cc$null_moran$generative,
                rew_deg = cc$rew_deg$generative, rew_geo = cc$rew_geo$generative)
  tab <- pvals(g[, c(keys, "r", "param", "seed", "seed_label", "bilateral")], nulls, keys)
  tab <- add_q(tab, character(0), unique(tab$model))
  # paired differences NDM - spatial spread, per spatial null
  diffs <- list()
  for (ref in intersect(c("spread_euclid", "spread_geodesic"), g$model)) for (m in c("NDM_SC", "NDM_FC")) {
    o <- merge(g[g$model == m, c("syndrome", "r")], g[g$model == ref, c("syndrome", "r")], by = "syndrome", suffixes = c("", "_ref"))
    o$diff <- o$r - o$r_ref; o$model <- m; o$reference <- ref
    for (nm in c("spin", "variogram", "moran")) {
      nl <- nulls[[nm]]; if (is.null(nl)) next
      a <- merge(nl[nl$model == m, c("syndrome", "perm", "r")], nl[nl$model == ref, c("syndrome", "perm", "r")], by = c("syndrome", "perm"), suffixes = c("", "_ref"))
      a$dn <- a$r - a$r_ref; a <- merge(a, o[, c("syndrome", "diff")], by = "syndrome")
      p <- tapply(seq_len(nrow(a)), a$syndrome, function(ix) (1 + sum(abs(a$dn[ix]) >= abs(a$diff[ix]))) / (1 + length(ix)))
      o[[paste0("p_", nm)]] <- p[o$syndrome]
    }
    diffs[[length(diffs) + 1]] <- o
  }
  list(fits = tab, differences = do.call(rbind, diffs))
}

# FC hubs vs atrophy, raw and controlling for regional EPI signal (dropout proxy)
hubs_v2 <- function(d, cc, epi) {
  prop_threshold <- function(X, q) { u <- X[upper.tri(X)]; thr <- quantile(u, 1 - q); Y <- X; Y[Y < thr] <- 0; diag(Y) <- 0; Y }
  st <- list(SC = rowSums(d$SC), FC = rowSums(d$FC), FC_top20 = rowSums(prop_threshold(d$FC, 0.2)), FC_top10 = rowSums(prop_threshold(d$FC, 0.1)))
  e <- epi$epi_signal[seq_len(d$n)]
  pcor_s <- function(x, y, z) { rx <- resid(lm(rank(x) ~ rank(z))); ry <- resid(lm(rank(y) ~ rank(z))); cor(rx, ry) }
  P <- cc$spins
  out <- do.call(rbind, lapply(names(st), function(m) do.call(rbind, lapply(colnames(d$A), function(s) {
    a <- d$A[, s]; x <- st[[m]]
    r0 <- cor(x, a, method = "spearman"); r1 <- pcor_s(x, a, e)
    n0 <- apply(P, 2, function(p) cor(x, a[p], method = "spearman")); n1 <- apply(P, 2, function(p) pcor_s(x, a[p], e))
    data.frame(strength = m, syndrome = s, rho = r0, p_spin = p_two(r0, n0), rho_partial_epi = r1, p_spin_partial = p_two(r1, n1),
               rho_strength_epi = cor(x, e, method = "spearman"))
  }))))
  out$q_spin <- p.adjust(out$p_spin, "BH"); out$q_spin_partial <- p.adjust(out$p_spin_partial, "BH")
  out
}

# Eigenmode reconstruction within each hemisphere (reviewer point 6): geometric
# modes of that hemisphere vs harmonics of that hemisphere's SC / FC subgraph.
eigen_within_hemi <- function(d, cc, Ks = c(5, 10, 20, 40), n_null = 1000) {
  G <- as.matrix(read.csv(sprintf("data/eigenmodes/geometric_modes_schaefer%d.csv", length(d$cortex)), check.names = FALSE))
  P <- cc$spins[d$cortex, seq_len(min(n_null, ncol(cc$spins)))]
  out <- list()
  for (h in c("LH", "RH")) {
    idx <- which(d$info$hemi[d$cortex] == h)
    gcols <- grep(paste0("^", tolower(substr(h, 1, 1)), "h_"), colnames(G))
    bases <- list(Geometric = G[idx, gcols], `SC harmonics` = laplacian_modes(d$SC[idx, idx])$vectors,
                  `FC harmonics` = laplacian_modes(d$FC[idx, idx])$vectors)
    for (s in colnames(d$A)) {
      a <- d$A[d$cortex, s]
      As <- matrix(a[P], nrow = length(a))[idx, , drop = FALSE]      # spins keep hemispheres
      for (b in names(bases)) {
        o <- recon_curve(bases[[b]], cbind(a[idx]), Ks)
        nl <- recon_curve(bases[[b]], As, Ks)
        out[[length(out) + 1]] <- data.frame(hemi = h, syndrome = s, basis = b, K = Ks, r = o[1, ],
                                             p_spin = sapply(seq_along(Ks), function(i) p_upper(o[1, i], nl[, i])))
      }
    }
  }
  do.call(rbind, out)
}
