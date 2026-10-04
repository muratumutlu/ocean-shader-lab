# Original living-cove turtle
Project-authored mesh, textures, skin weights, rig and clips. No third-party model,
image, generated-asset API or paid source was used.
The project MIT license is in ../../LICENSE; the model is part of that project.

Source: ../../tools/turtle-authoring.ts
Build: npm run assets:turtle (uses the current local preview on port4175).
Exporter: installed Three.js GLTFExporter, binary glTF2, embedded512px original
procedural shell/skin textures, high/low LOD with a shared11-bone rig and2materials.
Clips: Swim, Crawl, Idle. No external animation or reference-image bytes are used.
Independent binary verifier: ../../scripts/assets/verify-turtle.mjs.
Manifest hash, byte/triangle counts and sampled animated proxy bounds are derived
from the emitted binary. Pose samples include swimming pitch±12degrees and land
pitch/roll±25degrees. Visual and ground-contact acceptance is separate from binary
contract acceptance. A bounded proxy alone does not prove natural grounded motion.
