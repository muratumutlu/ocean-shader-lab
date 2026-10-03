# Ocean Shader Lab

A procedural natural coast: moving refractive water, visible shallows, shore foam, textured sand and smooth irregular rocks. An original visual shader study inspired by Marco Ludovico Perego's coastal diorama.

## Run

Node 26.7.0 / npm 11.19.0 were used. Supported even Node >=22.12 is required.

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
npm run test:e2e
```

Open http://127.0.0.1:4173. Browser tests use a separate Chromium instance. Install it once with `npx playwright install chromium`.

## Explore

Drag to orbit. Play/Pause controls waves; Coast settings exposes swell, water level, sunlight, quality and camera reset. Reduced motion starts still. Auto lowers quality after sustained slow frames; targets are 60 desktop/30 small-screen fps, not guarantees. WebGL2 is required for the live scene; a poster and retry remain available when graphics cannot start.

## Reproduce

[PROMPT.md](./PROMPT.md) is the complete reproduction prompt. The production build contains identical bytes. Locked dependencies, seed 7, common terrain data and deterministic test frames make the study reproducible.

## Embed and deployment

`wrangler.jsonc` uploads only `dist` as static assets, with no Worker script, server, database or secrets. HTTP `_headers` restricts embedding to https://portfolio.muum.ai. Local development allows the portfolio at port 4321; that development origin is absent from production. Message listeners validate both origin and sender window. Modal closure disposes renderer resources.

## Limits

Waves, caustics and foam are visual approximations. This is not a hydrodynamic solver; rocks have no physical fluid collision simulation. Performance depends on the device. Verification so far used isolated headless Chromium 153, including a mobile viewport; no physical-phone benchmark is claimed. Four-second software-GPU windows measured 32.9 rendered fps at 1440×900 and 30.2 at 390×844, with Auto reducing to Low; the hardware targets are not proven by these results. The original inspiration screenshot is not shipped.

The earlier low-poly diorama is retained only as private comparison evidence. The current scene targets higher realism but still has a procedural CGI appearance; photographic quality is not claimed. A linear colour/depth coast capture is reused between camera/light/tide/size changes, and moving water is drawn separately. All textures are original procedural data.
