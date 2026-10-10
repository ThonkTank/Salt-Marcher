# Vorlage für einen begrenzten Paketplan

Ein kurzer Plan im bestehenden Issue/PR genügt für Routinearbeit. Eine eigene Datei hilft bei komplexen Verträgen/Quellenmatrizen. Dann kopiere die folgende Struktur nach `docs/plans/<bereich>/<paket>.md`, ersetze die Beispielwerte und verlinke den Plan im passenden Abschnitt von [INDEX](../INDEX.md). `checkpoint` nennt eine eigene bereits vorhandene Wurzel in `checkpoint.json`; eine neue Zuständigkeit und Wurzel ausdrücklich im Paket festhalten. Keine fremde Wurzel übernehmen.

```markdown
---
area: dungeon
owner: konkrete Agent- oder Ownerrolle
issue: 46
status: draft
checkpoint: parityRoadmap
---
# Paketname und konkretes Nutzerergebnis

## Scope und Eingänge
Vorhandener Fachvertrag, Quellen, Kandidat, benötigte Eingänge und geschützte Daten.

## Vorgehen und Abnahme
Begrenzte Änderung; direkte beobachtbare Ergebnisse und passende Prüfungen.
Ein zusammenhängendes Ergebnispaket; notwendige Tests und Bereinigung dazugehören lassen.
Hilfsarbeit nennt das konkrete konsumierende Umsetzungspaket/den Owner.
Nur teilen, wenn der Teil eigenständig nützt oder eine echte Übergangsgrenze braucht.

## Übergabe
Exakter Commit, ausgeführte Prüfungen, offene Grenzen und nächster Empfänger.
Aktueller Laufstand bleibt in der eigenen Checkpointwurzel.
```

Erlaubte Dokumentstatus: `draft`, `active`, `complete`, `superseded`. Bei `superseded` zusätzlich `superseded_by: docs/plans/<bereich>/<nachfolger>.md` angeben. Ein abgeschlossener Plan oder eine Strukturprüfung schließen keine Produktabnahme.
