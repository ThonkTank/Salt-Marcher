# Terminologie vereinheitlichen

## Originalkritik
> Namensgebung und Kommentare wechseln zwischen Englisch und Deutsch (z. B. englische Fehlermeldungen neben deutschsprachigen Notices), was Konsistenz und Lesbarkeit beeinträchtigt.【F:salt-marcher/src/ui/map-manager.ts†L1-L93】【F:salt-marcher/src/apps/library/view.ts†L46-L140】

## Kontext
- Module: `salt-marcher/src/ui/map-manager.ts`, `salt-marcher/src/apps/library/view.ts` und weitere UI-Komponenten.
- Nutzer-facing Texte mischen Sprachen; Entwicklerkommentare folgen keinem klaren Standard.
- Dokumentationsrichtlinien verlangen konsistente Terminologie.

## Lösungsideen
- Einheitliche Sprache (vorzugsweise Englisch) für UI-Texte, Notices und Kommentare definieren.
- Audit der UI-Module durchführen und Texte/Kommentare angleichen.
- Dokumentation (`salt-marcher/docs/ui/README.md`, `salt-marcher/docs/library/README.md`) um Terminologie-Standard ergänzen, sobald umgesetzt.
- Automatisierte Checks (z. B. Lint-Regeln oder Styleguide-Hinweise) prüfen, ob Mischformen künftig verhindert werden können.
