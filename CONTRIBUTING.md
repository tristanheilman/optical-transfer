# Contributing

Thanks for taking a look. This is an experimental project, so the most useful
contribution is usually a precise bug report — optical transfer fails in ways
that are hard to reproduce without knowing the exact conditions.

## Getting set up

Node 20 or newer is required.

```bash
npm install
npm test          # all workspace suites
npm run build     # compiles core and gif to dist/
npm run typecheck # includes the React Native package
```

The core test suite needs no camera and no device: it drives sender frames
straight into the receiver through a simulated channel that drops 30% of frames
and reorders the rest.

To work on the hosted GIF viewer:

```bash
npm run build:viewer   # regenerates docs/viewer/index.html
```

`docs/viewer/index.html` is a build artifact, not a source file. Commit the
rebuilt bundle along with any change to `web/viewer/`; CI fails if the committed
bundle does not match a fresh build.

To run the example app, see `packages/react-native/example`. iOS is the
supported receive path today.

## Reporting a decode failure

"It didn't decode" is very hard to act on. What makes a report actionable:

- **Which path** — the GIF path (Share as GIF, or the web viewer), or the live
  screen-to-camera path. They fail for completely different reasons.
- **Payload size and type** — bytes, and whether it was text, an image, or
  binary.
- **Block length** — the `blockLen` in use, if you changed it from the default.
- **Device and OS** on both ends, for the live camera path.
- **Whether it is reproducible** — the same file failing twice is a different
  problem from an intermittent failure. If you can pin a `sessionId` that
  reproduces it, that is the single most useful thing you can include.
- **The GIF itself**, if it is the GIF path and you can share it.

## Submitting a change

- Open an issue first for anything beyond a small fix, so the approach can be
  agreed before you spend time on it.
- Add a test that fails before your change and passes after. For intermittent
  bugs, pin the seed or session id that reproduces rather than relying on a
  loop.
- Keep the commit message about why the change is needed, not what the diff
  does.
- Add a `CHANGELOG.md` entry under `## [Unreleased]` for anything user-facing.

## Project layout

| Package | What it is |
|---|---|
| `packages/core` | The transport: fountain codec, frame protocol, sender, receiver. No dependencies, no DOM, no camera. Runs on Node, browsers, and Hermes. |
| `packages/gif` | Encodes a payload as an animated QR GIF and decodes it back. Node and browser. |
| `packages/react-native` | React Native bindings — supplies the pixels and the camera over core. |
| `web/viewer` | Source for the hosted GIF viewer; builds to `docs/viewer/`. |

Changes to the frame protocol in `packages/core` break compatibility with
previously produced GIFs and with the other end of a live transfer. Flag them
explicitly.
