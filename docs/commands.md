# Command Reference

Every command this project supports, what it produces, and what it deletes. All paths are relative to the repo root, and every output listed here is gitignored.

Run `npm install` once before anything else.

---

## npm scripts

| Command | Runs | Produces | Removes first |
|---|---|---|---|
| `npm install` | — | `node_modules/` | — |
| `npm run build` | `node scripts/build.js` | `dist/chrome/`, `dist/firefox/`, `sonorus-chrome-v{version}.zip`, `sonorus-firefox-v{version}.zip` | `dist/` |
| `npm run package` | alias for `npm run build` | same as above | `dist/` |
| `npm run validate` | `node scripts/validate.js` | **nothing — see below** | `dist/`, both zips |
| `npm run dev:firefox` | `node scripts/dev-firefox.js` | `dev-firefox/` | `dev-firefox/` |
| `npm run dev:safari` | `bash scripts/safari.sh --force` | `safari/`, plus everything `build` makes | `safari/`, `dist/` |

> **`npm run validate` leaves nothing behind.** It builds, asserts, then deletes `dist/` and both zips on its way out — pass or fail. If you want the artifacts, run `npm run build`. Running `validate` and then looking for a zip to upload will find nothing.

Each script can also be called directly, which is identical to the npm form:

| Direct invocation | Equivalent to |
|---|---|
| `node scripts/build.js` | `npm run build` |
| `node scripts/validate.js` | `npm run validate` |
| `node scripts/dev-firefox.js` | `npm run dev:firefox` |
| `bash scripts/safari.sh --force` | `npm run dev:safari` |

---

## `scripts/safari.sh`

macOS only, and requires full Xcode (not just Command Line Tools). Generates an Xcode app wrapper around the Chrome build — needed for distribution, **not** for day-to-day Safari development. See [safari-support.md](safari-support.md).

| Flag | Effect |
|---|---|
| `--bundle-id <id>` | Bundle identifier (default `com.0xSiddhant.Sonorus`) |
| `--build` | Compile with `xcodebuild` after generating |
| `--open` | Open the project in Xcode when finished |
| `--force` | Overwrite an existing `safari/` instead of refusing |
| `--help` | Print usage and exit — ignores all other flags |

`--build`, `--open`, and `--force` are independent booleans, so all eight combinations are valid and order does not matter. `--bundle-id` is orthogonal and may be added to any row.

| # | Command | Behaviour |
|---|---|---|
| 1 | `scripts/safari.sh` | Generate only. **Fails if `safari/` already exists.** |
| 2 | `scripts/safari.sh --force` | Generate, overwriting `safari/`. *(this is `npm run dev:safari`)* |
| 3 | `scripts/safari.sh --build` | Generate + compile. Fails if `safari/` exists. |
| 4 | `scripts/safari.sh --open` | Generate + open Xcode. Fails if `safari/` exists. |
| 5 | `scripts/safari.sh --force --build` | Overwrite + compile. Most useful for verifying a change compiles. |
| 6 | `scripts/safari.sh --force --open` | Overwrite + open Xcode. |
| 7 | `scripts/safari.sh --build --open` | Compile + open. Fails if `safari/` exists. |
| 8 | `scripts/safari.sh --force --build --open` | Everything — the full local loop. |

With a custom identifier, e.g.:

```bash
scripts/safari.sh --force --build --bundle-id com.yourname.Sonorus
```

**Outputs:** `safari/Sonorus/Sonorus.xcodeproj` always; `safari/build/` and `safari/build.log` only with `--build`. On a compile failure the last 20 log lines are printed and the script exits 1.

---

## Loading into each browser

These are not shell commands — they are what you point each browser at after building.

| Browser | Build first | Then load |
|---|---|---|
| Chrome / Edge / Opera / Brave | none needed | `chrome://extensions` → Developer Mode → **Load unpacked** → `src/` |
| Firefox | `npm run dev:firefox` | `about:debugging` → This Firefox → **Load Temporary Add-on** → `dev-firefox/` |
| Safari 26+ | `npm run build` | Settings → Developer → **Add Temporary Extension…** → `dist/chrome/` |
| Safari (persistent) | `npm run dev:safari` | Open `safari/Sonorus/Sonorus.xcodeproj`, set signing Team, run the app |

Chromium browsers can load `src/` directly because `src/manifest.json` is already the Chrome manifest. Firefox and Safari cannot — Firefox would pick up the wrong manifest from `src/`, and Safari would bundle the unused `manifest.firefox.json` as a stray resource. Both need a staged folder.

---

## What runs in CI

| Workflow | Trigger | Commands |
|---|---|---|
| `pr-validate.yml` | Any pull request | Conventional-commit title check, then `npm install` + `npm run validate` |
| `release.yml` | Push to `main` | Derives the version bump from commit messages, builds both zips, tags, and attaches them to a GitHub release |

There is no Safari step in CI. An unsigned `.app` is useless to end users, so automating it would require a signing certificate and `notarytool` credentials as repository secrets — see [safari-support.md](safari-support.md#there-is-no-safari-zip).

---

## Artifacts at a glance

| Path | Created by | Purpose |
|---|---|---|
| `dist/chrome/` | `build` | Chrome/Edge/Opera/Brave unpacked build; also the Safari input |
| `dist/firefox/` | `build` | Firefox unpacked build |
| `sonorus-chrome-v{version}.zip` | `build` | Chrome Web Store upload |
| `sonorus-firefox-v{version}.zip` | `build` | addons.mozilla.org upload |
| `dev-firefox/` | `dev:firefox` | Staged folder for Firefox temporary add-on loading |
| `safari/` | `dev:safari` | Generated Xcode project (macOS app wrapper) |

There is no Safari zip — Apple's pipeline accepts a signed app archive, not a zip of extension files, and the Safari resources are byte-identical to `dist/chrome` anyway.
