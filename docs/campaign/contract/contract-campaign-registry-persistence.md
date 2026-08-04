# Campaign Registry Persistence Contract

## Purpose And Boundary

Campaign owns the installation-wide list of Campaign identities and display
names plus the one durable active-Campaign pointer. The registry is in
`installation.sqlite`; Campaign-authored truth is in the physically separate
`campaigns/<id>/campaign.sqlite` store. Only the utility process opens either
database.

## Current Development Schema

The registry owns `campaigns` and `settings`:

- `campaigns` stores UUIDv7 `id`, non-blank `name`, creation time, an optional
  trash time, and a creation `status` of `creating` or `ready`.
- `settings.active_campaign_id` is either absent or identifies a ready
  Campaign.

Duplicate display names are valid. Only ready, non-trashed Campaigns are listed
as available or may be activated. Trashed Campaigns are returned separately.
The renderer sees immutable snapshots through the validated capability API,
not SQLite errors or paths.

## Creation And Crash Recovery

Creating a name-only Campaign deliberately crosses the registry/store file
boundary in this order:

1. Commit a `creating` registry row.
2. Create and validate `campaign.sqlite` beneath `campaigns/.creating/<id>/`.
3. Atomically move that directory to `campaigns/<id>/`.
4. In one registry transaction, mark it `ready` and set the active pointer.

An interruption before the store exists is removed during next startup. An
interruption after a valid staged or final store exists is finished during next
startup. Thus recovery yields either the prior registry truth or one complete,
ready Campaign; a partial Campaign is never visible.

## Trash And Permanent Deletion

Moving a Campaign to trash first commits `trashed_at`, clears the active
pointer when necessary, and then atomically moves `campaigns/<id>/` to
`campaigns/.trash/<id>/`. Startup completes a registry-declared trash move. A
restore moves the directory back before clearing `trashed_at`; it never writes
the active pointer.

Permanent deletion is permitted only for a trashed Campaign after exact-name
confirmation. The utility process moves its directory to
`campaigns/.deleting/<id>/`, removes the registry row transactionally, and then
removes that exact staged directory. Startup treats a safe UUID directory in
`.deleting` as an interrupted confirmed deletion and completes both registry
and file removal. Renderer and main never receive delete-capable file-system
access.

## Release Boundary

This is a disposable greenfield development schema. Its narrow development
migrations keep active fixtures usable during implementation; they are not a
released compatibility promise. Activation generations, compare-and-set
activation, compatibility readers, and release-format migration obligations
may be introduced only with an explicitly qualified first-release or later
format decision.

## References

- [Development Persistence Contract](../../project/contract/persistence-lifecycle.md)
- [Electron Target Architecture](../../project/architecture/target-architecture.md)
