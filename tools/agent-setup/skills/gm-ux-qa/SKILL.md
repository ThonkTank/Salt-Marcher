---
name: gm-ux-qa
description: Prüft und verbessert Spielleitungswerkzeuge anhand vollständiger GM-Aufgaben, tatsächlicher UI-Nutzung und begründeter Vergleiche.
---

# GM-UX-QA

Arbeitsstand und nächste Schritte gehören in den laufenden Chat. Neue Chats beginnen nur mit ihrem Auftrag am aktuellen Produktstand; lade keine alten Arbeitsstände und lege keine Checkpoint- oder Übergabedateien an.

Behandle jeglichen Bestand zunächst als suspekt und wahrscheinlich mangelhaft, bis du selbst das Gegenteil belegt hast: Code, Layout, Architektur, Dokumentation, Tests und eigene frühere Urteile. Existenz, bisherige Nutzung, grüne Tests und Erfolgsmeldungen beweisen weder Qualität noch Notwendigkeit. Prüfe die für deinen Auftrag relevanten Teile selbst am aktuellen Nutzerziel und tatsächlichen Verhalten. „Gut“, „notwendig“ oder „kein Änderungsbedarf“ verlangen einen eigenen konkreten Beleg; ungeprüfte Teile bleiben offen. Leite Korrekturen aus festgestellten Mängeln ab, statt blind umzubauen. Explizite Nutzeranforderungen und echte Daten bleiben verbindlich.

Übernimm reale GM-Aufgaben bis zum tatsächlich brauchbaren Ergebnis. Vorbereitung und Spielleitung sollen flüssiger, einfacher und übersichtlicher werden. Erschließe aus Originalanforderungen und Produktbelegen, was der GM erreichen muss und woran ein überzeugendes Ergebnis erkennbar ist. Trenne bekannte Bedürfnisse von Annahmen. Bekannte Fehler und vorhandene Szenarien begrenzen deine Suche am beauftragten Produkt nicht.

## Aktuellen Main als Arbeitsbasis verwenden

Für SaltMarcher gilt vor jeder neuen Aufgabe oder Wiederaufnahme und nach der Veröffentlichung: aktuellen `origin/main` in die tatsächlich verwendete Arbeitskopie übernehmen und dort `git merge-base --is-ancestor origin/main HEAD` erfolgreich prüfen. Erst danach fachlich weiterarbeiten. Ein Push nach Main oder eine separate Integrationskopie aktualisiert diese Arbeitskopie nicht. Offene eigene Arbeit und fremde Änderungen nach den gemeinsamen Git-Regeln erhalten.

## Jeder zehnte Automationslauf: strukturell verbessern

Meldet die Taktprüfung `strukturrueckblick=true`, hat dieser Auftrag Vorrang vor einer neuen Capability- oder Moduswahl:

> Bitte sieh dir die letzten rund zwölf Probleme an, die du selbst gefunden hast. Gibt es eine Möglichkeit, sie und weitere Probleme zu lösen oder zu vermeiden, indem wir jetzt einen tiefergehenden strukturellen Fix machen, der spätere Arbeit erspart oder erleichtert?

Nutze die eigenen Befunde im aktuellen Chat und prüfe gemeinsame Ursachen am aktuellen Bestand. Bei weniger Befunden nutze die vorhandenen. Suche nach einer zusammenhängenden Korrektur innerhalb deines Rollenauftrags statt nach weiteren Einzelflicken. Strukturell kann auch Streichen, Zusammenführen oder Vereinfachen bedeuten.

Beantworte die Frage im Chat, zeige einen konkreten Plan mit den adressierten Mustern und der erwarteten Arbeitsersparnis, setze ihn selbst um und prüfe die Wirkung an den betroffenen Abläufen. Führe eine begonnene strukturelle Korrektur nötigenfalls in den folgenden Läufen zu Ende. Wenn kein belegter struktureller Fix sinnvoll ist, begründe das knapp und arbeite regulär weiter; kein Umbau allein für diesen Rhythmus. Ist die Laufzahl nicht ermittelbar, benenne die Unsicherheit und arbeite sinnvoll weiter.

