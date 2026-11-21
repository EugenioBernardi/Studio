"""Regional EPI signal as a proxy for susceptibility dropout (reviewer point 3).
SPM12 OldNorm EPI.nii (mean EPI template, MNI space) and T1.nii are resampled
(linear) to the ICBM2009cSym t-map grid and averaged within the warped
Schaefer-400 + Tian-14 atlas. Outputs per node: EPI mean (divided by the cortical
median) and EPI/T1 ratio (divided by the cortical median).
Usage: python -I 11_epi_signal.py <project_dir>"""
import os, sys
import numpy as np, pandas as pd, nibabel as nib
from nilearn import image
os.chdir(sys.argv[1])
ref = nib.load("data-raw/zenodo/AD_vs_Control_Tstat_Map_icbm152_nlin_sym.nii")
lab = np.asarray(nib.load("data/atlas_warped/schaefer400_tian14_icbm2009csym.nii.gz").dataobj).astype(int)
epi = np.asarray(image.resample_to_img("data-raw/spm12/toolbox/OldNorm/EPI.nii", ref, interpolation="linear", force_resample=True, copy_header=True).dataobj)
t1 = np.asarray(image.resample_to_img("data-raw/spm12/toolbox/OldNorm/T1.nii", ref, interpolation="linear", force_resample=True, copy_header=True).dataobj)
info = pd.read_csv("data/v2/parcellated_atrophy_schaefer400_tian14.csv")
n = len(info)
e = np.array([epi[lab == p].mean() for p in range(1, n + 1)])
r = np.array([(epi[lab == p] / np.maximum(t1[lab == p], 1e-6)).mean() for p in range(1, n + 1)])
out = pd.DataFrame({"label": info.label, "epi_signal": e / np.median(e[:400]), "epi_t1_ratio": r / np.median(r[:400])})
out.to_csv("data/v2/epi_signal_schaefer400_tian14.csv", index=False)
o = out.iloc[:400].sort_values("epi_signal")
print("lowest EPI signal parcels:\n", o.head(10).to_string(index=False))
print("\nmean normalised EPI signal by network:")
net = info.label.str.extract(r"7Networks_[LR]H_([A-Za-z]+)")[0].fillna("Subcortex")
print(out.assign(network=net).groupby("network").epi_signal.mean().round(3).to_string())
