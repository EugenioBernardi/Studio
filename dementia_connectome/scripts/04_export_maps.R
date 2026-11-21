# Export parcel-level maps for brain rendering (Schaefer-400):
# observed atrophy, model predictions, residuals, epicentre scores and
# eigenmode reconstructions. Writes output/maps/parcel_maps_k400.csv (long).
source("R/setup.R"); source("R/analysis.R"); source("R/results.R"); source("R/extensions.R")
k <- 400
d <- prep_resolution(k); cc <- load_caches(k); syn <- colnames(d$A)
dir.create("output/maps", showWarnings = FALSE, recursive = TRUE)
z <- function(x) as.numeric(scale(x))

M <- communication_models(d$SC, d$Dist)
obs <- cc$observed
lam <- setNames(obs$param[obs$R == 0 & obs$model == "distance"], obs$syndrome[obs$R == 0 & obs$model == "distance"])
ep <- epicentre_table(d, cc)

recon_K <- function(B, a, K = 20) { Q <- qr.Q(qr(B[, seq_len(K)])); drop(Q %*% crossprod(Q, a)) }
G <- geometric_basis(k); Hs <- laplacian_modes(d$SC)$vectors; Hf <- laplacian_modes(d$FC)$vectors

out <- do.call(rbind, lapply(syn, function(s) {
  a <- d$A[, s]
  P_sc <- predict_from_model(M$SC_direct, a)
  P_fc <- predict_from_model(d$FC, a)
  P_d <- predict_from_model(comm_distance(d$Dist, lam[[s]]), a)
  e <- ep[ep$syndrome == s, ]
  rbind(
    data.frame(syndrome = s, map = "atrophy", parcel = 1:k, value = a),
    data.frame(syndrome = s, map = "atrophy_z", parcel = 1:k, value = z(a)),
    data.frame(syndrome = s, map = "pred_SC", parcel = 1:k, value = z(P_sc)),
    data.frame(syndrome = s, map = "pred_FC", parcel = 1:k, value = z(P_fc)),
    data.frame(syndrome = s, map = "pred_distance", parcel = 1:k, value = z(P_d)),
    data.frame(syndrome = s, map = "resid_distance", parcel = 1:k, value = z(resid(lm(a ~ P_d)))),
    data.frame(syndrome = s, map = "resid_distance_FC", parcel = 1:k, value = z(resid(lm(a ~ P_d + P_fc)))),
    data.frame(syndrome = s, map = "epicentre_score", parcel = 1:k, value = e$score / k),
    data.frame(syndrome = s, map = "epicentre_top10", parcel = 1:k, value = as.numeric(e$rank <= 10)),
    data.frame(syndrome = s, map = "recon_geometric_K20", parcel = 1:k, value = z(recon_K(G, a))),
    data.frame(syndrome = s, map = "recon_SC_K20", parcel = 1:k, value = z(recon_K(Hs, a))),
    data.frame(syndrome = s, map = "recon_FC_K20", parcel = 1:k, value = z(recon_K(Hf, a))),
    # homotopic asymmetry: atrophy at the parcel minus atrophy at its exact mirror location
    # (mirrored voxel map, same parcel geometry), in SD units; shown on left-hemisphere parcels
    data.frame(syndrome = s, map = "asym_LminusR", parcel = 1:k,
               value = ifelse(d$info$hemi == "LH", (a - cc$flipped[, s]) / sd(a), NA))
  )
}))
# correlations shown in figure titles
stats <- do.call(rbind, lapply(syn, function(s) {
  w <- out[out$syndrome == s, ]; g <- function(m) w$value[w$map == m]
  data.frame(syndrome = s, map = c("pred_SC", "pred_FC", "pred_distance", "recon_geometric_K20", "recon_SC_K20", "recon_FC_K20"),
             r = sapply(c("pred_SC", "pred_FC", "pred_distance", "recon_geometric_K20", "recon_SC_K20", "recon_FC_K20"), function(m) cor(g("atrophy"), g(m))))
}))
write.csv(out, "output/maps/parcel_maps_k400.csv", row.names = FALSE)
write.csv(stats, "output/maps/parcel_map_stats_k400.csv", row.names = FALSE)
write.csv(d$info, "output/maps/parcel_info_k400.csv", row.names = FALSE)
cat("exported", nrow(out), "rows\n")
