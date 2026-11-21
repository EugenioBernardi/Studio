"""Supplementary figure: FSL MNI152 brain edges over the ICBM2009cSym template,
before (world-coordinate resampling) and after ANTs SyN, plus the warped atlas."""
import os, sys
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from nilearn import plotting, image
os.chdir(sys.argv[1]); os.makedirs("figures/v2", exist_ok=True)
fixed = "data/atlas_warped/icbm2009csym_brain.nii.gz"
before = image.resample_to_img("data-raw/CBIG/data/templates/volume/FSL5.0.8_MNI_templates/MNI152_T1_1mm_brain.nii.gz", fixed, interpolation="linear", force_resample=True, copy_header=True)
after = "data/atlas_warped/fsl_t1_in_icbm2009csym.nii.gz"
fig = plt.figure(figsize=(11, 7.2), facecolor="#fcfcfb")
cuts = [-20, -4, 10, 26]
for i, (img, lab) in enumerate([(before, "Before: world-coordinate resampling"), (after, "After: ANTs SyN")]):
    ax = fig.add_axes([0, 0.67 - i * 0.33, 1, 0.3])
    d = plotting.plot_anat(fixed, display_mode="z", cut_coords=cuts, axes=ax, title=lab, draw_cross=False, annotate=False, black_bg=False)
    d.add_edges(img, color="#e34948")
ax = fig.add_axes([0, 0.01, 1, 0.3])
plotting.plot_roi("data/atlas_warped/schaefer400_tian14_icbm2009csym.nii.gz", bg_img=fixed, display_mode="z", cut_coords=cuts, axes=ax,
                  title="Warped Schaefer-400 + Tian-14 on the ICBM 2009c symmetric template", draw_cross=False, annotate=False, black_bg=False, cmap="tab20", alpha=0.6)
fig.savefig("figures/v2/figS1_registration.png", dpi=130, facecolor="#fcfcfb")
from PIL import Image
im = Image.open("figures/v2/figS1_registration.png").convert("RGB"); im.thumbnail((1500, 1500)); im.save("figures/v2/web/figS1_registration.jpg", quality=86)
print("ok")
