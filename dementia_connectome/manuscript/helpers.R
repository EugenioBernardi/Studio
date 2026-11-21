# Helpers for the manuscript: pull numbers from output/manuscript_results.rds
suppressPackageStartupMessages({ library(dplyr); library(tidyr); library(ggplot2) })
res <- readRDS(file.path(root, "output/manuscript_results.rds"))
syn_order <- c("AD", "MCI", "bvFTD", "svPPA", "nfvPPA", "FTD")
f2 <- function(x) formatC(x, format = "f", digits = 2)
fp <- function(p) ifelse(is.na(p), "n/a", ifelse(p < 0.001, "< 0.001", paste("=", formatC(p, format = "f", digits = 3))))
mrow <- function(cfg, R, model, s) res$models[[cfg]] %>% filter(R == !!R, model == !!model, syndrome == !!s)
rv <- function(cfg, R, model, s) mrow(cfg, R, model, s)$r
pv <- function(cfg, R, model, s, null = "variogram") mrow(cfg, R, model, s)[[paste0("p_", null)]]
qv <- function(cfg, R, model, s, null = "variogram") mrow(cfg, R, model, s)[[paste0("q_", null)]]
gen <- function(cfg, model, s) res$generative[[cfg]]$fits %>% filter(model == !!model, syndrome == !!s)
gdiff <- function(cfg, model, ref, s) res$generative[[cfg]]$differences %>% filter(model == !!model, reference == !!ref, syndrome == !!s)
part <- function(cfg, R, model, s) res$partial[[cfg]] %>% filter(R == !!R, model == !!model, syndrome == !!s)
model_lab <- c(SC_direct = "SC (direct)", SPE = "Shortest-path efficiency", communicability = "Communicability",
               search_prob = "Search information", navigation = "Navigation", diffusion = "Diffusion efficiency",
               heat = "Network diffusion kernel", FC = "FC (full)", FC_top20 = "FC (top 20%)", FC_top10 = "FC (top 10%)",
               distance = "Distance (Euclidean)", distance_geo = "Distance (geodesic)")
pal <- c(ink = "#0b0b0b", muted = "#52514e", grid = "#e6e5e0", bg = "#fcfcfb", blue = "#2a78d6", orange = "#eb6834",
         aqua = "#1baf7a", yellow = "#eda100", magenta = "#e87ba4", green = "#008300", violet = "#6250d6", red = "#e34948")
theme_ms <- theme_minimal(base_size = 10) +
  theme(panel.grid.minor = element_blank(), panel.grid.major = element_line(colour = pal[["grid"]], linewidth = 0.3),
        plot.background = element_rect(fill = pal[["bg"]], colour = NA), strip.text = element_text(face = "bold", hjust = 0),
        legend.position = "bottom", plot.title = element_text(size = 11, face = "bold"), plot.title.position = "plot")
