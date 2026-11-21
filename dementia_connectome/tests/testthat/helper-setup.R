`%||%` <- function(a, b) if (is.null(a)) b else a
# In connectomeR these functions would be package exports; here we source them.
proj <- normalizePath(file.path(dirname(sys.frame(1)$ofile %||% "."), "..", ".."), mustWork = FALSE)
if (!file.exists(file.path(proj, "R/setup.R"))) proj <- normalizePath("../..")
owd <- setwd(proj); source("R/setup.R"); setwd(owd)
