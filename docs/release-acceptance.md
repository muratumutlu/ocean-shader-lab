# Living Cove release acceptance

Local and public release review completed on 5 October 2026 with Chromium/ANGLE Metal on the Mac. This records source, tests, rendered local behavior and the separately verified Cloudflare publication.

## Reviewed surfaces

| Surface | Acceptance and evidence |
| --- | --- |
| Adult Caretta | Front, side, top and three-quarter views show the revised broad head/jaw, low neck, heart-shaped brown carapace, principal scutes and fuller proximal flippers. Accepted as an original diorama-scale approximation. |
| Crawl | Sixteen phase samples and an eight-second render recording show alternating pushes, low recovery and body weight transfer. In 23 repeated stance checks, controller anchors have zero horizontal drift; the actual skinned support centroid moves at most 2.55 mm. Sampled skin/terrain clearance is 2.94–3.41 mm on this beach. |
| Sand tracks | Front/rear contact strips and body scuffs are visible on dry sand. Raised recovery breaks history; tide/time fade and a 144-instance cap are tested. |
| Seabed and water | Original stars, spiral shells and bivalves were reviewed above/below water, along with submerged rocks and four cutaway views. The bounded camera-orbit normal response has decay, pause and integration coverage. |
| Feeding/nesting | Production factories complete the opt-in sequence: four seconds of feeding contact, digging, six visible posterior eggs, full covering and return to water. Final state is `finished`, coverage is 1, and feeding/nest failure fields are null. Six eggs are illustrative. |
| Camera/zoom | Actual route controls plus camera/input browser tests cover orbit, focus, zoom, collision, turtle follow and return. |
| Geology/pottery/skeleton | Front/west/east/rear cutaway, pottery mouth, skeleton oblique and skull views were inspected. Layer continuity, hollow pottery and the skeleton's placement are accepted for the diorama. BodyParts3D attribution remains visible. |
| Responsive controls | Actual production route and built preview were reviewed at 1440×900 and 390×844; Coast settings, routine start/stop, Turtle and Return controls operate. The control token check passes with 90 documented tokens. |

## Verification

- Full TypeScript, 121 unit tests in 32 files and 33 browser tests passed during the release pass. The browser suite includes navigation and embedded texture loading with the actual production bundle and CSP, asserting no browser errors.
- After the final flipper-albedo export, the 22 affected anatomy/asset/contact/routine/crawl tests passed again; TypeScript, token check, full visual suite and build passed again.
- The independently decoded GLB retains 7,932/2,472 triangles, 13 bones, two materials and Swim/Crawl/Idle clips. Its 693 sampled poses verify before replacement. Final binary: 3,079,188 bytes; SHA-256 `aac6c43d7238a3035f57efdd57b71385249c861ede3e9f7dfb18983d384cade4`.
- The static build passes the seven-file publication allowlist, exact turtle byte match and unchanged prompt hash. Experimental sculpts, CC0 candidate, private reference photos/video and QA evidence are excluded.

`scripts/qa/review-release.mjs` reproduces the anatomy, scene/routine/contact review and normal production controls. Local screenshots, samples and the recording are under ignored `docs/evidence/living-cove/release-review-20261005/`; built-route captures are under `built-release-review-20261005/`. The public README image is an original rendered screenshot.

## Published verification

[Living Cove](https://ocean-shader-lab.muum-dev-account.workers.dev/) is published as a static Cloudflare Worker. The dashboard shows version prefix `7d69b6bd` receiving 100% of traffic. At 15:23:54 UTC, `scripts/qa/verify-live.mjs` verified all six publicly served files byte for byte against the seven-file build, including the original turtle hash above. `_headers` is applied as HTTP rules and is not served as a file. The CSP and other declared response headers match; `_headers`, `.env`, `docs/evidence/` and `assets/candidate.glb` return 404.

Initial live acceptance caught CSP failures in Rapier's WebAssembly initialization and GLTFLoader's embedded image loading. The final policy permits `wasm-unsafe-eval` for WebAssembly, `blob:` for local embedded textures and `data:` for images, including the empty favicon. JavaScript eval, inline scripts and external connection hosts remain blocked. The production-bundle regression test reproduced the failures before the fix and passes with zero browser errors afterward.

At 15:23:55 UTC, the actual public route passed 1440×900 and 390×844 control reviews: settings, Play, routine start/stop, Turtle and Return. The final live capture reports `errors: []`; the brown shell and skin textures are visible. Screenshots and the capture record are in ignored `docs/evidence/living-cove/live-release-review-20261005/`. The interactive browser independently confirmed navigation and Turtle/Return on the public URL. The full feeding/nesting sequence and detailed terrain/contact measurements use the production factories in the local visual suite described above.

## Limits

This is visual and functional acceptance at the scene's scale, not a scan, photographic reconstruction, biological measurement or guarantee over arbitrary terrain. The mobile-sized viewport uses the Mac GPU, not a physical phone. The approximately 14 MB minified / 4.1 MB gzip JavaScript bundle still produces Vite's large-chunk warning; this pass does not establish a new performance result. Source and art licensing are explained in [model evaluation](./model-evaluation.md) and the asset provenance documents.
