# Roadmap

## Goal
optical-transfer is an air-gapped, one-way file transfer. One device animates QR
frames on its screen, another films them, and the file is reconstructed with no
network, pairing or special permissions. LT fountain codes mean any ~1.15·k
frames, in any order, are enough. It is for developers who embed the transport in
their own apps, and it ships as three packages:
- `core`: a dependency-free transport
- `gif`: shareable animated GIFs
- `react-native`: sender and receiver components

There is also a hosted web viewer. Done means all three packages are on npm under
`@optical-transfer`, and the React Native package sends and receives on both iOS
and Android.

## Phases
### Phase 1 — A working transport [done]
Evidence: `core` (10 tests) and `gif` (7 tests) pass in CI on every push to main and every PR. The React Native send and receive were validated on real iPhones on iOS 16 and iOS 26, and the hosted viewer in `docs/viewer/` decodes GIFs in the browser.
### Phase 2 — First npm release of core and gif [current]
Exit when:
- `npm view @optical-transfer/core` and `npm view @optical-transfer/gif` both show 0.1.0. Today both return 404.
- Both packages install into a fresh project and run the README's quick start.
- `CHANGELOG.md` and `docs/RELEASING.md` match what is actually on the registry. They currently describe 0.1.0 as published.
### Phase 3 — React Native on both platforms [next]
Exit when:
- An Android device receives a file by filming frames, and the result matches the sent file's checksum. Android send already works.
- `packages/react-native` has a build step.
- `@optical-transfer/react-native` is ready to publish alongside `core` and `gif`.

## Side quests
- Add a short demo video to the README. `docs/demo.mp4` is referenced in a commented-out block, but the file doesn't exist. The product is easiest to understand by watching it.
- Publish a throughput benchmark: frames and seconds per KB across QR sizes and frame rates, measured on real devices. Embedders need it to set expectations.
- Add a browser sender example built on `core`, so the transfer can be tried from a laptop screen to a phone without building a native app.

## Reserved for the owner
- Publishing and unpublishing on npm, including npm login and the 2FA one-time code (`docs/RELEASING.md`), and choosing versions.
- Any change to the frame or GIF wire format, such as a binary QR mode or file metadata in the header. Receivers already in use depend on it.
- Package names, the npm org, and how releases are made.
- Deleting branches, and changing the licence.

## Settled
- **Packages publish under the `@optical-transfer` npm org**, not a personal scope, and the project keeps its generic name (`docs/plans/2026-08-13-001-feat-npm-release-prep-plan.md`).
- **`core` and `gif` release first.** `react-native` waits for a build step and Android receive (same plan).
- **Releases use plain `npm publish` with one shared version.** That replaced the changesets plus trusted-publishing design on the unmerged `codex/npm-release-ci` branch (`docs/superpowers/specs/2026-08-04-independent-npm-releases-design.md`).
- **The GIF wire format and frame protocol did not change in the encoder fix.**
