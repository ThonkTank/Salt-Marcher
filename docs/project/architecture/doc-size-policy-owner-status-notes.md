Status: Active
Owner: Aaron
Last Reviewed: 2026-07-10
Source of Truth: German owner-facing status notes for the document size and
focus policy roadmap.

# Dokumentgroesse Owner-Status

## 2026-07-10 M0 Gate-Inversion

Die neue Roadmap liegt im Repo unter
`docs/project/architecture/doc-size-policy-vision-and-roadmap.md` und ist die
aktive Arbeitsgrundlage fuer die Umstellung der Dokumentgroessen-Regel.

Der alte harte 350-Zeilen-Blocker wird in M0 entfernt. Groesse wird nur noch
als Signal behandelt: Ab 400 Zeilen soll ein `doc-split`-Issue entstehen, aber
die Dokumentation darf nicht wegen Laenge weggelassen, gekuerzt oder an die
falsche Stelle verschoben werden.

Proof: `./gradlew checkDocumentationEnforcement --console=plain` und
`git diff --check` sind am 2026-07-10 gruen gelaufen. Der naechste
Roadmap-Schritt ist M1: Split-Protokoll plus ein akzeptierter Pilot-Split.

## References

- [Document Size Policy Roadmap](doc-size-policy-vision-and-roadmap.md)
- [Document Size Policy Ledger](doc-size-policy-ledger.md)
