# Dokumentationslücken

Liste aller aktuell fehlenden Dokumentationsstellen im Repository.

## Ordner ohne `AGENTS.md`

- `salt-marcher/src/apps/cartographer/modes`
- `salt-marcher/src/apps/cartographer/modes/travel-guide`
- `salt-marcher/src/apps/cartographer/travel`
- `salt-marcher/src/apps/cartographer/travel/domain`
- `salt-marcher/src/apps/cartographer/travel/infra`
- `salt-marcher/src/apps/cartographer/travel/render`
- `salt-marcher/src/apps/cartographer/travel/ui`
- `salt-marcher/src/apps/cartographer/view-shell`
- `salt-marcher/src/apps/library/core`
- `salt-marcher/src/apps/library/create`
- `salt-marcher/src/apps/library/create/creature`
- `salt-marcher/src/apps/library/create/shared`
- `salt-marcher/src/apps/library/create/spell`
- `salt-marcher/src/apps/library/view`
- `salt-marcher/src/core/hex-mapper`
- `salt-marcher/src/core/hex-mapper/render`
- `salt-marcher/tests`
- `salt-marcher/tests/app`
- `salt-marcher/tests/cartographer`
- `salt-marcher/tests/cartographer/editor`
- `salt-marcher/tests/cartographer/travel`
- `salt-marcher/tests/core`
- `salt-marcher/tests/encounter`
- `salt-marcher/tests/library`
- `salt-marcher/tests/mocks`
- `salt-marcher/tests/ui`

## Skripte ohne Kopfkommentar

- `salt-marcher/tests/app/terrain-watcher.test.ts`
- `salt-marcher/tests/cartographer/editor/terrain-brush-options.test.ts`
- `salt-marcher/tests/cartographer/editor/tool-manager.test.ts`
- `salt-marcher/tests/cartographer/mode-registry.test.ts`
- `salt-marcher/tests/cartographer/presenter.test.ts`
- `salt-marcher/tests/cartographer/travel/token-layer.test.ts`
- `salt-marcher/tests/core/regions-store.test.ts`
- `salt-marcher/tests/encounter/event-builder.test.ts`
- `salt-marcher/tests/encounter/presenter.test.ts`
- `salt-marcher/tests/library/view.test.ts`
- `salt-marcher/tests/mocks/obsidian.ts`
- `salt-marcher/tests/ui/language-policy.test.ts`
- `salt-marcher/tests/ui/map-manager.test.ts`

## Prüfmethodik

- Ordner-Scan: `python - <<'PY' ... if 'AGENTS.md' not in filenames ...` (siehe Shell-Historie).
- Skript-Scan: `python - <<'PY' ... if not first.startswith('// ') ...`.
