# Produktarbeit und passende Prüfung

Der aktuelle Nutzerauftrag und seine Freigaben haben Vorrang. Die folgende Arbeitsweise ersetzt die frühere allgemeine Pflicht zu getrennten Plan-, Umsetzungs-, Review-, Nachbesserungs- und Aufräumläufen, auch wenn solche Abläufe noch in älteren Paketplänen stehen. Konkrete Produktanforderungen, unabhängige Fachabnahmen und Daten-/Hostschutz bleiben bindend.

## Sinnvolle Arbeit wählen und begrenzen

1. Zuerst den aktuellen Produktengpass in [#12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12) lösen oder vorhandene Produktarbeit bis zur Integration bringen. Besitz und angefragte Unterstützung im konkreten Issue/PR prüfen. Danach den nächsten ausführbaren Nutzerablauf liefern. `npm run next` zeigt den aktuellen Engpass getrennt von frei übernehmbaren Aufgaben; ein bestehender Owner bleibt zuständig.
2. Ein Paket liefert einen zusammenhängenden nutzbaren Ablauf oder beseitigt einen konkreten Blocker für ein benanntes Umsetzungspaket. Beispiel: **Ort anlegen → Key ändern → Undo → speichern → frisch öffnen**. Einzelne Felder, Tests, Reviews und Aufräumschritte sind normalerweise Checklistenpunkte desselben Pakets. Ein Paket kann mehrere Commits enthalten.
3. Nur teilen, wenn Teile eigenständig nutzbar sind, tatsächlich unterschiedliche Besitzer/Eingänge benötigen oder das Risiko einen unabhängig prüfbaren Übergang verlangt. Parallelisierung allein rechtfertigt keine künstliche Zerlegung. Ein kurzer Plan im Issue/PR genügt; eine eigene Paketdatei hilft bei komplexen Verträgen oder Quellenmatrizen und ist keine allgemeine Voraussetzung.
4. Planung, Quellenabgleich, Infrastruktur und Prozesspflege brauchen einen benannten Verbraucher: **Welches Umsetzungspaket oder welche anstehende Entscheidung wird dadurch konkret möglich?** Erforderliche Quellen-/Lizenzgates gehören dazu. Ohne diesen Bezug bleibt der Bedarf im Backlog; eine leere Aufgabenliste ist kein Grund für neue Planarbeit. Die Hilfsarbeit endet beim gelösten Eingang und braucht keine eigene Folge von Plan-/Aufräumreviews.
5. Ein Contributor verfolgt ein ausführbares Ergebnispaket bis zur Lieferung; bei einem echten Blocker kann er eine andere passende Aufgabe unterstützen. Eng gekoppelte offene Teil-PRs zuerst zusammenführen und abschließen. Bestehende Owner, Fachwurzeln und Gates erhalten; kein zweiter Kandidat für denselben Lauf.

## Umsetzung, Review und Abschluss

Plan, Implementierung, passende Regressionen, notwendige Bereinigung und Übergabe bilden **ein Ergebnispaket im vorhandenen Issue/Branch/PR**. Review erfolgt gebündelt an einer lauffähigen Änderung. Zusätzliche Planreviews sind bei strittigen Daten-/Schnittstellenverträgen oder teuren irreversiblen Entscheidungen sinnvoll; Routineänderungen brauchen sie nicht. Erforderliche Nachbesserungen bleiben im Paket und werden nur am betroffenen Befund nachgeprüft. Kein zusätzlicher Aufräum-Plan/PASS/Review als allgemeine Voraussetzung für die nächste Arbeit.

Dungeon-Arbeit führt den eigenen aktuellen Lauf in `checkpoint.parityRoadmap`, Hex-Arbeit in `checkpoint.hexAtlasExecution`; neue Contributors erhalten fremde Wurzeln. [Dungeon-Parität](../ROADMAP-PARITY.md), [Hex-Atlas](../ROADMAP-HEX-ATLAS.md) und die übrigen Fachverträge bestimmen die funktionalen Ergebnisse. Eine eigene Abnahmeentscheidung braucht ihren direkten Beleg; eine Dokumentations- oder Planprüfung erteilt keine Produktfreigabe.

## Prüfaufwand nach Änderung und Risiko

| Änderung | Passende Prüfung |
| --- | --- |
| Reine Orientierung, Verweise oder dokumentierter Quellenabgleich | `npm run check:repo`, relevante Quellen-/JSON-/Diffprüfung. Produkt-Typprüfung, Vollsuite und Build nicht lokal wiederholen, wenn Produkt und Buildpfad unverändert sind. |
| Offline-Werkzeug oder dessen Auswahlregeln | Strukturprüfung und gezielte Werkzeugtests; keine Obsidian-/Großkartenprobe für einen Backlogbefehl. |
| Produktcode, Buildpfad oder Abhängigkeiten | Typprüfung, automatisierte Tests und Build einmal auf dem integrierten Ergebnisstand, plus passende Regression. Bestehende Exact-SHA-CI-Ergebnisse verwenden; lokal zusätzlich nur für konkrete Diagnose oder eine noch fehlende Prüfung ausführen. |
| Speicherformat, geschützte Texte/Identitäten, Recovery, Host-/Kampagnenwechsel oder Spielerzugriff | Direkte Fehler-/Erhaltungsfälle und, wo der Fachvertrag es verlangt, unabhängiger Review sowie tatsächliche Host-/Reopen-/Recovery-Abnahme. Den betroffenen Nutzerablauf prüfen; Gesamtqualifikation an ihren eigenen Gates abnehmen. |

Prüfungen gelten für ihre tatsächliche Source-/Build-/Fixtureidentität. Bei unverändertem Produkt-/Prüfpfad kann ein vorheriger Beleg mit Diffnachweis weiter gelten; die neue Commit-SHA allein erzwingt keinen erneuten GUI-Lauf. Geänderte Pfade, Fixtures, relevante Host-/Umgebungsbedingungen, Fehlbefunde oder fehlende Nachweise rechtfertigen weitere Prüfungen. Ein Reviewer prüft die Belege und offene Risiken, statt dieselbe Vollsuite und dieselben Leseläufe automatisch mehrfach zu wiederholen. Prüfergebnisse nur mit ihrer tatsächlichen Herkunft angeben.

## Fortschritt beurteilen und Schleifen beenden

Die ohnehin nötige Übergabe sagt kurz: **Was kann der GM jetzt zusätzlich? Welcher konkrete Produktblocker ist geschlossen? Welcher Eingang fehlt noch?** Für einen Hilfsbeitrag den konsumierenden Owner/das Umsetzungspaket nennen. Commit-, Issue-, Test- und PASS-Zahlen sind keine Fortschrittsziele.

Der Integrationsowner hält in #12 den neu auf Shared nutzbaren Ablauf oder den nächsten konkreten Produktblocker aktuell. Keine zusätzliche Berichtsdatei oder Messrunde. Folgen zwei Übergaben im selben Paket ohne neue Funktion, gelösten Eingang oder neuen notwendigen Befund aufeinander, den Lauf stoppen und bündeln, direkt umsetzen oder den echten Blocker nennen. Wenn weitere Organisation/Prüfung voraussichtlich mehr Arbeit kostet als die begrenzte Änderung, kurz das konkrete Risiko benennen und auf die kleinste ausreichende Prüfung reduzieren. Echte Daten-/Sicherheits-/Produktabnahmegrenzen erhalten. Höchstens zwei erfolglose Versuche oder 45 Minuten an derselben technischen Hypothese, dann anhand der Belege entscheiden.

## Veröffentlichen und eingehende Arbeit integrieren

Die bestehende Nutzerfreigabe umfasst regelmäßiges Committen/Pushen und GitHub-Koordination. Vor Beginn und unmittelbar vor Veröffentlichung Remote/Upstream abrufen und eingehende Änderungen integrieren. Vor einem neuen Branch offene PRs, Remote-Branches und die Paketkoordination [#1](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1) prüfen. Einen geprüften zusammenhängenden Ergebnisstand veröffentlichen; bei langen Arbeiten spätestens zum täglichen Abschluss einen prüfbaren Zwischenstand sichern. Ein Commit benötigt keine eigene Statusrunde.

Nur eigene Änderungen committen; lokale fremde Änderungen sichern und erhalten. Veröffentlichten Verlauf erhalten, kein Force-Push. Konflikte gezielt integrieren und nur betroffene Prüfungen wiederholen. Shared ist `active/installed-phase1`; tatsächlichen Upstream prüfen und Push gegen den Remote-Commit bestätigen. Build, Synchronisation und Push installieren kein Plugin im Nutzervault. Übergabe und Informationsorte folgen dem [Kommunikationsvertrag](REPOSITORY.md#kommunikation-nach-inhalt-und-anlass).

## Hosttests und Schutz

Nur eine Testinstanz auf demselben Gerät; keine parallelen Agenten/Lasttests, andere Programme nicht schließen. Vor echtem Hostlauf den Geräteslot im Bereich koordinieren. Isolierte Testvaults und synthetische oder eigens freigegebene Daten benutzen. Vor Installation den aktuellen Produktstand sichern; bestehende Karten, Raumtexte und fremde Änderungen schützen.

Nutzerfreigabe vom 02.10.: feste Speicherlimits und hohe Startreserve entfallen; normale CPU/GPU/Speicherverwaltung. Nur die Notbremse bei akutem systemweitem Speichermangel bleibt (unter 256 MiB verfügbar oder über 50 Prozent Vollspeicherblockade während zwei Sekunden). Schutzstopps, synthetische Eingaben und Kleinkartenprüfungen nur innerhalb ihres tatsächlichen Scopes bewerten.

Große QA-Dateien und Protokolle liegen außerhalb des Nutzervaults unter `/home/aaron/.cache/dungeon-native-qa/`. Ein direkter Beleg nennt Commit/Build, Fixtureversion/Hashes, tatsächlichen Ablauf, Ergebnis und zugängliche Referenz oder fehlenden Zugriff. Synthetische Eingabe, physische Bedienung und frischen Hostprozess getrennt ausweisen; eine fehlende lokale Evidenzdatei ist kein eigener verifizierter PASS.
