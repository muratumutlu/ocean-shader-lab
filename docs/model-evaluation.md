# Caretta model and distribution decision

Reviewed on 5 October 2026. Use the project's original turtle. The tested free CC0 candidate is a weaker visual replacement and would still require substantial anatomy, UV, material, rig and motion work.

| Model | Distribution | Actual contents | Decision |
| --- | --- | --- | --- |
| Original Living Cove Caretta | Project MIT license; editable source and embedded original maps | 7,932/2,472 high/low triangles, 13 bones, two materials, six maps; Swim, Crawl and Idle clips | Ship the revised original model |
| 3DAssets.dev Ocean Giants loggerhead, asset 39340 | Published CC0 1.0; site explicitly permits commercial and raw-model redistribution | 8,044 triangles, 5,130 vertices, five meshes/materials; downloaded file has no UVs, images, rig or clips | Reject as a replacement; retain only private evaluation evidence |

The candidate's [specific listing](https://3dassets.dev/assets/ocean-giants-kit-loggerhead-turtle-3bc323f1) identifies CC0, static geometry and no animations. The [site license policy](https://3dassets.dev/license) permits redistribution and commercial use. These primary pages were rechecked for this release. The actual downloaded GLB is 134,856 bytes with SHA-256 `03db7bc11d631c0dd6021ab7388ae444691bffeeb76b5a81366cd521ce2f59ec`. The listing declares AI use; independently documented adult-scan or upstream authorship provenance was not established.

Earlier controlled Blender comparisons use matched head-side, head-three-quarter and whole-body cameras. The candidate's smooth muzzle, small protruding eyes, broad pale shell bands and simple thin paddles do not improve adult form. The previous original sculpt also had unresolved shape/topology problems. Neither experimental mesh is used in the application or included in the static publication.

## Original model acceptance

The released mesh preserves its original closed body and mirrored paddle topology. The final pass adds a broader cranium and mandibular angles, a lower neck, cheek-wrapping mouth, fuller proximal paddles, modest camber, clearer scute boundaries and a less glossy dry shell. Its high/low geometry budget and 13-bone rig are preserved.

[NOAA's species reference](https://www.fisheries.noaa.gov/species/loggerhead-turtle) supports the large head, powerful jaws, slightly heart-shaped reddish-brown shell and pale underside. [NPS](https://www.nps.gov/ever/learn/nature/seaturtles.htm) describes the alternating loggerhead crawl. The inspected [official Timmy adult release report](https://media.visitfloridakeys.com/after-winning-hearts-timmy-the-larger-than-life-loggerhead-returns-to-sea-in-key-west/) supplies the adult silhouette and movement comparison. Reference photographs/video are private comparison material and are not baked into the project maps or distributed here.

The movement review checks alternating pushes, low recovery, body weight transfer, fixed terrain anchors and actual weighted-skin contact. In the final reviewed 16-frame cycle, 23 repeated stance contacts retain their controller anchors exactly; observed support-centroid horizontal movement is at most 2.55 mm. This is a bounded authored-gait check on the shared beach, not calibrated biomechanics or proof over arbitrary terrain. The model is accepted for this interactive diorama's scale and material style; photographic reconstruction is not claimed.

The optional activity sequence demonstrates feeding, digging, six eggs, covering and returning to the water. Six eggs are an illustrative sequence, not biological clutch size.

## Other distributed art

The pottery and seabed stars/shells are original procedural geometry. The archaeological skeleton remains a derivative of BodyParts3D under [CC BY 4.0](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html), with visible credit and modification/source records in [its provenance](../assets/archaeology/PROVENANCE.md). The project's MIT license does not replace that dataset license. Original downloaded dataset archives are excluded.

The publication allowlist includes only the runtime turtle GLB, generated JS/CSS, HTML, original poster, prompt and headers. Experimental sculpt files, downloaded candidates, research pixels and private QA evidence are excluded.
