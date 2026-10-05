# Original living-cove Caretta caretta

Project-authored mesh, textures, skin weights, rig and clips. The model is part
of the project under the MIT license in ../../LICENSE. No third-party model,
texture, animation, generated-asset API or paid asset was incorporated.

Editable sources: ../../tools/turtle-authoring.ts and ../../tools/turtle-anatomy.ts.
Build: npm run assets:turtle (uses the local preview on port 4173; override with TURTLE_AUTHOR_URL).
Exporter: installed Three.js GLTFExporter, binary glTF 2, embedded original
1024px shell/skin albedo, 384px normal and 256px regional roughness textures
(six embedded original maps). High/low LOD share 13 bones and 2 materials.
Clips: Swim (2.4s), Crawl (3.2s), Idle (5s), each with 13 channels.
Independent binary verifier: ../../scripts/assets/verify-turtle.mjs.

The 2026-10-04 Caretta reconstruction supersedes the green-turtle-informed
anatomical checkpoint. The original continuous closed torso, neck, cranium and
beak surface has a broad low loggerhead skull, a short wide blunt rostrum,
fuller lower jaw, restrained neck arch, inset corneal lenses, fitted irregular
scaled eyelids, mouth and nostrils. The ruddy brown
heart-shaped carapace has five central and five lateral principal scutes on each
side; this describes the 15 principal dorsal fields, not every marginal scute.
Irregular authored marginal sectors, fine lip wear and regional mottling break
up the principal scute fields. Closed asymmetric thin front blades and shorter
rear fans use short proximal joints; two small authored claws per paddle share
the original skin material and rig. Dorsal-frame kinematics constrain blade
twist and virtual fold (145 degrees front / 130 rear), artistic joint bounds
rather than measured anatomical angles.
Mirrored paddle winding and continuous closed body topology are tested. A convex UV-isolated keratin cap
replaces the flat front face; upper beak, lower jaw and forehead have distinct
original tones. Wrapped head/neck color fields and shared-position normals
remove the front seam. Fleshier proximal fore blades blend into asymmetric
leading/trailing contours. Marginal wear is narrower, darker and regionally
broken instead of a broad uniform yellow shell band.

Official anatomical/track references, inspected as actual pixels in private QA:
- NOAA Fisheries loggerhead species photograph, credited NEFSC/CFF:
  https://www.fisheries.noaa.gov/species/loggerhead-turtle
- National Park Service adult loggerhead frontal photograph and loggerhead
  tracks: https://www.nps.gov/articles/000/turtle-activity.htm
- National Park Service loggerhead alternating crawl / track description:
  https://home.nps.gov/ever/learn/nature/seaturtles.htm
- National Park Service loggerhead identification / lateral scutes:
  https://www.nps.gov/foma/learn/nature/sea-turtles.htm

Motion reference inspected from sampled actual public NOAA video frames:
https://videos.fisheries.noaa.gov/detail/video/6168058167001/meet-joy-our-young-loggerhead-turtle
Joy is a recovering injured juvenile. Its abnormal/asymmetric movement is not
used as a healthy adult biomechanical measurement. An official NPS nesting
video showed a ranger beside a nest, not the turtle crawling. An official
Loggerhead Marinelife Center adult-release YouTube link stalled even with
ordinary playback from the start. It is not used as verified gait evidence.

Actual adult release footage subsequently inspected: Timmy, a 270lb adult
female loggerhead cleared for release after rehabilitation, from the official
Florida Keys News Bureau / Turtle Hospital report:
https://media.visitfloridakeys.com/after-winning-hearts-timmy-the-larger-than-life-loggerhead-returns-to-sea-in-key-west/
The publisher's actual 197.030-second, 1920x1080 MP4 was retrieved through its
explicit public Drive link without login, new grants or disabled TLS verification.
A coarse whole-video sequence, 48 actual frames at 4fps from 10–22 seconds, an
11.5-second frame and its official adult photograph were inspected. These show
low body posture, alternating broad fore sweeps, short rear fans and push-linked
progress. This is sampled visual comparison, not continuous real-time viewing,
calibrated speed, universal healthy-adult timing or a claim that this previously
rehabilitated animal represents every loggerhead. Video credit: Florida Keys
News Bureau; photo credit: Larry Blackburn / Florida Keys News Bureau.

