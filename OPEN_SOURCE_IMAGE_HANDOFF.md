# Open-source image generation handoff — La Basil bouquet designer

## Goal
Make the existing “شاهد باقتك بصورة واقعية” action available to customers through a production server using an open-weight image model. Keep the immediate canvas preview available for every customer. Do not describe an AI output as an exact product photograph or promise exact stem counts.

## Chosen model and license
Use **FLUX.2 [klein] 4B** (the distilled 4B model), whose weights are published under Apache 2.0 and support image editing with a reference image. Check the model card and retain license notices before deployment:
- https://github.com/black-forest-labs/flux2
- https://huggingface.co/black-forest-labs/FLUX.2-klein-4B

Do not substitute FLUX.2 [dev], FLUX.2 [klein] 9B, or FLUX.1 Kontext [dev] for a commercial site without reviewing their noncommercial licenses.

## Existing project
- `index.html`, `assets/bouquet.js` and `assets/bouquet.css` provide the designer and client-side 600×600 composition image.
- `server.mjs` validates the design, applies a per-client rate limit, and currently sends the composition and structured prompt to OpenAI `/v1/images/edits`.
- `server.mjs` already strips gift-message text before image generation. Preserve this.
- `.env` contains a user-owned OpenAI secret. Never print, copy, commit, export, or expose it to the browser. Keep `.env` ignored.

## Implementation
1. Add a server-side provider switch, defaulting to the existing OpenAI behavior for local continuity. Configure the open-source mode through `IMAGE_PROVIDER=flux_local`, `FLUX_SERVICE_URL`, and a private `FLUX_SERVICE_TOKEN` in `.env` or the deployment secret store. The browser must continue calling only `/api/preview`.
2. Create a separate GPU service using Diffusers or ComfyUI with FLUX.2 [klein] 4B. It should accept the validated PNG reference and `imagePrompt(design)`, run reference-image editing, and return one PNG. Load the model once at startup and queue requests with a small concurrency limit.
3. The application server must authenticate to the GPU service, enforce request size and timeouts, and reject arbitrary URLs. Use HTTPS for any remote GPU service. Do not expose the GPU service publicly without authentication and rate limits.
4. Keep the current per-customer rate limit and add a global queue/capacity limit for GPU cost control. If generation is unavailable, show an honest status while leaving the canvas designer usable.
5. Preserve the existing approximate-preview disclosure. The model may alter flower counts, colors, or placement; the original structured design remains the source of truth for pricing and order review.
6. Do not automatically purchase GPU hosting, publish, or connect to Zed checkout. Those steps need a hosting choice and a final visual review.

## Verification
- Unit tests: provider routing, no secret exposure, invalid input, rate limits, upstream failure, response format, and preservation of the private gift-message rule.
- Integration test on an actual GPU host: generate one image from a designed bouquet; verify it appears in the mobile and desktop views, while design edits invalidate stale output.
- Load test with concurrent customers before public launch. Record latency and per-image infrastructure cost.

## Current limitation
This Windows PC has AMD Radeon 780M integrated graphics and 16 GB system RAM. It is not the customer-facing GPU host. The model requires a separate production GPU service; the open weights remove OpenAI per-image API fees but do not remove hosting cost.
