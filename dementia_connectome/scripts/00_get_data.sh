#!/usr/bin/env bash
# Download all open inputs into data-raw/ and verify them.
# Zenodo files are checked against the md5 sums in each record's metadata.
# ENIGMA and CBIG are pinned to the commits used for the analysis.
set -euo pipefail
cd "$(dirname "$0")/.."
RAW=data-raw
mkdir -p "$RAW/zenodo"

ENIGMA_SHA=b08974b55243060cbc1fad12c87048037446e8f7
CBIG_SHA=634f676630929a71297852d01dd92a287103e861

# 1. Atrophy maps (DBM t-maps, ICBM152 2009c nonlinear symmetric, 1 mm)
for rec in 7392621 10383493; do
  curl -sSfL --retry 4 "https://zenodo.org/api/records/$rec" -o "$RAW/zenodo/record_$rec.json"
  python3 -I - "$RAW/zenodo/record_$rec.json" > "$RAW/zenodo/files_$rec.tsv" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
for f in d["files"]:
    k = f["key"]
    if k.endswith(".nii") and "Tstat" in k:
        print(k, f["checksum"].split(":")[1], f["links"]["self"], sep="\t")
PY
  while IFS=$'\t' read -r key md5 url; do
    if [ ! -f "$RAW/zenodo/$key" ] || ! echo "$md5  $RAW/zenodo/$key" | md5sum -c --quiet - 2>/dev/null; then
      curl -sSfL --retry 4 "$url" -o "$RAW/zenodo/$key"
    fi
    echo "$md5  $RAW/zenodo/$key" | md5sum -c -
  done < "$RAW/zenodo/files_$rec.tsv"
done

# 2. ENIGMA toolbox (data files only; its code is not installed or run)
if [ ! -d "$RAW/ENIGMA/.git" ]; then
  GIT_LFS_SKIP_SMUDGE=1 git clone -q https://github.com/MICA-MNI/ENIGMA "$RAW/ENIGMA"
fi
git -C "$RAW/ENIGMA" checkout -q "$ENIGMA_SHA"

# 3. CBIG Schaefer 2018 MNI parcellations (sparse checkout of one folder)
SCH=stable_projects/brain_parcellation/Schaefer2018_LocalGlobal/Parcellations/MNI
if [ ! -d "$RAW/CBIG/.git" ]; then
  GIT_LFS_SKIP_SMUDGE=1 git clone -q --filter=blob:none --sparse https://github.com/ThomasYeoLab/CBIG "$RAW/CBIG"
  git -C "$RAW/CBIG" sparse-checkout set "$SCH"
fi
git -C "$RAW/CBIG" checkout -q "$CBIG_SHA"

echo "ENIGMA at $(git -C "$RAW/ENIGMA" rev-parse HEAD)"
echo "CBIG   at $(git -C "$RAW/CBIG" rev-parse HEAD)"