Research photos/video remain private comparison material under
../../docs/evidence/living-cove/b23-loggerhead-references and
../../docs/evidence/living-cove/b31-timmy-adult-reference; no third-party pixels
are embedded in the original meshes, textures or production page. No Sketchfab model was adopted.
This is an artistic anatomical and motion approximation, not measured biology
or photographic acceptance.

Crawl uses alternating left/right cycles offset by half of its 3.2-second period.
Both front and rear paddles have independent two-joint kinematics, real world
terrain contact anchors and reach release during turns. Runtime phase follows
actual horizontal distance. Advancement varies with bounded contact-push
profiles rather than constant land speed; body pitch/roll/lift and a small support-side lateral shift follow those
profiles. The latest focused pass increases the push-linked shift without
changing the world contact goals. Crawl blends into the separate Idle body pose
as motion stops; independently decoded Idle torso samples keep its support
consistent with that blend. These timings and amplitudes are authored, informed by the adult video.
Recovery includes an outward arc and lowers gradually during rest. The runtime
view transforms each world anchor into the actual animated Body frame before IK.
Regional roughness and restrained darkening vary with swimming transition.

Root support uses independently decoded head/torso/shell vertices whose binary
skin weights have no runtime-controlled limb influence; all-skin samples and
bounds are retained. This prevents the baked paddle pose from also lifting the
body after the four runtime paddles have been terrain-anchored. A raised neutral
land rostrum avoids making a downward-posed beak the support point on an uphill
beach. Whole animated skin penetration and actual plastron gap are checked
separately; this is not a guarantee over arbitrary terrain.

Rear contacts emit stronger curved sand scrapes and fore marks stay subtle.
Consecutive actual near-ground limb positions join through short terrain-bound
strips; raised recovery and contact jumps break the history so traces do not
bridge through air. Near-ground dry body motion joins center scuffs along the
actual traveled contact path rather than repeated isolated belly stamps. Decals sample the
shared height grid bilinearly per vertex, using a borrowed texture. Tracks are one
bounded draw with 144 instances (192 triangles per instance), duplicate-contact
suppression, time/tide fading and reset/disposal. They are an artistic track
approximation, not a biological track-width or gait-speed measurement.

Manifest hash, byte/triangle counts and animated proxy bounds derive from the
emitted binary. 693 independently sampled binary poses include swimming
pitch ±12 degrees and land pitch/roll ±25 degrees. Export candidates verify
before replacing production GLB and manifest. Skin support resolves shoreline
terrain contact; rocks and walls retain physical collision. Binary and contact
checks do not establish photographic quality or measured natural motion.

The 5 October release pass widens the adult cranium and mandibular angles,
lowers the neck section profile, wraps the mouth line toward the cheeks,
thickens proximal paddles and adds slight blade camber. Dorsal seam/worn-edge
contrast makes principal scutes readable; higher regional shell roughness
reduces the dry shell's broad sheen. Dorsal flippers use dull brown skin with
paler undersides, matching the adult coloration described by NOAA. The unchanged 7,932/2,472 triangle budgets,
13 bones and original topology contract are retained. No failed sculpt or
downloaded candidate was promoted.

Front/rear recovery lift is now 110/55 mm in the original scene scale;
push-linked lateral body shift is 16 mm. The terrain anchor and smooth final
weighted-skin contact adapter remain in use. The updated binary's SHA-256 is
aac6c43d7238a3035f57efdd57b71385249c861ede3e9f7dfb18983d384cade4.
Its unchanged anterior mouth and distal hind probes are bound to that exact
binary in the runtime activity/contact profiles. The complete feeding and
nesting clearance tests pass for this revision.

This release is an original adult loggerhead approximation for an interactive
coastal diorama. Multi-view and movement review does not make it a scan,
photographic reconstruction or measured biomechanical model. Free replacement
evaluation and the distribution decision are recorded in ../../docs/model-evaluation.md.
