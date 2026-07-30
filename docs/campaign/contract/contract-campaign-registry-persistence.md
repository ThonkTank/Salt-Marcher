# Campaign Registry Persistence Contract

## Purpose And Boundary

Campaign owns the installation-wide list of Campaign identities and display
names plus the one durable active-Campaign pointer. The registry is in
`installation.sqlite`; Campaign-authored truth is in the physically separate
`campaigns/<id>/campaign.sqlite` store. Only the utility process opens either
database.

## Current Development Schema

The registry owns `campaigns` and `settings`:

- `campaigns` stores UUIDv7 `id`, non-blank `name`, creation time, and a
  creation `status` of `creating` or `ready`.
- `settings.active_campaign_id` is either absent or identifies a ready
  Campaign.

Duplicate display names are valid. Only ready Campaigns are listed or may be
activated. The renderer sees snapshots through the validated capability API,
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

## Release Boundary

This is a disposable greenfield development schema. Version ledgers,
activation generations, compare-and-set activation, compatibility readers,
and migration obligations are not current architecture. They may be introduced
only with an explicitly qualified first-release or later format decision.

## References

- [Development Persistence Contract](../../project/contract/persistence-lifecycle.md)
- [Electron Target Architecture](../../project/architecture/target-architecture.md)