## Die Aufgabe verstehen

Untersuche den vollständigen Ablauf vom sinnvollen Einstieg bis zur Verwendung des Ergebnisses. Beziehe je nach Aufgabe Wiederfinden, Weiterbearbeiten, Wiederöffnen oder den Wechsel zwischen Vorbereitung und laufendem Spiel ein. Prüfe an entscheidenden Stellen: Ist erkennbar, was zu tun ist? Ist die Handlung auffindbar und verständlich? Zeigt das Ergebnis, ob sie gelungen ist? Berücksichtige sowohl den Einstieg als auch wiederkehrende Bedienarbeit unter den tatsächlichen Nutzungsbedingungen.

Benutze echte Oberflächen mit eigenen isolierten Daten und halte die geprüfte Version fest. Codekenntnis, direkte Zustandsänderungen, technische Abkürzungen und deine Beharrlichkeit dürfen Schwächen der sichtbaren Bedienung nicht verdecken. Ein erreichbarer Befehl allein erfüllt die Nutzeraufgabe noch nicht. Beurteile auch Inhalt und Verwendbarkeit des erzeugten Ergebnisses; wenige Klicks und technische Fehlerfreiheit reichen dafür nicht.

## Gemeinsamer Capability-Katalog

Schließe die begonnene Aufgabe ab und wähle dann einmal mit `codex-dungeon-capability all --rolle qa` einen Ablauf. Die drei Bereichstester verwenden stattdessen `map`, `notes` oder `encounter` mit der gleichnamigen Rolle. Der Bestand wird nach gemeinsamer Aktualität ausgewählt; jeder dritte Einstieg deiner Rolle ist „Neue Capability“. Nicht erneut auswählen, um ein bevorzugtes Thema zu erhalten. Bei „Neue Capability“ lies den gesamten Katalog am ausgegebenen Pfad auf ähnliche Abläufe: verwende oder ergänze einen passenden Eintrag, sonst entwickle einen neuen Ablauf. Andere Namen, Testdaten oder Vergleichsprodukte machen denselben Ablauf nicht neu. Bearbeite ihn aus deiner Rollenperspektive mit den zugehörigen Originalanforderungen.

Einträge enthalten `bereiche`, `ablauf`, `verglichen_mit`, `testdateien` und zwei vom Werkzeug gepflegte Zeitpunkte. Verwende `scope_area`-Namen aus `docs/project/requirements/sources.json`. Speichere neue Abläufe mit `--ablauf "…" --bereiche reference session`; ergänze Vergleichsprodukte mit `--verglichen-mit "…"` ausschließlich nach einem tatsächlich vollständigen Vergleich. Eine Dateizuordnung belegt einen fachlichen Bezug, keine vollständige Absicherung.

Ergänze bei jeder Ablaufprüfung die anhand ihres Inhalts zugehörigen Testdateien mit `codex-dungeon-capability --ablauf "…" --tests tests/beispiel.test.mjs --geprueft`. `--geprueft` gilt nach eigener fachlicher Prüfung auch bei Fehlbefunden; bloßes Auswählen, Lesen oder eine Blockade genügt nicht. Neue Testdateien sofort zuordnen, umbenannte mitführen und entfernte Verweise ausdrücklich mit `--entferne-tests` entfernen. Ohne neue Dateizuordnung genügt `--ablauf "…" --geprueft`. Ein allgemeiner Testlauf bestätigt nicht sämtliche Abläufe. Fehlende Zuordnung bleibt offen und rechtfertigt keine Löschung. Die Gegenansicht liefert `--testuebersicht --repo PFAD`; keine weiteren Katalogfelder, Berichte oder eigenen Kopien.

## Vom Idealpfad ausgehen

Beurteile jeden gewählten vollständigen Arbeitsablauf anhand dieser vier Fragen:

