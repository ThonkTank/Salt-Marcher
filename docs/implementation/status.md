# Aktueller Stand

Atlas V7, Dateiformat 18, Generierungsrezept 4. Stand: 6. November 2026.
[README](../../README.md) enthält Einrichtung und Abnahme, die
[Architektur](../architecture.md) Zuständigkeiten und der
[Produktvertrag](../product-contract.md) Verhalten und Grenzen.

Raum und Haus bleiben äußere Nahansichten mit ausdrücklich geöffneten Innenräumen.
Die Raum-Kontexthilfe, der Weltpinsel-/Rasterhinweis und der begrenzte gemeinsame
Cache für exakte Außengeometrie bleiben erhalten. Innen werden unsichtbare
Regionskatalog-, Regions- und Flussreads unterbrochen; passive Außenlayer bleiben
sichtbar. Vollständige Rasterabdeckung wird bei passender Version und effektiver
Auflösung wiederverwendet.

Die Hausprüfung fand einen geerbten Fehler bei der Rückkehr aus der Übersicht:
Darstellungsdaten konnten ohne exakten Szenenread als bearbeitbar gelten. Die
Wiederverwendung prüft jetzt die Herkunft der veröffentlichten Anfrage. Eine
revisionsgleiche vollständige exakte Außenszene darf eine reine Abwahl lokal
übernehmen; Ownerinformationen werden dabei geleert. Andere Auswahl-, Kontext-,
Versions- und Abdeckungswechsel behalten ihre Prüfungen.

Nach dieser einmaligen Korrektur bestanden Typprüfung und alle 311 TypeScript-Tests.
Im gezielten Browserlauf bestanden 11 von 13 Fällen, darunter Übersichtsrückkehr,
Innenlayer, belegtes/leeres Grundstück mit Alt, Raumkontext, Capture, angenommener
Edit, Straßenpreview und Landschaftsauswahl. Zwei Fälle blieben rot:

- Haus-Doppelklick erreicht jetzt Raum und den Zielmaßstab, scheitert aber an der
  aus dem Canvas zurückgelesenen Ankerprüfung: Abweichung rund 0,000077 CSS-Pixel
  gegenüber der erwarteten Toleranz unter 0,00005. Die nachfolgenden Kamera-/
  History-/Innenkontextprüfungen dieses Falls wurden nicht erreicht.
- Die erste Hausgeste nach Auswahl → Haus erzeugte erneut keinen Owner, obwohl
  sie zuvor im Review bestanden hatte. Der Kontrollfall Haus → Straße → Haus
  bestand; die verbleibende Ursache ist nicht geklärt.

Die zuvor fehlgeschlagene Landschaftsauswahl bestand diesmal; damit ist ihre
wechselhafte Ursache nicht erklärt. Es gab keine gelockerten Assertions, neue
Retries oder weitere Korrekturschleife. Detailbelege und Paketberichte liegen unter
`src-tauri/target/cleanup/lod-review/lod01/`, insbesondere `F/` und `G/`.
Der Hausstand ist nicht vollständig abgenommen.

Der bisherige veröffentlichte CI-Stand bestand Transportprüfung, Typen,
TypeScript-/Rusttests, Clippy, Format und Webbuild, scheiterte jedoch mit sieben
Browserfehlern (198 bestanden, zwei übersprungen); RPM wurde nicht ausgeführt.
Die lokalen Hausänderungen haben noch keinen vollständigen CI-/Browserlauf.
Main-Veröffentlichung bleibt an die bestehenden Checks gebunden. Native
Bedienabnahme, RPM-Nachweis, aktuelle große Performanceprüfung und die gesamte
begonnene Phase-4-Zeichenplanung bleiben offen; Browserteilprüfungen ersetzen sie
nicht. Nächster Handoff ist die verbleibende Erstgesten-/Ankerprüfung ohne Verlust
der bestehenden Sicherheits- und Funktionsaussagen.
