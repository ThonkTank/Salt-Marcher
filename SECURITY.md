# Security Policy

## Supported Version

Only the latest stable `v*` tag is supported.

## Reporting

Use GitHub private vulnerability reporting when available. If that is not
available, open a GitHub issue with the `security` label and avoid posting
secrets, tokens, private data, or local database contents.

## Local Data And Secrets

Do not commit secrets to the repository. SaltMarcher stores local SQLite data
under `$XDG_DATA_HOME/salt-marcher/` or `~/.local/share/salt-marcher/`.

The production source tree currently contains no direct `http` or `URL(`
network usage under `app/`, `shell/`, `platform/`, or `features/`; the app is
treated as local-first unless that check changes.
