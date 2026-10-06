# 26.3-JM

**Made by Joey-JM**

A custom browser build based on Eaglercraft 26.2 by o_xer, with selected Minecraft 26.3 features backported. This is not a complete official Minecraft 26.3 client.

## Download and play

1. Open [Releases](https://github.com/joeymavv/26.3-JM/releases).
2. Download `26.3-fixed.html` from the release assets.
3. Open it in a modern browser with WebAssembly GC support, such as current Chrome.

The HTML includes the game assets. An internet connection is needed for multiplayer servers. Single-player worlds are stored in the browser; export worlds from the game to back them up.

## Latest fixes

The current release asset is **[26.3-fixed.html](https://github.com/joeymavv/26.3-JM/releases/download/v26.3-jm.1/26.3-fixed.html)**.

- Poplar logs appear with the other logs; the poplar building family follows pale oak.
- Cushions place at the correct height on slabs and stairs, with working selection, seating and save/reload behavior. Supporting blocks stay intact.
- Menu and Credits version labels show **26.3-JM**.
- Startup/loading improvements from the previous update are retained.

See the [release notes](https://github.com/joeymavv/26.3-JM/releases/tag/v26.3-jm.1) for the changes, backups and test scope.

## Included features

- Mouse-wheel camera movement fix.
- Dappled Forest, poplar wood family, leaves, saplings, boats, shelf mushrooms and red shrubs.
- Sixteen colored cushions with seating and safe dismount behavior.
- One-use straw beds that preserve the player's existing respawn point.
- Colored wool and concrete stairs/slabs, recipes and concrete stonecutting.
- Abandoned camps and world-specific exploration-map rewards.
- New items in the appropriate Creative inventory categories.

Normal sound is retained. No No Lag mode is included.

## Compatibility and test coverage

The implementation uses the 26.2 engine, so some behavior differs from native 26.3. A selection of placement, crafting, sleep, seating, world generation, maps and save/reload flows has been tested. Every seed, orientation and multiplayer edge case has not been tested.

Back up your worlds before changing game versions. Do not open worlds containing these new blocks/items with an older build; that older build may discard content it does not recognize. An HTML backup does not back up your worlds.

## macOS desktop app (.dmg)

This repository also builds **26.3-JM as a native macOS application** using [Tauri 2](https://v2.tauri.app/), with ultra-high-performance mode enabled. The game HTML is embedded in the app, so it runs offline (multiplayer still needs a connection) and single-player worlds persist in a stable, app-private store.

### Get the .dmg

A `.dmg` can only be produced on macOS (it needs Xcode's toolchain and `hdiutil`), so there are two ways to get one:

**A — build it on a Mac (one command):**

```bash
bash scripts/build-dmg.sh            # Universal (Apple Silicon + Intel)
bash scripts/build-dmg.sh --native   # this Mac only, roughly twice as fast
```

The finished `.dmg` lands in `./out`.

**B — let GitHub's macOS runners build it:**

```bash
bash scripts/enable-ci.sh                                   # installs macos-dmg.yml into .github/workflows/
gh workflow run "Build macOS DMG" --ref "$(git branch --show-current)"
gh run watch
gh run download --name 26.3-JM-macOS-dmg -D ./out
```

No command line? Download **`macos-dmg.yml`** from the root of this repo and upload it on github.com via *Add file ▸ Upload files*, giving it the path `.github/workflows/macos-dmg.yml`. Then go to the *Actions* tab, pick **Build macOS DMG**, and press *Run workflow*. The DMG appears under *Artifacts* when the run finishes.

The workflow sits in the repo root rather than in `.github/workflows/` because the automation account that created it is not permitted to write workflow files. It checks out whatever branch is named in its `source_ref` input (default: this branch), so it works no matter which branch you upload it to.

Open the DMG and drag **26.3-JM** into *Applications*.

The app is not notarised, so on first launch either right-click it and choose *Open*, or run:

```bash
xattr -dr com.apple.quarantine /Applications/26.3-JM.app
```

### What "ultra high performance" means here

| Layer | Setting | Effect |
| --- | --- | --- |
| macOS | `NSSupportsAutomaticGraphicsSwitching = false` | Pins the app to the discrete/high-power GPU |
| macOS | `LSAppNapIsDisabled = true` | App Nap never throttles the process |
| WKWebView | `backgroundThrottling = "disabled"` | `requestAnimationFrame` and timers keep full rate when occluded |
| WebGL | `powerPreference: "high-performance"`, `desynchronized: true`, `alpha: false`, `preserveDrawingBuffer: false` | High-power GPU, low-latency presentation, no per-frame compositing blend |
| Audio | AudioContext auto-resume | No silent audio after focus loss |
| Storage | `navigator.storage.persist()` | Worlds are never evicted |
| Binary | `lto = "fat"`, `codegen-units = 1`, `opt-level = 3`, `panic = "abort"`, stripped | Fastest, smallest native shell |
| Signing | Hardened runtime off, JIT entitlements on | WebAssembly runs fully JIT-compiled |

### Which macOS versions does this run on?

**macOS 13 Ventura or newer, fully updated.** Universal binary — Apple Silicon and Intel.

The limit is not Tauri, it is Apple's web engine. 26.3-JM runs on **WebAssembly GC**, which WebKit only gained in **Safari 18.2** (December 2024). Because a Tauri app renders through WKWebView, it uses the system's Safari engine, so the system has to be new enough to have it.

| macOS | Can it run 26.3-JM? |
| --- | --- |
| 15 Sequoia / 26 | Yes — ships with Safari 18.2+ |
| 14 Sonoma | Yes, once Safari 18.2+ is installed via Software Update |
| 13 Ventura | Yes, once Safari 18.2+ is installed via Software Update |
| 12 Monterey and older | **No** — Safari cannot be updated to 18.2 on these. Use the browser build in Chrome instead |

If the engine is too old the app shows a plain explanation screen telling you to run Software Update, rather than a black window (`scripts/perf-preamble.js`, WasmGC probe).

### Building it yourself

Requires macOS with Xcode command line tools, [Rust](https://rustup.rs) and Node 20+.

```bash
npm install
npm run dmg          # universal binary -> src-tauri/target/universal-apple-darwin/release/bundle/dmg/
npm run dmg:native   # this machine's architecture only (faster)
npm run dev          # run the app without bundling
```

The 86 MB game payload is **not** committed. `scripts/prepare-game.mjs` downloads it from the pinned release in `game.lock.json`, verifies its SHA-256, injects `scripts/perf-preamble.js` and writes `dist/index.html`, which Tauri embeds (Brotli-compressed) into the binary.

To build against a different or local game file:

```bash
GAME_LOCAL=/path/to/26.3-fixed.html SKIP_SHA_CHECK=1 npm run dmg
```

### Desktop project layout

```
assets/app-icon.png            source icon (all sizes generated by `npm run icons`)
game.lock.json                 pinned game asset URL + checksum
scripts/prepare-game.mjs       fetch, verify, inject, emit dist/index.html
scripts/perf-preamble.js       the ultra-high-performance runtime patches
scripts/build-dmg.sh           one-command local macOS build
scripts/enable-ci.sh           installs the CI workflow into .github/workflows/
macos-dmg.yml                  GitHub Actions workflow that produces the .dmg
src-tauri/tauri.conf.json      window, Info.plist, DMG layout, bundle config
src-tauri/entitlements.plist   JIT + network entitlements
src-tauri/src/main.rs          native shell (no custom IPC, no filesystem access)
```

## Credits

- **This custom build: Made by Joey-JM.**
- Based on **Eaglercraft 26.2 by o_xer**.
- Original Eaglercraft 1.12 credits, upstream contributors and dependency notices are preserved in the in-game Credits page.
- Original Minecraft content and assets: **Mojang**.

The Joey-JM credit describes this custom build and does not replace the upstream authors' credits or notices.
