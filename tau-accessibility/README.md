# Tau fold accessibility map

Structural test of whether deposited cryo-EM tauopathy fold geometries predict
the disease-specific tau interactomes reported by Puangmalai et al.

**The hypothesis is Puangmalai's.** The contribution here is the structural
test of it. Frame it that way in the abstract.

## Layout

```
src/taufold/        library: parsing, isoform logic, SASA, curation rules
scripts/01-03       Python pipeline: discover -> curate -> accessibility
analysis/04-05.Rmd  R analysis: permutation test, figures
tests/              80 tests, all offline, run in ~2 s
data/               inputs and outputs (gitignored except folds.csv)
```

The split follows the division of labour the work actually has: structure
handling in Python, where `Bio.PDB.SASA.ShrakeRupley` needs no external
binary, and statistics and figures in R Markdown. Every stage boundary is a
tidy CSV, so the R layer never needs to re-parse a structure.

## Running it

```bash
python -m pip install -r requirements.txt

python scripts/01_discover.py              # RCSB search -> data/mapt_entries.json
python scripts/02_curate.py screen         # evidence -> data/folds_candidates.csv
#   ... read primary citations, hand-write data/folds.csv ...
python scripts/02_curate.py validate       # gate
python scripts/03_accessibility.py         # -> four tidy CSVs + provenance.json

Rscript -e 'rmarkdown::render("analysis/04_validate.Rmd")'
Rscript -e 'rmarkdown::render("analysis/05_figures.Rmd")'
```

Steps 1 and 3 need network access to `search.rcsb.org`, `data.rcsb.org` and
`files.rcsb.org`. Everything else, including the whole test suite, runs
offline.

## State of each piece

| piece | state |
|---|---|
| `src/taufold/*` | written, 80 passing tests against synthetic fixtures |
| `scripts/03_accessibility.py` | run end to end offline against fixtures |
| `scripts/01_discover.py`, `02_curate.py` | written, **network paths never executed** |
| `tests/` | all passing |
| `analysis/04_validate.Rmd`, `05_figures.Rmd` | written, **never knitted — no R available where they were authored** |
| `data/folds.csv` | **not written.** Step 2 is yours; see below |

The two Rmd files have not been run. Expect to fix something on first knit.

## Step 2 is not automatable, and the code does not pretend otherwise

`02_curate.py screen` assembles evidence — title, keywords, deposited
`src_method`, organism, resolution, primary DOI, chain counts — and raises
flags. It writes a **worklist** with a *suggested* verdict in three buckets:

- `likely_exclude` — recombinant/heparin/construct markers, no brain markers
- `likely_include` — brain/ex-vivo/sarkosyl markers, no synthetic markers
- `needs_citation_check` — mixed or absent evidence

Every retained entry still needs its primary citation read. `folds.csv` is
written by hand; that file is the audit trail. `02_curate.py validate` then
refuses a table that is missing a DOI, carries a non-brain source, duplicates
a fold, has an unrecognised isoform, lists a single chain, or gives an
implausible resolution.

The keyword screen deliberately over-flags. A heparin filament reaching the
analysis is a wrong result; a brain filament wrongly flagged costs one
citation check.

## The isoform correction

The natural way to build the core/coat vector is binary:

```python
in_core = [1 if r in resolved else 0 for r in range(1, 442)]
```

This is wrong, and the error is correlated with the grouping the study is
trying to explain — the worst possible place for it. A `0` conflates:

- **exposed**: the residue is in this tau molecule but not ordered in the
  core, so it is in the fuzzy coat and available to bind; and
- **absent**: the residue does not exist in this molecule, because the isoform
  lacks the exon encoding it.

PHF6* (`VQIINK`, 275–280) sits in R2, encoded by exon 10. Pick's disease is
3R: residues 275–305 are not in the protein. "PHF6* is 100% exposed in Pick's"
would be a claim about a peptide that is not there. And since the 3R/4R split
runs along disease lines — Pick's is 3R; CBD, PSP, GGT, AGD are 4R; AD and CTE
are 3R+4R — the artefact would look like signal.

So `core_state` is three-valued: `1` ordered, `0` exposed, `NA` undefined.
Mixed 3R+4R filaments are a third case: an unresolved R2 residue is `NA`,
because exposure cannot be distinguished from absence in the 3R protomers —
but a *resolved* R2 residue is `1`, because the density is there. Motif
fractions divide by the number of **defined** residues, and `NA` is carried
all the way into the figures, where it gets its own colour.

This is a change from the brief's step 3.1, which specifies a 0/1 vector.

## Decisions taken, and where to revisit them

- **`n_trim = 2` per end (4 layers dropped).** The brief says "discard the two
  terminal layers at each end", which reads most naturally as two per end. At
  the commonest chain count of 6 that leaves 2 central layers. `--n-trim 1` if
  you read it the other way; the value is recorded in `provenance.json`.
- **SASA on the whole assembly, read off central layers only.** Non-tau chains
  (ubiquitin, nanobodies) are included in the calculation because they really
  do occlude surface, but are never scored.
- **Tau chains identified by PHF6.** A chain is tau only if residues 306–311
  are present, standard, and spell `VQIVYK`. That doubles as the brief's 2N4R
  numbering check, done from coordinates rather than deposition text — an
  entry in a different register fails rather than being analysed shifted.
- **Protofilaments grouped by exact `(resno, resname)` content.** Chains with
  different content are scored separately. AD PHF is the case that matters:
  two non-identical protofilaments, and PHF vs SF *is* a packing difference,
  so collapsing them with `chain[0]` would erase the distinction the study
  rests on.
- **Insertion-coded residues are excluded from residue-number keying and
  reported**, never silently merged. They still contribute to SASA occlusion.
- **Unknown residue types get `NA` relative SASA**, never a guessed
  denominator.

## Things that need checking before publication

- **The Tien et al. table in `src/taufold/tien.py` is transcribed from the
  literature, not computed.** Spot-check Ala (129), Trp (285), Gly (104)
  against Table 1 of the paper. An error there rescales every relative SASA.
- **Repeat boundaries R1–R4 and the N1/N2 exon spans are marked `VERIFY`.**
  The PHF6, PHF6*, PRD and N-terminal motif citations are specific; the repeat
  boundaries are "standard annotation" and should be pinned to a source.
- **Resolution is a confound on the core/coat call.** Unresolved density
  reflects local resolution and modelling choices as well as disorder. There
  is a Spearman check at the end of `04_validate.Rmd`; run it before claiming
  any fold difference.
- **One representative per fold is a choice.** Re-running with a different
  representative entry is the cheapest robustness check available.

## Tests

```bash
python -m pytest -q
```

80 tests, no network. They cover the isoform logic including the `NA`
semantics at the CSV boundary, insertion codes, altlocs, non-tau chains,
asymmetric protofilaments, wrong-register rejection, layer ordering and
trimming, the `folds.csv` validation gate, and one physical check: that
terminal layers of a finite stack really are more exposed than central ones.
That last test is the justification for trimming at all — if it ever fails,
revisit the trim rather than keeping it on faith.
