# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

This project is pre-1.0 and versions all packages together. While the major
version is `0`, a **minor** bump may change the frame protocol or the GIF
layout in ways that break compatibility with files produced by an earlier
version. Patch bumps never do.

## [Unreleased]

## [0.1.0] - 2026-08-13

First published release. `@optical-transfer/core` and `@optical-transfer/gif`
are on npm; `@optical-transfer/react-native` is versioned alongside them but is
not published yet — it has no build step and its Android receive path is
unimplemented.

### Fixed

- `encodeGif` threw `The chosen QR Code version cannot contain this amount of
  data` on roughly one session in five. It sized every frame from the first
  frame's QR version, but `qrcode` picks a version from frame *content* rather
  than payload length, so a later frame could need a larger one. Frames are now
  sized to the largest version any frame in the GIF needs. This affected both
  "Share as GIF" in the example app and "Make a GIF" in the web viewer.

### Added

- Continuous integration: build, typecheck, and tests run on `main` and on
  every pull request, and CI fails if the committed web-viewer bundle is stale.
- `npm run build:viewer` rebuilds the hosted viewer bundle.

### Changed

- `@optical-transfer/gif` and `@optical-transfer/react-native` depend on
  `@optical-transfer/core` through a real semver range instead of `*`.
- `@optical-transfer/core` and `@optical-transfer/gif` rebuild on `prepack`, so
  a published tarball always carries current compiled output.

[Unreleased]: https://github.com/tristanheilman/optical-transfer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tristanheilman/optical-transfer/releases/tag/v0.1.0
