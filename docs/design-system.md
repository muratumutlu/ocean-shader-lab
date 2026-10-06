# Living Cove design system

This records the existing scene and controls before the final Caretta pass. Reuse these primitives; the full-screen canvas, corner title, compact toolbar and floating Coast settings panel remain the page's visual system.

## Controls

The source of truth is `src/styles.css`. Colors, pixel lengths and font families are exposed as CSS custom properties in `:root`; the palette update retains their existing roles and layout. The dark blue-grey controls use translucent toolbar/panel surfaces, pale warm text, muted teal labels, a teal selected state and a pale mint focus outline. The canvas background is owned by the renderer. The reference-led coastal palette uses warm ivory, golden sand and mint-turquoise water; heading, credit and navigation text use dark teal for contrast on the lighter scene. The control panels remain dark.

- Body: Avenir Next, Trebuchet MS, sans-serif. Display: Georgia, Times New Roman, serif.
- Labels: 9–13 px; toolbar: 11–12 px. Title: responsive 32–46 px, 36 px on narrow screens.
- Touch target: 44 px minimum. Spacing comes from the documented `--size-*` scale in `:root`, derived from the existing page.
- Radius: controls 4–6 px; toolbar 7 px; panel 9 px; fallback poster 12 px. Border 1 px; focus outline 2 px.
- Desktop inset: title/credit 42 px, toolbar 38 px. Mobile inset: 22 px. The existing 600 px media breakpoint remains literal because custom properties cannot be used in media conditions.
- Preserve pressed, disabled, keyboard-focus and touch-control states. Use `var(...)` for recurring control colors, lengths and font families. Dimensionless proportions, relative units and zero remain literal.

## Scene primitives

Scene palettes and geometry live in their existing owners, not UI palette classes: `scene/textures.ts` and `scene/terrain.ts` for sand/rock; `scene/strata.ts` for the cutaway; `scene/seabed.ts` for shells/stars; `water/*.glsl` for optics; `tools/turtle-anatomy.ts` for original Caretta maps. New models reuse the current light, exposure, water, scale and material language.

The Caretta's reddish-brown scutes, olive/brown scaled skin, pale keratin and plastron are authored in `tools/turtle-anatomy.ts`. Shared `CARAPACE_RISE`, section profiles, flipper contours and the two original PBR materials define both LODs. Anatomical and motion parameters are artistic controls, not biological measurements. Reuse the 13-bone rig and high/low mesh naming contract. Do not introduce a second renderer or UI control language for the turtle.

Contact imprints use the existing terrain-bound shader in `turtle/contact-trails.ts`: front/rear maximum opacity 0.22/0.32, the shared sand palette, a soft groove and raised-edge shading. These are shallow sand marks and fade with simulation time and tide. The mobile credit uses a middle-dot separator when its desktop line break is hidden.

Run `npm run design:check` for control token compliance. Visual acceptance also requires the rendered production route at desktop and mobile sizes; token checks do not establish anatomy, natural gait or optical quality.

## Exact control tokens

| Token | Existing value |
| --- | --- |
| `--color-text-base` | `#e7e3d6` |
| `--color-fallback-surface` | `#171c20` |
| `--color-text-study-muted` | `#abb7b8` |
| `--color-text-title-warm` | `#ebe8db` |
| `--color-text-credit-muted` | `#a5afb0` |
| `--color-text-status-muted` | `#b4c7ca` |
| `--color-text-fallback` | `#b3c0c1` |
| `--color-border-retry` | `#6c8284` |
| `--color-retry-surface` | `#263438` |
| `--color-focus-ring` | `#bae7dd` |
| `--color-toolbar-surface` | `#202a2edb` |
| `--color-toolbar-border` | `#425255` |
| `--color-shadow-toolbar` | `#0002` |
| `--color-control-hover` | `#34454a` |
| `--color-divider` | `#506268` |
| `--color-panel-surface` | `#202a2ef5` |
| `--color-panel-border` | `#46585b` |
| `--color-shadow-panel` | `#0005` |
| `--color-panel-label` | `#c5d2d1` |
| `--color-panel-value` | `#91bdb9` |
| `--color-control-accent` | `#a6dace` |
| `--color-select-text` | `#e4edeb` |
| `--color-select-surface` | `#314346` |
| `--color-select-border` | `#596e6e` |
| `--color-panel-caption` | `#96aaa9` |
| `--color-reset-border` | `#546b6d` |
| `--color-panel-hint` | `#8caaaa` |
| `--color-standalone-surface` | `#23383a` |
| `--color-fallback-link` | `#b9d8cf` |
| `--color-title-shadow-coast` | `#173b4966` |
| `--color-text-light` | `#203b35` |
| `--color-light-shadow` | `#ffffff99` |
| `--color-heading-wash-coast` | `#16304455` |
| `--color-text-day` | `#203e49` |
| `--color-day-shadow` | `#ffffff80` |
| `--color-heading-wash-day` | `#ffffff33` |
| `--color-text-heading` | `#29433f` |
| `--color-heading-shadow` | `#ffffff80` |
| `--color-heading-wash` | `#eeeae544` |
| `--color-canvas-focus` | `#397d73` |
| `--color-navigation-hint` | `#24423b` |
| `--color-control-selected` | `#3c5357` |
| `--color-touch-border` | `#536e73` |
| `--color-touch-surface` | `#243b40db` |
| `--color-turtle-retry-border` | `#597579` |
| `--color-turtle-retry-surface` | `#2e4649` |
| `--color-return-surface` | `#2b4448` |
| `--color-return-border` | `#5b757b` |

The pixel scale is `--size-1: 1px`, `--size-2: 2px`, `--size-3: 3px`, `--size-4: 4px`, `--size-5: 5px`, `--size-6: 6px`, `--size-7: 7px`, `--size-8: 8px`, `--size-9: 9px`, `--size-10: 10px`, `--size-11: 11px`, `--size-12: 12px`, `--size-13: 13px`, `--size-14: 14px`, `--size-15: 15px`, `--size-16: 16px`, `--size-18: 18px`, `--size-20: 20px`, `--size-22: 22px`, `--size-23: 23px`, `--size-24: 24px`, `--size-30: 30px`, `--size-32: 32px`, `--size-34: 34px`, `--size-36: 36px`, `--size-38: 38px`, `--size-40: 40px`, `--size-42: 42px`, `--size-44: 44px`, `--size-45: 45px`, `--size-46: 46px`, `--size-58: 58px`, `--size-78: 78px`, `--size-220: 220px`, `--size-260: 260px`, `--size-296: 296px`, `--size-520: 520px`, `--size-540: 540px`, `--size-560: 560px`, `--size-650: 650px`. All values are preserved from the existing stylesheet.
