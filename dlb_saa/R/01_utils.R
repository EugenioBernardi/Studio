## =====================================================================
## 01_utils.R  --  generic helpers (no project logic beyond recoding)
## =====================================================================

## ---- package handling ----------------------------------------------
need <- function(pkgs) {
  miss <- pkgs[!vapply(pkgs, requireNamespace, logical(1), quietly = TRUE)]
  if (length(miss)) {
    message("Installing missing packages: ", paste(miss, collapse = ", "))
    install.packages(miss, repos = "https://cloud.r-project.org")
  }
  invisible(lapply(pkgs, function(p) suppressPackageStartupMessages(
    library(p, character.only = TRUE))))
}

## ---- logging --------------------------------------------------------
.LOG <- new.env(parent = emptyenv()); .LOG$lines <- character()
say <- function(...) {
  txt <- paste0(...)
  .LOG$lines <- c(.LOG$lines, txt)
  cat(txt, "\n", sep = "")
}
say_rule <- function(title) {
  say("\n", strrep("=", 70)); say(title); say(strrep("=", 70))
}
write_log <- function(path) writeLines(.LOG$lines, path)

## ---- safe column access --------------------------------------------
## first candidate column that exists AND has >=1 non-missing value
pick_col <- function(df, candidates) {
  for (cc in candidates) {
    if (cc %in% names(df) && any(!is.na(df[[cc]]))) return(cc)
  }
  for (cc in candidates) if (cc %in% names(df)) return(cc)   # exists but empty
  NA_character_
}
get_col <- function(df, candidates, default = NA) {
  cc <- pick_col(df, candidates)
  if (is.na(cc)) return(rep(default, nrow(df)))
  df[[cc]]
}

## ---- dates ----------------------------------------------------------
## readxl may give Date, POSIXct, numeric (Excel serial) or character
as_date_safe <- function(x) {
  if (inherits(x, "Date")) return(x)
  if (inherits(x, "POSIXt")) return(as.Date(x))
  if (is.numeric(x)) {
    out <- rep(as.Date(NA), length(x))
    ok <- !is.na(x) & x > 10000 & x < 60000          # plausible Excel serials
    out[ok] <- as.Date(x[ok], origin = "1899-12-30")
    return(out)
  }
  x <- trimws(as.character(x))
  x[x %in% c("", "NA", "NaN", "NULL", "-", "--", "#N/A", "N/A")] <- NA
  ## numeric-looking strings = Excel serials
  out <- rep(as.Date(NA), length(x))
  isnum <- !is.na(x) & grepl("^[0-9]{4,6}(\\.[0-9]+)?$", x)
  out[isnum] <- as.Date(as.numeric(x[isnum]), origin = "1899-12-30")
  rest <- !is.na(x) & is.na(out)
  if (any(rest)) {
    fmts <- c("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d",
              "%m/%d/%Y", "%d.%m.%Y", "%Y%m%d", "%d/%m/%y", "%b %d %Y")
    for (f in fmts) {
      todo <- rest & is.na(out)
      if (!any(todo)) break
      out[todo] <- as.Date(substr(x[todo], 1, 19), format = f)
    }
  }
  ## sanity window
  out[!is.na(out) & (out < as.Date("1900-01-01") | out > Sys.Date() + 365)] <- NA
  out
}

## ---- identifiers ----------------------------------------------------
## NHC can arrive as numeric, "0012345", "12345 ", "12.345"
norm_id <- function(x) {
  x <- toupper(trimws(as.character(x)))
  x[x %in% c("", "NA", "NULL", "-", "0")] <- NA
  x <- gsub("[^0-9A-Z]", "", x)
  ## if purely numeric, strip leading zeros so 0012345 == 12345
  num <- !is.na(x) & grepl("^[0-9]+$", x)
  x[num] <- sub("^0+", "", x[num])
  x[!is.na(x) & x == ""] <- NA
  x
}

## ---- generic recoders -----------------------------------------------
lower_chr <- function(x) tolower(trimws(as.character(x)))

recode_saa <- function(x) {
  v <- lower_chr(x)
  out <- rep(NA_character_, length(v))
  out[grepl(SAA_POS_PATTERN, v)] <- "Positive"
  out[grepl(SAA_NEG_PATTERN, v)] <- "Negative"
  out[grepl(SAA_IND_PATTERN, v)] <- "Indeterminate"
  factor(out, levels = c("Negative", "Positive", "Indeterminate"))
}

## yes/no style clinical variables -> factor No/Yes
recode_yesno <- function(x, positive_extra = NULL) {
  v <- lower_chr(x)
  v[v %in% c("", "na", "nan", "null", "-", "9", "99", "unknown", "desconocido",
             "not done", "no realizado", "nd")] <- NA
  pos <- "^(1|2|yes|y|si|sí|s|present|presente|positive|positiv[oa]|pos|abnormal|anormal|patologic[oa]|altered|alterad[oa]|true|\\+)$"
  neg <- "^(0|no|n|absent|ausente|negative|negativ[oa]|neg|normal|false|-)$"
  if (!is.null(positive_extra)) pos <- paste0(pos, "|", positive_extra)
  out <- rep(NA_character_, length(v))
  out[grepl(neg, v)] <- "No"
  out[grepl(pos, v)] <- "Yes"
  factor(out, levels = c("No", "Yes"))
}

