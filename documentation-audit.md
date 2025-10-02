# Dokumentationslücken

Liste aller aktuell fehlenden Dokumentationsstellen im Repository.

## Ordner ohne `AGENTS.md`

- Keine (Stand: aktuelle Änderungen eingepflegt, erneut geprüft am 2025-10-02).

## Skripte ohne Kopfkommentar

- Keine (Stand: aktuelle Änderungen eingepflegt, erneut geprüft am 2025-10-02).

## Prüfmethodik

- Ordner-Scan: `python - <<'PY' ... if 'AGENTS.md' not in filenames ...` (siehe Shell-Historie).
- Skript-Scan: `python - <<'PY' ... if not first.startswith('// ') ...`.