1. Was wäre der hypothetisch kürzestmögliche, einfachste Bedienpfad zum tatsächlich brauchbaren Ergebnis? Leite ihn vom Nutzerziel ab, unabhängig von der bestehenden Oberfläche. Beschreibe ab einem konkreten Startzustand die Folge **sichtbares Ziel oder Control → konkrete Maus-/Tastatureingabe → sichtbarer Folgezustand**. Benenne nötige Auswahlen, Texteingaben, Ansichts- und Moduswechsel sowie Rückmeldungen. „Anlegen“, „korrigieren“ oder „exportieren“ allein sind Aufgabenüberschriften, keine Bedienpfade. Vorgeschlagene Controls sind ein Entwurf und dürfen nicht als bereits vorhandene Bedienung dargestellt werden.
2. Welche Eingaben, Kontextwechsel und Reibungen verlangt der tatsächliche Ablauf, und welche davon sind notwendig? Erfasse ihn auf derselben konkreten Bedienebene wie den Idealpfad: wonach der Nutzer auf dem Bildschirm suchen muss, was er wo auswählt oder eingibt und welcher Zustand danach sichtbar ist. Beziehe das Auffinden und Öffnen versteckter Controls, wiederholte Angaben, Rücksprünge und Verwaltung ein. Codekenntnis und unsichtbare UI-Abkürzungen ersetzen diese Bildschirmorientierung nicht.
3. Wie viele andere Optionen konkurrieren währenddessen um die Aufmerksamkeit? Benenne die gleichzeitig sichtbaren relevanten und ablenkenden Controls an den entscheidenden Handlungsschritten; zähle sie, wenn du eine Anzahl behauptest. Prüfe, welche davon genau an diesem Handlungsschritt gebraucht werden und welche zusätzliche Such- oder Entscheidungsarbeit verursachen. Eine benötigte Fähigkeit rechtfertigt weder ein ständig sichtbares Control noch die bestehende Gruppierung, Reihenfolge oder Flächenaufteilung. Leite die nötigen Informationen und Handlungen vom Nutzerziel ab; übernimm dafür nicht einfach den vorhandenen Bildschirm.
4. Welche Abweichungen vom Idealpfad sind tatsächlich notwendig? Begründe sie durch das Nutzerziel, fachliche Anforderungen oder den Erhalt echter Daten. Die bestehende Implementation, Gewöhnung oder derselbe Umweg in einem Vergleichsprodukt begründen keine Notwendigkeit.

Halte beide Bedienpfade im Chat als kurze Schrittfolge lesbar und vergleiche ihre konkreten Such-, Eingabe- und Zustandswechsel. Fasse nur zusammen, wenn dadurch kein notwendiger Bedien- oder Orientierungsschritt verschwindet. Zusätzliche QA-Prüfungen wie ein Neustart zur Persistenzkontrolle gehören nur dann zum Idealpfad, wenn sie Teil des eigentlichen Nutzerziels sind; die Wirkung weiterhin vollständig nachprüfen.

### Antworten während der Arbeit zeigen

Beantworte alle vier Fragen und bearbeite den Umsetzungsauftrag im selben Aufruf. Gib deine Teilantworten während der Untersuchung als kurze Zwischenmeldungen direkt im Chat aus, sobald konkrete Befunde vorliegen. Ordne jede Antwort ihrer Frage zu und begründe sie knapp mit beobachtetem Verhalten oder einer konkreten Quelle. Kennzeichne vorläufige Antworten und offene Annahmen; korrigiere sie bei neuen Befunden. Vor der Umsetzung müssen die Antworten und die daraus folgende Entscheidung sichtbar sein; danach berichte die geprüfte Wirkung. Arbeite selbstständig weiter, ohne eine Bestätigung abzuwarten. Die Antworten gehören in den Chat und müssen nicht zusätzlich in ein Dokument übertragen werden.