recode_sex <- function(x) {
  v <- lower_chr(x)
  out <- rep(NA_character_, length(v))
  out[v %in% c("1", "m", "male", "h", "hombre", "varon", "varón", "masculino")] <- "Male"
  out[v %in% c("0", "2", "f", "female", "mujer", "femenino")] <- "Female"
  factor(out, levels = c("Female", "Male"))
}

## APOE genotype string -> e4 carrier
apoe4_from_genotype <- function(x) {
  v <- gsub("[^0-9]", "", as.character(x))          # "E3/E4" -> "34"
  out <- rep(NA_character_, length(v))
  ok <- !is.na(v) & nchar(v) >= 2
  out[ok] <- ifelse(grepl("4", v[ok]), "Yes", "No")
  factor(out, levels = c("No", "Yes"))
}

num_safe <- function(x) {
  if (is.numeric(x)) return(x)
  v <- trimws(as.character(x))
  v <- gsub("[<>=]", "", v)                          # "<200" -> "200"
  v <- gsub("\\s", "", v)
  ## decimal comma only when there is no dot
  v <- ifelse(grepl(",", v) & !grepl("\\.", v), gsub(",", ".", v), gsub(",", "", v))
  suppressWarnings(as.numeric(v))
}

## rowwise sum that returns NA unless all components present
sum_strict <- function(...) {
  m <- cbind(...)
  ifelse(apply(m, 1, function(r) any(is.na(r))), NA_real_, rowSums(m))
}
## rowwise mean over available items (used for tremor / AR subscores)
mean_avail <- function(..., min_items = 1) {
  m <- cbind(...)
  n <- rowSums(!is.na(m))
  out <- rowMeans(m, na.rm = TRUE)
  out[n < min_items] <- NA_real_
  out
}

## ---- standardized mean difference ----------------------------------
## continuous: (m1 - m2) / sqrt((s1^2 + s2^2)/2)
## categorical: multivariate SMD (Yang & Dalton 2012)
smd_value <- function(x, g) {
  g <- droplevels(factor(g))
  if (nlevels(g) != 2) return(NA_real_)
  i1 <- g == levels(g)[1]; i2 <- g == levels(g)[2]
  if (is.numeric(x)) {
    a <- x[i1]; b <- x[i2]
    a <- a[!is.na(a)]; b <- b[!is.na(b)]
    if (length(a) < 2 || length(b) < 2) return(NA_real_)
    den <- sqrt((stats::var(a) + stats::var(b)) / 2)
    if (!is.finite(den) || den == 0) return(NA_real_)
    return((mean(a) - mean(b)) / den)
  }
  f <- droplevels(factor(x))
  k <- nlevels(f)
  if (k < 2) return(NA_real_)
  p1 <- prop.table(table(f[i1]))[-k]
  p2 <- prop.table(table(f[i2]))[-k]
  if (any(is.na(p1)) || any(is.na(p2))) return(NA_real_)
  if (k == 2) {
    p1 <- as.numeric(p1); p2 <- as.numeric(p2)
    den <- sqrt((p1 * (1 - p1) + p2 * (1 - p2)) / 2)
    if (!is.finite(den) || den == 0) return(NA_real_)
    return((p1 - p2) / den)
  }
  p1 <- as.numeric(p1); p2 <- as.numeric(p2)
  S1 <- diag(p1, k - 1) - outer(p1, p1)
  S2 <- diag(p2, k - 1) - outer(p2, p2)
  S  <- (S1 + S2) / 2
  d  <- p1 - p2
  inv <- try(solve(S), silent = TRUE)
  if (inherits(inv, "try-error")) {
    if (!requireNamespace("MASS", quietly = TRUE)) return(NA_real_)
    inv <- MASS::ginv(S)
  }
  val <- as.numeric(sqrt(max(0, t(d) %*% inv %*% d)))
  ## sign is undefined for k>2; keep it positive
  val
}

## mean difference / risk difference with 95% CI, formatted
md_value <- function(x, g, digits = 2) {
  g <- droplevels(factor(g))
  if (nlevels(g) != 2) return(NA_character_)
  i1 <- g == levels(g)[1]; i2 <- g == levels(g)[2]
  if (is.numeric(x)) {
    a <- x[i1]; b <- x[i2]
    if (sum(!is.na(a)) < 2 || sum(!is.na(b)) < 2) return(NA_character_)
    tt <- try(stats::t.test(a, b), silent = TRUE)
    if (inherits(tt, "try-error")) return(NA_character_)
    est <- unname(tt$estimate[1] - tt$estimate[2])
    ci  <- tt$conf.int
    return(sprintf("%.*f (%.*f, %.*f)", digits, est, digits, ci[1], digits, ci[2]))
  }
  f <- droplevels(factor(x))
  if (nlevels(f) != 2) return(NA_character_)
  hi <- levels(f)[2]
  x1 <- sum(f[i1] == hi, na.rm = TRUE); n1 <- sum(!is.na(f[i1]))
  x2 <- sum(f[i2] == hi, na.rm = TRUE); n2 <- sum(!is.na(f[i2]))
  if (n1 < 2 || n2 < 2) return(NA_character_)
  pt <- try(stats::prop.test(c(x1, x2), c(n1, n2), correct = FALSE), silent = TRUE)
  if (inherits(pt, "try-error")) return(NA_character_)
  est <- x1 / n1 - x2 / n2
  ci <- pt$conf.int
  sprintf("%.1f%% (%.1f, %.1f)", 100 * est, 100 * ci[1], 100 * ci[2])
}
