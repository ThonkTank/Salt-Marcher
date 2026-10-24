# Begegnungsbogen aus dem Abenteuertag

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: campaign
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Begegnungsbogen aus dem Abenteuertag

Der Desktop verwendet für neue Spielabende die rationale Zielaufteilung aus dem
[gebundenen Session-Generation-Original](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/sessiongeneration/requirements/requirements-session-generation.md).
`generation/session-targets.ts` normalisiert Levelanzahlen und berechnet das
Tagesbudget mit exakter Dezimalarithmetik und kaufmännischer Rundung. Der Einstieg
beginnt bei 85 % der mittleren Schwelle, der Abschluss bei der tödlichen Schwelle;
die Zwischenziele interpolieren Richtung schwer. Die Gewichte werden auf das
Planungsbudget skaliert, der letzte Wert erhält den Rundungsrest. Im Golden-Fall
(2 × Level 3, 2 × Level 4, Anteil 0.6, drei Begegnungen, Seed 179974) entstehen
exakt `680 → 1000 → 1800` Ziel-XP.

Eine leere Begegnungszahl verwendet die originale deterministische 6–8-Begegnungen-
pro-vollem-Tag-Formel mit Skalierung auf den Anteil und Begrenzung auf 1–10.
Ausdrückliche neue Anzahlen liegen ebenfalls bei 1–10; historische größere Runs
bleiben lesbar. Numerische Seeds behalten ihren Zahlenwert, benannte Seeds werden
stabil auf eine unsigned 32-Bit-Zahl abgebildet. Manuell speicherbare Nullanteile
sind erlaubt; eine Generierung ohne positive Ziele liefert keine Teilvorschau.

Jede Begegnung verwendet ihr eigenes Ziel und ihren gespeicherten Encounter-Run.
Der Session-Run hält zusätzlich Policyversion, normalisierte Party, Anteil,
Zahlen-/Textseed, gewünschte beziehungsweise automatische Anzahl, Zielreihe und
harten Zielsummentest fest. Der Reader prüft diese Fakten; unabhängiger Transfer
und Fresh erhalten sie. Vorschau und Hilfe unterscheiden Ziel-XP und tatsächlich
materialisierte Gegner-XP einschließlich Abweichung. Einzelne Neugenerierung
verwendet weiter das ursprüngliche Ziel und erhält andere Vorschläge, Texte und
Belohnungen. Die ganze Erzeugung bleibt eine Transaktion, auch wenn eine spätere
Begegnung oder das abschließende Speichern scheitert.

Dies schließt die Zielaufteilung, Automatik und deren Persistenz ab. Die volle
`encounter-v5`/`reward-v3`-Orchestrierung mit allen Rewardkanälen, unveränderlichen
Gesamtruns, semantischer Origin-Deduplizierung, strukturierten Warncodes und
vollständiger Loot-/Packing-Parität ist daraus nicht ableitbar. Aktuelle Runs
enthalten weiterhin editierbare Vorschläge und die vorhandenen getrennten
Beuteausgleichs-/Tabellenpfade.

## Tagesbelastung, Szenenziele und Rasten

Der manuelle Plan zeigt die tatsächlichen angepassten XP seiner angehängten
Begegnungen, das gesamte Planungsbudget und verbleibende oder überschrittene XP.
Mehrere Gruppen derselben Szene werden gemeinsam bewertet. Leere Szenen tragen
keine Gegner-XP bei; unbekannte Level oder XP bleiben sichtbar offen. Jede Szene
kann ein eigenes nichtnegatives XP-Ziel erhalten, einschließlich ausdrücklich 0.

Kurze und lange Rasten werden ausschließlich zwischen zwei Nachbarszenen
geplant. Die lange Rast beginnt einen neuen Belastungsabschnitt; das gesamte
Planungsbudget bleibt unverändert. Vorschläge nach XP-Belastung sind Hinweise,
keine automatische Rast oder Änderung der Partywerte. Ziele und geplante Rasten
stehen auch in der GM-Mappe. Umordnen entfernt nur auseinandergerissene
Rastbindungen; Kopieren und Ersetzen binden erhaltene Nachbarpaare an neue IDs.
Der Schreibauftrag prüft angezeigte Plan- und Besuchsrevision atomar.

[Gezielte Prüfungen](../../../tests/desktop-session-day.test.mjs) decken Budget,
Restbindung, Quelle, Reopen, Replay, Kopie und entfernte Controls ab. Der
vollständige ursprüngliche Session-Planner-Umfang, insbesondere die asynchrone
Ein-Schritt-Generierung und strukturierte Reward-Orchestrierung, bleibt offen.
