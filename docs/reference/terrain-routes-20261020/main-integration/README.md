# Kandidat auf aktuellem Main

Native Prüfung auf `1e79282d6`; der Kandidat wurde anschließend konfliktfrei auf `b7c67bf7b` (zusätzliche Kampfbedienung) fortgesetzt, vorbereitet am 20.10.2026. Die ursprüngliche gemeinsame Arbeitskopie bleibt unverändert. Der Kandidat enthält die Straßen-/Flussplanung und ihre noch nicht integrierten Grundlagen: Höhenmodell, Landpinsel, Relief, räumliche Ansicht, Vegetationsdarstellung und gemeinsame Maßbindungen. Laufende spätere Gebäude- und Leistungsarbeiten anderer Tasks wurden nicht übernommen.

Die bereits vorhandenen Regionen, Kartenbeschriftungen, Raumgruppen und App-Updates aus Main bleiben erhalten. Das kombinierte Speicherformat ist **52**, weil Main Format 51 bereits für Szenengegner verwendet. Die bestehenden Format- und Tabellenprüfungen bleiben bestehen; Archive der Formate 50 und 51 bleiben importierbar.

Sieben native Straßen-/Flussabläufe auf diesem kombinierten Stand sind bestanden, einschließlich geschütztem Geländepinsel, atomarem Undo und frischem Prozess. Beide Electron-Prozesse endeten regulär. [Bericht und Hashes](result.json), [Ablauflog](native.log), [Straße](02-road-tilted.png), [Fluss](03-river-preview.png), [gemeinsamer Atlas](04-shared-tilted-atlas.png), [Pinsel](04b-protected-brush.png), [Wiederöffnung](05-fresh-process.png).

Die bei der Zusammenführung betroffenen Navigations-, Mess-, Werkzeug-, Speicherindex- und Reisekontextprüfungen sind mit **53/53 Fällen** bestanden: [Testlog](fixes-tests.log). [Typprüfungen](types.log) und [Repositoryprüfung](repo.log) bestanden.

Weitere **20/20 Höhen-/Verlaufsfälle** bestehen einschließlich der schreibfreien Höhenabfrage und des erhaltenen Profils in der begrenzten 2D-Projektion: [Testlog](height-route-tests.log). Der anfängliche Gesamtlauf hatte 4107 bestandene Fälle, neun Fehlermeldungen und einen optional übersprungenen Fall; alle neun Fehler wurden korrigiert und durch diese 20 sowie die 53 oben genannten Fälle nachgeprüft. Die vollständige Endqualifikation bleibt Aufgabe der Candidate-CI.

Die unabhängige Vegetationsnachprüfung auf dieser Integrationsbasis bestand **30 Tests und zehn native Abläufe**: [Prüfstatus](vegetation-verification.json), [Testlog](vegetation-tests.log), [nativer Bericht](vegetation-native-result.json) und [Quellmanifest](vegetation-source-manifest.json).

Die begrenzte 2D-Kartenprojektion trägt das berechnete Verlaufsprofil mit. Höhenkopplung liest Quelldaten ohne vorzeitigen Aufbau des optionalen Legacy-Indexes. Optionale Darstellungsfelder werden ohne `undefined`-Eigenschaften übertragen, damit direkte und Worker-Antworten denselben Vertrag erfüllen.

Dieser Beleg qualifiziert den vorbereiteten lokalen Kandidaten. Eine erfolgreiche Candidate-CI, Main-Integration oder Paketinstallation ist damit nicht behauptet.
