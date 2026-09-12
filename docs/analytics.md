# Google Analytics

The standalone production app uses the public GA4 measurement ID **G-FC34S4J2L2**. This is not an API secret. No backend, new dependency or GitHub secret is required.

## Visitor controls

Google's script is loaded only after the visitor chooses **Allow analytics**. **Necessary only** declines it; closing the panel leaves analytics off when no choice has been saved. Advertising consent, Google signals and ad-personalization signals remain disabled. This follows [Google's consent-mode interface](https://developers.google.com/tag-platform/security/guides/consent).

Visitors can reopen **Privacy settings** beneath the contact details in the filter panel. On mobile, open **Filters** first. Choices are stored for one year under `london-animal-rescue:analytics-consent:v1`. Missing, expired, invalid or inaccessible preferences start with analytics off. If storage is blocked or full, the choice applies to the current visit. Changes in other tabs are applied. Notebook storage is independent.

Analytics cookies use the `lar` prefix, current hostname and app base path. Withdrawing consent sets the measurement-disable flag, updates consent to denied and removes this app's analytics cookies. It does not remove notebook entries or unrelated cookies. Previously transmitted data is not retroactively removed.

## Measurement and external requests

The app configures one explicit `page_view` per page load after consent. Its page and referrer URLs exclude query strings and fragments, and there are no custom events containing searches, incident descriptions, selected records or notebook contents. Google Analytics property settings, including enhanced measurement, remain managed in Google Analytics; review those settings if changing automatic measurement behaviour. See [Google's configuration reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/config).

After consent, the browser requests `https://www.googletagmanager.com/gtag/js?id=G-FC34S4J2L2` and Google's tag can send measurements to Google Analytics collection endpoints. The map, incident snapshot, illustrations and fonts continue to load locally. A blocked Google script leaves the explorer usable. Google's [Privacy Policy](https://policies.google.com/privacy) is linked in the consent panel.

## Architecture and verification

`src/main.ts` mounts analytics separately from the explorer, only when `import.meta.env.PROD` is true. `mount()` does not install analytics when used by an embedding host, and `npm run dev` does not enable it. Production previews include the consent UI. `mountAnalytics()` returns cleanup that disables measurement, removes the added script/UI and aborts event listeners. An already executed third-party script cannot be fully unloaded; the measurement-disable flag blocks further measurement for this property.

`src/analytics-consent.ts` handles versioned consent storage. `src/analytics.ts` handles the Google tag and controls; `src/analytics.css` styles the compact panel.

```sh
npm test
BASE_PATH=/london-animal-rescue/ npm run build
# With npm run dev running:
npm run test:browser -- tests/browser/analytics.spec.ts
```

The browser fixture explicitly mounts analytics in development. Tests stub Google requests and inspect queued commands, consent, persistence, withdrawal, cookie scope, storage failure, cross-tab changes and cleanup without sending test visits to the property. These checks do not verify ingestion in Google's reports. After deployment, a real consented visit can be checked in the property's Realtime report by someone with Google Analytics access.
