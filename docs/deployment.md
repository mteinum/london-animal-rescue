# Deploy London Animal Rescue to cPanel

This follows [Space Rocks](https://github.com/mteinum/spacerocks): GitHub Actions builds a static artifact and publishes it with SSH/rsync.

- Public URL: **https://app.teinum.no/london-animal-rescue/**
- cPanel folder: `/app.teinum.no/london-animal-rescue`
- Build base: `/london-animal-rescue/`
- Workflow: `.github/workflows/build.yml`
- Upload script: `scripts/deploy-cpanel.sh`

The script checks the destination parent first as an absolute SSH path, then beneath the account home. With the same account as Space Rocks, the expected destination is `/home/web6178/app.teinum.no/london-animal-rescue`. The parent must already exist and its canonical path is validated. Only the final application directory is created. Traversal, shell characters and paths without the `/london-animal-rescue` suffix are rejected.

## Repository settings

Configure [Actions secrets and variables](https://github.com/mteinum/london-animal-rescue/settings/secrets/actions):

| Variable          | Value                     |
| ----------------- | ------------------------- |
| `CPANEL_HOST`     | `backend08.cpanel.center` |
| `CPANEL_USERNAME` | `web6178`                 |
| `CPANEL_PORT`     | `22`                      |

The destination is fixed in the workflow; no path variable is needed. Port 2083 is the cPanel web interface and is rejected by this SSH script.

| Secret                   | Contents                                                   |
| ------------------------ | ---------------------------------------------------------- |
| `CPANEL_SSH_KEY`         | Complete private key, preserving original newlines         |
| `CPANEL_PASSWORD`        | Optional private-key passphrase                            |
| `CPANEL_SSH_KNOWN_HOSTS` | Verified server host-key entries for the hostname and port |

The `production` environment is used for deployment. Environment secrets/variables may alternatively supply these values. GitHub cannot reveal or copy another repository's secret values. The public key must be authorized for this hosting account, with SSH shell access and `rsync` installed. No Node.js runtime is needed on the server.

On 12 September 2026, the server's advertised Ed25519 public host key matched the existing local trusted SSH entry. Existing trusted entries were then stored in the repository's known-hosts secret. For future rotations, verify replacements against an existing trusted record or the hosting provider; an unverified `ssh-keyscan` result alone is insufficient. Nonstandard ports require `[HOSTNAME]:PORT` entries.

The script always enables strict host-key checking. It creates private temporary key/configuration files and an isolated SSH agent, supplies the passphrase without logging it, and removes the files and agent on exit.

## Triggers and publication

The **Build** workflow runs on pull requests, pushes to `main`, and manual dispatch:

1. Install the lockfile with `npm ci` on Node.js 22.
2. Run application, data and deployment-script tests.
3. Typecheck and build with `BASE_PATH=/london-animal-rescue/`. Use committed snapshots; do not refresh upstream data during CI.
4. Upload `dist/`, including hidden `.htaccess`, as `london-animal-rescue-dist`, retained for 14 days.
5. On `main` only, download the tested artifact and deploy over SSH/rsync.
6. Upload assets and data first, then upload a temporary index and atomically rename it to `index.html`.
7. Fetch the public URL and compare its HTML byte-for-byte with the uploaded build.

Pull requests cannot deploy. Main deployments queue instead of cancelling an active transfer. The script validates the snapshot, required map/illustration assets and bundled MapLibre worker before connecting. It does not use `rsync --delete`: older hashed assets remain usable by open tabs, and sibling application directories are untouched. Existing files with matching names inside this application's directory are updated. Only index replacement is atomic; this is not a whole-directory atomic release.

To redeploy, select **Actions → Build → Run workflow** on `main`, or push a new commit to `main`.

## Compression and URLs

`public/.htaccess` enables Apache `mod_deflate` for HTML, CSS, JavaScript, JSON, GeoJSON, text and SVG. GeoJSON has an explicit MIME type. Mutable HTML and data files use `Cache-Control: no-cache` so clients revalidate them. Hidden files are included in the artifact to preserve this configuration.

The domain needs a valid HTTPS certificate and must serve the hosting account's `app.teinum.no` document root. This static application needs no backend or route rewriting. Incident/filter share state uses query parameters at the same directory URL. All runtime assets are served under `/london-animal-rescue/`.

## Local validation

```sh
npm ci
npm test
BASE_PATH=/london-animal-rescue/ npm run build
BASE_PATH=/london-animal-rescue/ npm run preview -- --port 4174
```

Open `http://127.0.0.1:4174/london-animal-rescue/`. With Playwright Chromium installed, check the production path on desktop and mobile:

```sh
PRODUCTION_URL=http://127.0.0.1:4174/london-animal-rescue/ npm run test:browser -- tests/browser/production.spec.ts --grep 'production subdirectory'
```

The deployment tests use temporary generated encrypted keys and stub remote SSH/rsync. They check validation, upload order and cleanup without contacting the hosting provider. Creating the local SSH-agent socket requires permission in sandboxed environments. Passing these tests alone does not verify live credentials or deployment.

If deployment fails, inspect the workflow log for missing settings, SSH authorization/passphrase errors, host-key mismatch or missing destination parent. A public HTML mismatch means the domain may serve another document root or cached/rewritten HTML even if the upload succeeded.
