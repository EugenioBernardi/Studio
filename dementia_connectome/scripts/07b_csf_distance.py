"""Distance (mm) from each voxel to template CSF on the ICBM2009cSym grid.
CSF = T1 below the 8th percentile inside the DBM brain mask (captures the
ventricles; checked against a central ventricle box). Used to sample the
core of subcortical structures (>= 3 mm from CSF), limiting DBM spill-over
from ventricular expansion. Usage: python -I 07b_csf_distance.py <project_dir>"""
import sys, os
import numpy as np, nibabel as nib
from scipy import ndimage as ndi
os.chdir(sys.argv[1])
t1 = nib.load("data-raw/zenodo/mni_icbm152_t1_tal_nlin_sym_09c.nii")
T = np.asarray(t1.dataobj).astype(float)
dbm = np.asarray(nib.load("data-raw/zenodo/AD_vs_Control_Tstat_Map_icbm152_nlin_sym.nii").dataobj) != 0
csf = dbm & (T < np.percentile(T[dbm], 8))
d = ndi.distance_transform_edt(~csf).astype(np.float32)
nib.save(nib.Nifti1Image(d, t1.affine), "data/atlas_warped/dist_to_csf_mm.nii.gz")
print("CSF voxels:", int(csf.sum()))
