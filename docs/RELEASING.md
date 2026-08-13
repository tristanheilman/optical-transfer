# Releasing

All packages share one version number. `@optical-transfer/core` and
`@optical-transfer/gif` are published; `@optical-transfer/react-native` is
versioned with them but not published yet.

## One-time setup

1. Create the free `optical-transfer` organization at
   https://www.npmjs.com/org/create. The `@optical-transfer` scope resolves to
   this org, so it must exist before the first publish.
2. `npm login`.
3. Confirm the account can publish to the scope: `npm org ls optical-transfer`.

## Each release

1. Confirm CI is green on `main`. Nothing gets published from a red tree — npm
   only allows unpublishing within 72 hours.

2. Set the new version in all three packages and update `CHANGELOG.md`: move the
   `## [Unreleased]` entries under a new version heading with today's date, and
   update the link definitions at the bottom.

3. Publish core first, then gif. Order matters — gif depends on core through a
   semver range, so a consumer's install fails if core is not on the registry
   yet. `prepack` rebuilds each package, so no separate build step is needed.

   ```bash
   npm publish -w @optical-transfer/core
   npm publish -w @optical-transfer/gif
   ```

   With 2FA enabled, each publish prompts for a one-time code.

4. Tag and push:

   ```bash
   git tag v<version>
   git push origin v<version>
   ```

5. Verify outside this repository. A passing local suite does not prove the
   published tarball is correct:

   ```bash
   cd "$(mktemp -d)"
   npm init -y
   npm install @optical-transfer/core @optical-transfer/gif
   ```

   Then encode a payload to a GIF and decode it back, and confirm the bytes
   match.

## If a release is wrong

Within 72 hours, `npm unpublish <pkg>@<version>` removes it. After that, publish
a corrected patch version instead — republishing a version number is not
possible. If the tarball is broken but the version must stand,
`npm deprecate <pkg>@<version> "<reason>"` warns installers.
