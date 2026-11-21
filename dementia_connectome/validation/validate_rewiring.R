# Properties of the two rewiring nulls on the HCP Schaefer-400 SC.
source("R/setup.R"); library(igraph)
set.seed(2026)
W <- zero_negative(load_connectome(400)); W <- unclass(W); attr(W, "n_negative_edges") <- NULL
info <- read_schaefer_labels(400); Dm <- centroid_distance(info[, c("mni_x", "mni_y", "mni_z")])
len <- function(X) Dm[upper.tri(Dm) & X > 0]
wl <- function(X) cor(log(X[upper.tri(X) & X > 0]), len(X), method = "spearman")
one <- function(R, type) {
  g <- graph_from_adjacency_matrix(R > 0, mode = "undirected")
  data.frame(null = type, degree_identical = identical(rowSums(R > 0), rowSums(W > 0)),
             weights_identical = isTRUE(all.equal(sort(R[R > 0]), sort(W[W > 0]))),
             edge_turnover = edge_turnover(W, R), connected = is_connected(g),
             mean_edge_length = mean(len(R)), ks_D_edge_length = unname(suppressWarnings(ks.test(len(R), len(W))$statistic)),
             weight_length_rho = wl(R), interhemispheric_edges = sum(R[info$hemi == "LH", info$hemi == "RH"] > 0))
}
res <- rbind(
  data.frame(null = "empirical", degree_identical = TRUE, weights_identical = TRUE, edge_turnover = 0,
             connected = is_connected(graph_from_adjacency_matrix(W > 0, mode = "undirected")),
             mean_edge_length = mean(len(W)), ks_D_edge_length = 0, weight_length_rho = wl(W),
             interhemispheric_edges = sum(W[info$hemi == "LH", info$hemi == "RH"] > 0)),
  do.call(rbind, lapply(1:5, function(i) one(rewire_degree(W, iter = 10), "degree (Maslov-Sneppen), iter 10"))),
  do.call(rbind, lapply(1:5, function(i) one(rewire_geometry(W, Dm, nbins = 20, iter = 2000), "degree + geometry, iter 2000"))),
  do.call(rbind, lapply(1:5, function(i) one(rewire_geometry(W, Dm, nbins = 10, iter = 2000), "degree + geometry (10 bins), iter 2000")))
)
print(res, digits = 3)
write.csv(res, "output/validation/rewiring_validation.csv", row.names = FALSE)
