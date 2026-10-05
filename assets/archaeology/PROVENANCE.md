# Archaeological skeleton mesh provenance
BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

Official dataset: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
Official license, updated 2025-02-27: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
License: https://creativecommons.org/licenses/by/4.0/
Legal code: https://creativecommons.org/licenses/by/4.0/legalcode.en

Derivative changes: individually select named osseous elements, discard soft tissues,
centre and uniformly scale to a 1.7-metre adult, rotate coordinate axes, cluster
vertices within approximately 0.85–1.65 mm, quantize positions to 0.05 mm, recompute
smooth vertex normals, pose horizontally and apply mineral/soil weathering.
The source anatomy is preserved; this is an artistic archaeological scene, not a
medical model or a claim that the dataset contains every tooth or bone.

The reproducible selection, source/archive hash, generated source hash and element
names are in manifest.json and scripts/assets/build-skeleton.py. Original downloaded
archives and saved license pages in source/ are private authoring inputs and must
not enter the public publication allowlist. This derivative retains CC BY 4.0.
The pottery is original procedural geometry authored within this project.
