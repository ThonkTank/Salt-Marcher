# TW06-Q — Vollständige Terrain-LOD-Qualifikation

Status: Geplant, erst nach positivem TW06-E und unverändert gebundenem Kandidaten.
Owner: Ein nativer QA-/Messimplementierer, gpt-6-sol/high; exklusiver Build-/Laufbesitzer.
Last Reviewed: 2026-10-26
Source of Truth: Vollständiger TW06-Nachweis vor TW07, keine Leistungsabnahme aus Teilproben.

## Auftrag und Prüfung

[Messvertrag](../../../requirements/terrain-relief.md#ziele-und-abnahme-dieser-etappe)
und [offene TW06-Qualifikation](TW06.md#noch-offene-qualifikation-und-reihenfolge)
abarbeiten. Pro UI-Skalierung 100/200 % und Neigung 0/45/75 Grad drei
kontinuierliche Welt–Raum–Welt-Läufe: 18 Fahrten mit den fünf festgelegten
Ansichtsbreiten, Quellen/Ankern und vollständigen Übergangsbildern. Kaltladen
separat, keine verlangsamten Teilfahrten oder ausgeschlossenen Lücken.
Danach zehn Hin-/Rückfahrten für Stream-/GPU-/RAM-Plateaus und vollständige
Freigabe. Ein konsistenter Quell-/Runtimestand; nach Änderungen gezielt
betroffene Nachweise neu binden, keine alten Runtimebelege umetikettieren.

Negative/große Ursprünge, Alpha 0/0,5/1, sofortige geneigte Gesten, beide
Terrain-Picks, unberührte Form-/Materialflächen, exaktes Undo und echte
Eingabeklassen vollständig zuordnen. Tatsächliche Meshgeometrie und
Quellinterpolation unterscheiden. F1-Bilder aus M2 am Endstand prüfen.
Ressourcen: Streamlimits, einzigartige Buffer, Renderer-RSS gegen gebundene
Ohne-Worker-Basis, GPU/Browser/Picker/Resize-/Clone-Spitzen und Plateau.
Größere Drawingbuffer als Pilotgröße vor Integration konkret kalkulieren
und qualifizieren; kein Produktfensterlimit aus dem Pilot ableiten.

## Durchführung und Ergebnis

Nur bestehende gezielte native Prüfwerkzeuge, reproduzierbare Belege und
eigener Paketbericht ändern. Produktfehler an Hauptchat mit engstem
Korrekturschritt, keine ungebundene Paralleländerung während Messläufen.
Private Sitzung ohne Hostentsperren, normales Ende/Profilbereinigung belegen.
Capability-Verknüpfungen und --geprueft nach tatsächlich abgeschlossenen
Abläufen; keine Performance-, Release- oder Nutzerabnahme aus Q ableiten.

Vorläufig 2–3 aktive Stunden plus 2–4 h serielle Maschinenzeit, nach E neu
kalibrieren; die alte unbestätigte Restzusage gilt nicht. Kontrollen zählen
Kalenderzeit inklusive Tests/Warten. Übergabe enthält Ergebnismatrix mit
fehlenden/fehlgeschlagenen Fällen, gebundene Bilder/Messwerte und Freigaben.
TW07 beginnt erst bei fachlich abgeschlossenem TW06; M3-Review nach TW07.
