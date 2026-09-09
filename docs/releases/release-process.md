# Linux release operations

The public Electron target is 0.3.0. Publication is pending the
[maintenance roadmap](../project/architecture/release-maintenance-roadmap.md).
The steps below describe the current tooling, not proof that the new release
has been accepted. The hard-coded baseline selection and missing verified
environment protection are tracked in Phase 6. Package metadata stays at the
internal 0.2.0 version until that tooling is migrated together.

1. Finish the required exact-SHA candidate checks and canonical Local handoff,
   then promote the unchanged candidate to main. The version must already match
   package.json and docs/releases/<version>.md.
2. Run the Release workflow from main with the stable version. It verifies the
   successful candidate evidence, packages once, qualifies an actual two-AppImage
   update and restoration, smoke-tests the target, and creates a draft.
3. Download the draft AppImage and release-manifest.json into the same directory.
   Install and test only a copy of valuable data. Record the exact AppImage SHA-256,
   update result, saved campaign changes, continued play and backup restoration.
4. Run Publish accepted release with that version, SHA-256 and acceptance record.
   Configure the GitHub `release` environment with a required reviewer. Publication
   checks the accepted hash and packaged qualification, adds the acceptance receipt,
   and publishes the existing draft without rebuilding or overwriting assets.

The first release uses a 0.1.99 qualification package of the maintenance-capable code
as its pre-baseline fixture; it is never published. Production manifests require a
clean Release-channel build. No GitHub credentials ship with the application.

Run `pnpm exec tsx scripts/qualify-release-update.ts <baseline-directory> <target-directory>`
under Xvfb to reproduce packaged qualification. Both directories contain an AppImage
and release-manifest.json. The test owns a temporary XDG data root and loopback feed;
it never reads a user's profile. Runtime redirection requires the existing explicit
E2E switch plus the release qualification switch and an isolated XDG root.

Keep the previous deployment and all backups. A failed pre-completion update can
recover on restart. A committed update never automatically restores old data after
subsequent user writes. No database downgrade or automatic backup deletion is supported.
