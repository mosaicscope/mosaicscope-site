# Mosaics photo publishing

Each Mosaic has a separate in-game photo feed stored in the player's browser. The real Instagram destination is **@pymscope**. A photo is never published externally until the player clicks **Post to @pymscope** from the image-and-caption preview and the authorized publishing session is present.

## One-time connection

1. Configure an Instagram application in Meta's developer dashboard with Instagram Login and the `instagram_business_basic` and `instagram_business_content_publish` permissions. The receiving account must be an eligible professional account. Assign the account as an app tester when using development mode; obtain the required access for production use.
2. Allow this exact OAuth redirect URL: `https://mosaicscope.pages.dev/api/mosaic-instagram?action=callback`.
3. Configure these **Cloudflare Pages encrypted environment variables**, never repository files or browser input fields:
   - `INSTAGRAM_APP_ID`
   - `INSTAGRAM_APP_SECRET`
   - `MOSAIC_IG_SESSION_SECRET`: a new random secret of at least 32 characters.
   - Optional `INSTAGRAM_API_VERSION` (default `v25.0`).
4. Bind the existing `EGG` KV namespace to the Pages environment. The integration uses only its `ig:` keys; existing game statistics remain separate.
5. Open **Photo → Photo & post → Connect @pymscope**. Authorize that account in the Instagram window. Return to the photo preview and click **Post to @pymscope**. Other accounts are rejected. Reauthorize when the session or account token expires.

## Behaviour and limits

- Photo previews are cropped to a 1080 × 1080 JPEG. The chosen Mosaic's name, editable caption and game hashtags accompany the image.
- Tokens are encrypted in KV; the browser receives an HttpOnly publishing-session cookie. App secrets and Instagram tokens never enter the game bundle.
- Anonymous visitors can save to their individual game feeds or download a photo. Publishing to the real account requires the account owner's authorized session. The game does not create Instagram accounts.
- The endpoint checks the request origin, photo type, payload size and session. It rate-limits posting and records the client operation ID to prevent normal double-click retries from making duplicate posts. If Meta does not confirm publication, it asks for account review instead of silently retrying publication.
- Uploaded JPEGs expire after 24 hours. Local feeds retain up to 36 compact photos in this browser; Instagram posts persist on Instagram independently of deleting a game-feed photo.
- This is a browser-local game feed, not a shared multiplayer social network. No application credentials or account connection have been fabricated; the UI reports a missing connection explicitly.

Reference: [Meta's Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api), [Instagram Login content publishing](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/).

## Verification

`node --test evolve/test/mosaic-instagram.test.mjs` verifies unauthorized/origin rejection, OAuth state, designated-account checks, publishing caption/image URLs and duplicate suppression using mocked Meta responses. A real Instagram post requires the configured application and explicit authorization above.
