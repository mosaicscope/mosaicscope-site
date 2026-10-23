# Combined world release — 23 October 2026

The latest reported gaps are preserved verbatim:

> you didnt do teh live city thing and the deformation kinda still sucks, roulette tabble and surrounding games need more improvements, some of the caisno games still useu the old sitting down weird format, cars crashing but the bodies arent defromign proeprly, not enougj variotiuon of teh new cars,

This release combines the user-authorized work from **Continue game feature updates**, **Upgrade car driving engine**, and **Increase building scene liveliness**. The existing annotation history remains the source for earlier requests; this record describes the changes actually shipped in this pass.

## Twenty live-city tools

1. Refresh the current mapped district.
2. Refresh available weather and road conditions.
3. Reset map zoom.
4. Open the closer street camera.
5. Open the neighbourhood overview camera.
6. Toggle place labels.
7. Toggle simulated road traffic.
8. Toggle local pedestrians.
9. Toggle street furniture.
10. Toggle model-based weather effects.
11. Walk toward the nearest mapped cafe.
12. Walk toward the nearest mapped bank.
13. Walk toward the nearest mapped shop.
14. Walk toward mapped green space.
15. Approach or talk to a nearby local.
16. Inspect the nearest mapped road and its supplied tags.
17. Read the current provider's road notices.
18. Enter a nearby parked car.
19. Park and leave the driven car.
20. Cancel the walking route.

Unavailable destinations, services and nearby places are reported explicitly. Tools do not fabricate map features or road observations. Keyboard driving and click-to-walk remain available.

## Data provenance and practical limits

- Building footprints, road centre-lines and available land cover: [OpenStreetMap contributors, ODbL](https://www.openstreetmap.org/copyright). Heights and regional architecture use source tags where available and authored estimates otherwise. River widths are marked as estimates when the source supplies only a centre-line.
- Weather models: [MET Norway Locationforecast](https://api.met.no/weatherapi/locationforecast/2.0/documentation), [terms](https://docs.api.met.no/doc/TermsOfService.html), [CC BY 4.0/NLOD licence](https://docs.api.met.no/doc/License.html). The edge service identifies the app and caches results for thirty minutes. Old model series are rejected.
- New Zealand highway notices: [NZTA data](https://www.nzta.govt.nz/about-us/our-data-and-official-information/use-our-data), public NZTA Highway Information ArcGIS service. These notices do not cover every local street. A successful empty response is displayed as zero reported notices.
- London road disruptions: [Transport for London open data](https://tfl.gov.uk/info-for/open-data-users/). Other destinations show the absence of a configured road-notice feed.
- Vehicle positions and pedestrians are game simulations on mapped geometry. Nearby supported road notices and weather can affect simulated traffic. No Google account, paid feed, arbitrary scraping proxy or secret is required.
- Body crush is a bounded persistent deformation field sampled by shaded surfaces and attached fixtures. The driving engine is a tuned 2.5D tyre model. Neither is an engineering or full 3D soft-body solver.

## Release checks

Run from `game`: TypeScript, the full Vitest suite, `e2e/live-city-crush.mjs`, existing roulette/phone/scanner/props checks and `e2e/driving.mjs`. API tests run from the repository root with `node --test evolve/test/*.test.mjs`.

Browser checks exercise the twenty tool identifiers, network refreshes and attribution, persistent mapped-car damage, vehicle entry/parking, real blackjack/slots/video-poker rounds, native room cameras and desktop/phone/landscape layout. Public deployment is verified after the generated `world` assets are rebuilt and published.

Rollback trigger: a broken boot, missing generated asset, failed casino payout/round lock, corrupted owned vehicle/save, or failed map fallback. Revert the combined release commit to restore the preceding deployed game; save version remains 8 and the new optional fields are backward compatible.
