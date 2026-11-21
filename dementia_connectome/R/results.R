# Turn cached null runs into result tables. Conventions:
#  - p_spin / p_variogram / p_moran: one-sided (null r >= observed r), maps permuted
#    and every fitted parameter refitted inside each surrogate;
#  - p_rew_deg / p_rew_geo: one-sided, SC replaced by rewired networks (models
#    recomputed, parameters refitted); atrophy map unchanged;
#  - differences (model - distance, SC - FC): two-sided spin p of the paired difference.
#  - FDR (Benjamini-Hochberg) across syndromes x models within each null and radius.

load_caches <- function(k) {
  f <- function(x) sprintf("output/cache/%s_k%d.rds", x, k)
  rd <- function(x) if (file.exists(f(x))) readRDS(f(x)) else NULL
  list(k = k, observed = rd("observed"), spin = rd("spin_null"), rew_deg = rd("rewire_degree"),
       rew_geo = rd("rewire_geometry"), variogram = rd("variogram_null"), moran = rd("moran_null"),
       perms = rd("spins"), flipped = rd("flipped_atrophy"), nav_success = rd("nav_success"))
}

.p_tab <- function(obs, null, col = "p") {
  m <- merge(obs[, c("R", "model", "syndrome", "r")], null[, c("R", "model", "syndrome", "r")],
             by = c("R", "model", "syndrome"), suffixes = c("", "_null"))
  out <- aggregate(cbind(ge = r_null >= r, ok = is.finite(r_null)) ~ R + model + syndrome, data = m, FUN = sum, na.action = na.pass)
  out[[col]] <- (1 + out$ge) / (1 + out$ok)
  out[, c("R", "model", "syndrome", col)]
}

model_table <- function(cc, fdr_models = c("SPE", "communicability", "search_prob", "navigation", "diffusion", "heat", "distance")) {
  obs <- cc$observed
  tab <- obs[, c("R", "model", "syndrome", "r", "param")]
  for (nm in c("spin", "variogram", "moran")) if (!is.null(cc[[nm]])) tab <- merge(tab, .p_tab(obs, cc[[nm]], paste0("p_", nm)), all.x = TRUE)
  if (!is.null(cc$rew_deg)) tab <- merge(tab, .p_tab(obs, cc$rew_deg$fits, "p_rew_deg"), all.x = TRUE)
  if (!is.null(cc$rew_geo)) tab <- merge(tab, .p_tab(obs, cc$rew_geo$fits, "p_rew_geo"), all.x = TRUE)
  for (pc in grep("^p_", names(tab), value = TRUE)) {
    q <- rep(NA_real_, nrow(tab))
    for (R in unique(tab$R)) {
      sel <- tab$R == R & tab$model %in% fdr_models & !is.na(tab[[pc]])
      q[sel] <- p.adjust(tab[[pc]][sel], "BH")
    }
    tab[[sub("^p_", "q_", pc)]] <- q
  }
  tab[order(tab$R, tab$syndrome, -tab$r), ]
}

# paired difference model - reference with a spin null of the difference
difference_table <- function(cc, ref = "distance", models = NULL, nulls = c("spin", "variogram", "moran")) {
  obs <- cc$observed
  if (is.null(models)) models <- setdiff(unique(obs$model), ref)
  o <- merge(obs[obs$model %in% models, c("R", "model", "syndrome", "r")],
             obs[obs$model == ref, c("R", "syndrome", "r")], by = c("R", "syndrome"), suffixes = c("", "_ref"))
  o$diff <- o$r - o$r_ref
  for (nm in nulls) {
    nl <- cc[[nm]]; if (is.null(nl)) next
    a <- merge(nl[nl$model %in% models, c("R", "model", "syndrome", "perm", "r")],
               nl[nl$model == ref, c("R", "syndrome", "perm", "r")], by = c("R", "syndrome", "perm"), suffixes = c("", "_ref"))
    a$dnull <- a$r - a$r_ref
    a <- merge(a, o[, c("R", "model", "syndrome", "diff")], by = c("R", "model", "syndrome"))
    p <- aggregate(cbind(ge = abs(dnull) >= abs(diff), ok = is.finite(dnull)) ~ R + model + syndrome, data = a, FUN = sum, na.action = na.pass)
    p[[paste0("p_", nm)]] <- (1 + p$ge) / (1 + p$ok)
    o <- merge(o, p[, c("R", "model", "syndrome", paste0("p_", nm))], all.x = TRUE)
  }
  for (pc in grep("^p_", names(o), value = TRUE)) {
    o[[sub("^p_", "q_", pc)]] <- ave(o[[pc]], o$R, FUN = function(p) p.adjust(p, "BH"))
  }
  o[order(o$R, o$syndrome, -o$diff), ]
}

# epicentres: observed score, spin p and rewiring p per node and syndrome
epicentre_table <- function(d, cc, W = d$SC) {
  perms <- cc$perms
  do.call(rbind, lapply(colnames(d$A), function(s) {
    a <- d$A[, s]; N <- predict_from_model(W, a); sc <- epicentre_score(a, N)
    As <- spin_maps(a, perms)
    Ns <- predict_from_model(W, As)
    S_null <- (apply(As, 2, rank) + apply(Ns, 2, rank)) / 2
    p_spin <- (1 + rowSums(S_null >= sc)) / (1 + ncol(perms))
    p_rew <- NA
    if (!is.null(cc$rew_deg)) {
      Nr <- cc$rew_deg$N_sc[, s, ]
      S_rew <- (rank(a) + apply(Nr, 2, rank)) / 2
      p_rew <- (1 + rowSums(S_rew >= sc)) / (1 + ncol(Nr))
    }
    data.frame(syndrome = s, parcel = seq_along(a), label = d$info$label, hemi = d$info$hemi,
               network = d$info$network, atrophy = a, neighbour = N, score = sc,
               rank = rank(-sc, ties.method = "min"), p_spin = p_spin, p_rew_deg = p_rew)
  }))
}

# label shortener for tables
short_label <- function(x) sub("^7Networks_", "", x)