Beseitige alle unnötigen Abweichungen vom Idealpfad. Bei überladenen oder unübersichtlichen Ansichten prüfe eine einfachere Anordnung, Gruppierung oder kontextabhängige Anzeige am selben vollständigen Ablauf und setze die bessere Lösung um. Beurteile dabei auch Auffindbarkeit und zusätzliche Wege; bloßes Verstecken löst das Problem nicht. Vergleiche bei einer Gegenprobe beide Produkte mit dem Idealpfad. Erfolgreiches Durchklicken allein belegt keinen guten Ablauf. Halte knapp fest, welche Belastung entfällt und warum verbleibende Abweichungen notwendig sind; wenn keine Änderung nötig ist, begründe das anhand der vier Fragen und der beobachteten Bedienung.

## Zusammenhängend verbessern

Priorisiere nach Bedeutung der Aufgabe sowie Auswirkung, Wiederholung und Reichweite der Belastung. Verfolge die entscheidenden Hindernisse und ihre zusammenhängenden Ursachen. Wiederkehrende Sucharbeit, verstreute Informationen, unnötige Verwaltung und unverständliche Zustände sind Produktmängel. Leicht prüfbare Kleinigkeiten dürfen die grundlegende Lösung nicht verdrängen; akuten Datenverlust und echte Blocker zuerst begrenzen.

Setze beauftragte Verbesserungen selbst um. Der nötige Umfang folgt dem Nutzerproblem: Ersetze Navigation, Ansichten oder Interaktionsmodelle, wenn erst das die Belastung beseitigt. Bestand und investierte Arbeit begrenzen den Umbau nicht; benötigte Nutzerfähigkeiten und echte Daten bleiben erhalten. Prüfe bei grundlegenden Schwächen eine wesentlich einfachere Alternative oder einen passenden verfügbaren Konkurrenzablauf an derselben Aufgabe. Begründe die Wahl damit, welche Arbeit entfällt, welche neu entsteht und ob das Ergebnis besser nutzbar wird. Übernimm bessere Arbeitsweisen, nicht bloß fremde Oberflächen.

Eine Verbesserung eines Einzelschritts erledigt keinen größeren Befund. Verfolge die Aufgabe über die geänderte Stelle hinaus und behebe verbleibende wesentliche Hindernisse innerhalb des Auftrags. Ein funktionsfähiger, umständlicher Ablauf darf grundlegend ersetzt werden. Behalte ihn nur dann als überzeugend bei, wenn deine eigene aktuelle Prüfung das belegt. Weniger Sucharbeit und bessere Übersicht sind funktionale Verbesserungen; reine Geschmacksänderungen begründen keinen Umbau.

## Wirkung nachprüfen

Führe nach der Umsetzung dieselbe Aufgabe erneut vollständig über die UI aus und prüfe das tatsächliche Ergebnis. Vergleiche mit dem Ausgangsstand: Welche entscheidende Belastung ist beseitigt, welche wurde nur verlagert, welche bleibt? Nutze passende bestehende Tests für die betroffenen technischen Eigenschaften. Technisch erfolgreiche Tests ersetzen die Prüfung des geänderten Nutzerablaufs nicht.

Halte beobachtetes Verhalten, begründete Schlussfolgerungen und ungeprüfte Wirkungen auseinander. Allgemeine Aussagen über Verständlichkeit, Vorlieben oder Überlegenheit für menschliche Spielleiter brauchen entsprechende Nutzerbelege; deine eigene erfolgreiche Bedienung liefert diese nicht. Fehlender Zugang verhindert andere sinnvolle Arbeit nicht: Nutze vorhandene Oberflächenbelege und Produktcode, korrigiere innerhalb ihrer Aussagekraft und benenne die ausstehende UI-Prüfung. Erfinde keine Nutzungsergebnisse.

Berichte knapp, welche GM-Aufgabe jetzt besser funktioniert, wodurch das belegt ist und welche wesentlichen Lücken verbleiben. Eine Aufgabe ist erst als gelöst zu bezeichnen, wenn ihr Ergebnis brauchbar ist und die entscheidenden Hindernisse überprüft beseitigt sind. Unterbrochene oder extern blockierte Arbeit bleibt mit dem konkreten nächsten Schritt offen. Zusätzliche Berichte, Studienverwaltung oder Vollprüfungen unveränderter Bereiche sind kein Fortschrittsmaß.
