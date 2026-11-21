// Fast kernels for network communication models and rewiring nulls.
// Conventions follow the Brain Connectivity Toolbox (BCT / bctpy) so results
// can be validated against it. All matrices are dense, n x n, 0-based inside.
#include <Rcpp.h>
#include <vector>
#include <cmath>
#include <limits>
using namespace Rcpp;

// [[Rcpp::export]]
List floyd_warshall_cpp(NumericMatrix L) {
  // L: edge lengths, 0 or Inf = no edge. Returns shortest path lengths D,
  // hop counts H and the predecessor-free "next hop" matrix P (P(i,j) = first
  // node after i on a shortest path to j), as in BCT distance_wei_floyd.
  const int n = L.nrow();
  const double INF = std::numeric_limits<double>::infinity();
  std::vector<double> D(n * n);
  std::vector<int> H(n * n), P(n * n);
  for (int i = 0; i < n; ++i)
    for (int j = 0; j < n; ++j) {
      double l = L(i, j);
      bool edge = (i != j) && l > 0 && std::isfinite(l);
      D[i * n + j] = (i == j) ? 0.0 : (edge ? l : INF);
      H[i * n + j] = edge ? 1 : 0;
      P[i * n + j] = edge ? j : -1;
    }
  for (int k = 0; k < n; ++k) {
    for (int i = 0; i < n; ++i) {
      double dik = D[i * n + k];
      if (!std::isfinite(dik)) continue;
      for (int j = 0; j < n; ++j) {
        double cand = dik + D[k * n + j];
        if (cand < D[i * n + j]) {
          D[i * n + j] = cand;
          H[i * n + j] = H[i * n + k] + H[k * n + j];
          P[i * n + j] = P[i * n + k];
        }
      }
    }
  }
  NumericMatrix Dout(n, n);
  IntegerMatrix Hout(n, n), Pout(n, n);
  for (int i = 0; i < n; ++i)
    for (int j = 0; j < n; ++j) {
      Dout(i, j) = D[i * n + j];
      Hout(i, j) = H[i * n + j];
      Pout(i, j) = P[i * n + j];
    }
  return List::create(_["D"] = Dout, _["hops"] = Hout, _["nexthop"] = Pout);
}

// [[Rcpp::export]]
NumericMatrix search_information_cpp(NumericMatrix T, IntegerMatrix nexthop) {
  // Search information (Goni et al. 2014) without memory: SI(i,j) =
  // -log2(prod of T along the shortest path i -> j). T is the row-normalized
  // transition matrix. Diagonal = 0; unreachable pairs = Inf.
  const int n = T.nrow();
  NumericMatrix SI(n, n);
  for (int i = 0; i < n; ++i)
    for (int j = 0; j < n; ++j) {
      if (i == j) { SI(i, j) = 0.0; continue; }
      if (nexthop(i, j) < 0) { SI(i, j) = R_PosInf; continue; }
      double logp = 0.0;
      int cur = i, steps = 0;
      while (cur != j) {
        int nx = nexthop(cur, j);
        logp += std::log2(T(cur, nx));
        cur = nx;
        if (++steps > n) stop("path reconstruction did not terminate");
      }
      SI(i, j) = -logp;
    }
  return SI;
}

// [[Rcpp::export]]
List navigation_cpp(NumericMatrix L, NumericMatrix Dist, int max_hops) {
  // Greedy navigation (Seguin et al. 2018), replicating bctpy navigation_wu:
  // from the current node, move to the neighbour closest (in Dist) to the
  // target; fail if that neighbour is the node just left or hops exceed
  // max_hops. Ties go to the lowest index (numpy argmin).
  const int n = L.nrow();
  std::vector<std::vector<int>> nb(n);
  for (int i = 0; i < n; ++i)
    for (int j = 0; j < n; ++j)
      if (L(i, j) != 0) nb[i].push_back(j);
  NumericMatrix PLwei(n, n), PLdis(n, n);
  IntegerMatrix PLbin(n, n);
  int success = 0;
  for (int i = 0; i < n; ++i)
    for (int j = 0; j < n; ++j) {
      if (i == j) continue;
      int cur = i, last = i, hops = 0;
      double wsum = 0, dsum = 0;
      bool ok = true;
      while (cur != j) {
        if (nb[cur].empty()) { ok = false; break; }
        int best = nb[cur][0];
        double bd = Dist(j, best);
        for (size_t k = 1; k < nb[cur].size(); ++k) {
          int c = nb[cur][k];
          if (Dist(j, c) < bd) { bd = Dist(j, c); best = c; }
        }
        if (best == last || hops > max_hops) { ok = false; break; }
        hops += 1;
        wsum += L(cur, best);
        dsum += Dist(cur, best);
        last = cur;
        cur = best;
      }
      if (ok) {
        PLbin(i, j) = hops; PLwei(i, j) = wsum; PLdis(i, j) = dsum; success++;
      } else {
        PLbin(i, j) = NA_INTEGER; PLwei(i, j) = R_PosInf; PLdis(i, j) = R_PosInf;
      }
    }
  return List::create(_["success_ratio"] = (double)success / (n * (n - 1.0)),
                      _["PL_bin"] = PLbin, _["PL_wei"] = PLwei, _["PL_dis"] = PLdis);
}

// [[Rcpp::export]]
NumericMatrix rewire_cpp(NumericMatrix W, int iter, NumericMatrix Dist, NumericVector bin_edges, bool geometric) {
  // Degree-preserving Maslov-Sneppen rewiring of an undirected weighted graph.
  // Each edge keeps its weight when its endpoints are swapped (as in BCT
  // randmio_und). iter = number of swap attempts per edge.
  // geometric = true: a swap is accepted only if each new edge falls in the same
  // edge-length bin as the edge whose weight it inherits (bin_edges over Dist),
  // so the edge-length distribution and the weight-length relation are kept.
  const int n = W.nrow();
  NumericMatrix R = clone(W);
  std::vector<int> ei, ej;
  for (int i = 0; i < n; ++i)
    for (int j = i + 1; j < n; ++j)
      if (R(i, j) != 0) { ei.push_back(i); ej.push_back(j); }
  const int m = ei.size();
  auto bin_of = [&](double d) {
    int b = 0;
    while (b + 1 < bin_edges.size() && d >= bin_edges[b + 1]) ++b;
    return b;
  };
  long total = (long)iter * m;
  for (long t = 0; t < total; ++t) {
    int e1 = (int)(R::unif_rand() * m), e2 = (int)(R::unif_rand() * m);
    if (e1 == e2) continue;
    int a = ei[e1], b = ej[e1], c = ei[e2], d = ej[e2];
    if (R::unif_rand() < 0.5) std::swap(c, d); // random orientation of edge 2
    // proposed: (a,d) inherits w(a,b); (c,b) inherits w(c,d)
    if (a == d || c == b || a == c || b == d) continue;
    if (R(a, d) != 0 || R(c, b) != 0) continue;
    if (geometric) {
      if (bin_of(Dist(a, d)) != bin_of(Dist(a, b))) continue;
      if (bin_of(Dist(c, b)) != bin_of(Dist(c, d))) continue;
    }
    double w1 = R(a, b), w2 = R(c, d);
    R(a, b) = R(b, a) = 0; R(c, d) = R(d, c) = 0;
    R(a, d) = R(d, a) = w1; R(c, b) = R(b, c) = w2;
    ei[e1] = a; ej[e1] = d; ei[e2] = c; ej[e2] = b;
  }
  return R;
}
