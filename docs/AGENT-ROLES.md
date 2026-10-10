# Arbeitsrollen für wiederkehrende Beiträge

Gespeicherte Automationsprompts nennen Repository, Rollenkennung und erteilte Befugnisse. Dieser versionierte Vertrag beschreibt die veränderliche Arbeit. Gemeinsamer Einstieg: [AGENTS](../AGENTS.md), Aufgabenwahl und Besitz: [REPOSITORY](REPOSITORY.md), Umsetzung und Rückblick: [WORKFLOW](WORKFLOW.md). Nur den eigenen Rollenabschnitt und den benötigten Fachkontext lesen. Produktumfang steht in [PRODUCT](PRODUCT.md) und [SCOPE](SCOPE.md); aktuelle Kandidaten und Aufgaben stehen an ihren Arbeitsorten.

## Gemeinsame Ausführung

- Bei jedem Aufwachen den Einstieg und eigenen Rollenvertrag vom aktuellen Defaultbranch laden; bestehende Arbeitsbranches anhand ihres tatsächlichen Upstreams synchronisieren. Eine neue Vertragsfassung gilt beim nächsten Einstieg. Repositoryregeln erweitern keine erteilten Befugnisse und ersetzen keine ausdrückliche Nutzergrenze oder Fachabnahme.
- Rolle beschreibt die Tätigkeit, nicht Eigentum an einem Fachpaket. Bekannte eigene Aufgabe/Branch und vorhandene Ownerbezeichnung fortführen. Bei fehlendem eindeutigen eigenem Claim freie Arbeit suchen; fremden Besitz nicht aus derselben Rolle oder demselben GitHub-Account ableiten. Bei bereits laufendem eigenen Lauf keine zweite Ausführung desselben Scopes/Hosts beginnen.
- Vorhandenen Aufgabenstand gezielt lesen. Änderungen seit einem früheren Lauf nur behaupten, wenn dessen erfolgreich ausgewerteter Stand tatsächlich bekannt ist. Für wiederkehrende Auswertung einen Quellenstand/Zeitraum am bestehenden eigenen Aufgaben-/Entscheidungsort oder in der eigenen Checkpointwurzel mitführen, wenn ohnehin eine sachliche Übergabe entsteht. Ohne diesen Stand aktuelle relevante Eingänge begrenzt neu feststellen und die Grenze nennen; kein vollständiger historischer Neustart, keine zusätzliche Statuschronik.
- Auftrag bis zu einem nutzbaren Ergebnis oder echten Blocker bearbeiten. Werkzeuge liefern Kandidaten; Priorität, freien Scope, Fähigkeiten, Eingänge und Consumer prüfen. Voraussetzungen aus dem Paket statt aus alten Gesprächsanweisungen ableiten. Fehlender Zugriff oder Laufumgebung ist ein konkreter technischer Befund.
- Die [Selbstkritik](WORKFLOW.md#eigene-arbeit-selbstkritisch-beurteilen) gilt auch für Reviews, Regeln und Berichte. Auf unveränderte Entscheidungen nicht erneut reagieren. Bekannte unbeantwortete Blocker erhalten; ohne sinnvolle neue Arbeit ruhig warten.

## contributor

**Ergebnis:** ein nutzbares Produktpaket oder ein gelöster konkreter Umsetzungseingang. Eigene Arbeit fortsetzen, sonst passende freie Implementierung, Fehlerbehebung, unabhängige Prüfung oder Integrationshilfe übernehmen. Keine feste Beschränkung auf den bisherigen Fachbereich; Fähigkeiten und Eigentum müssen passen.

Produktcode, angemessene Prüfung, Dokumentation und reguläre Veröffentlichung im bestätigten Scope gehören zusammen. Der Paketowner führt aktuellen Stand und nächsten Empfänger am Issue/PR; eigene Fachwurzeln erhalten ihren bisherigen Owner. Bei Übernahme eines Supportangebots dessen Label/Haupttext aktualisieren. Produkt- oder Fachfreigabe entsteht nur aus dem vereinbarten direkten Nachweis.

## migration

**Ergebnis:** nutzbare SaltMarcher-Funktionen oder notwendige, zeitnah konsumierte Migrations-/Quelleneingänge. Aufgabenwahl und Veröffentlichung wie `contributor`; ausschließlich D&D 2014, mindestens entsprechende D&D-Beyond-2014-Funktionsparität. Quellen/Attribution und Originalsemantik erhalten.

Nur den betroffenen Portfoliobereich und gegebenenfalls den ausdrücklich verlinkten Originalvertrag lesen. Fremde Aggregate, Quellenkandidaten und Abnahmegates behalten ihren Owner. Eine besessene oder blockierte Lieferkette rechtfertigt keine konkurrierende Implementierung; unabhängige ausführbare Produktarbeit unterstützen.

## gm-test

**Ergebnis:** direkt beobachteter GM-Nutzen oder ein reproduzierter Produktbefund mit konkretem Reparatur-/Entscheidungsempfänger. Zusammenhängende sichtbare Abläufe des implementierten Produkts in einem eigenen isolierten Cloud-Testhost/Vault prüfen. Bestehende eigene Instanz fortführen; keine fremden Geräte, Nutzervaults oder Laptop-Slots verwenden. Aktueller Testhost und erforderlicher Build ergeben sich aus dem Paket.

Echte Schritte, Bildbelege, Zustandserhalt und relevante Produktwartezeiten an Source/Build/Fixture/Host binden. Fernsteuerungszeit ist keine Produktlatenz; Cloud-Eingabe, physische Bedienung und frischer Prozess bleiben unterschiedliche Nachweise. Bei technischem Hostblocker diesen beheben oder belegbar übergeben; keinen UI-PASS aus Modelltests ableiten. Bei einem besessenen Fix andere sinnvolle freie GM-Abläufe prüfen. Eigener Stand nur in der bestehenden GM-Fachwurzel; Ergebnis am konkreten Aufgabenissue, Bereich nur mit Delta/Link.

## task-maintenance

**Ergebnis:** Contributors finden bestätigte ausführbare Arbeit und korrekte Übergaben. Neue relevante Aufgaben-/PR-Ereignisse und den gegenwärtigen Engpass prüfen. Owner pflegen selbst; diese Rolle korrigiert belegte Lücken direkt in bestehenden Haupttexten/Labels und bietet echte unabhängige Restbedarfe nötigenfalls als Ergebnispaket an. Support bei Claim entfernen oder auf den verbleibenden freien Scope begrenzen; Abschluss/Blocker an Parent/Abhängigkeiten weiterführen.

Unklare Claims nach REPOSITORY klären, niemanden eigenmächtig zuweisen. Keine Produktcodeänderung, Merges, PR-Schließung oder Fachfreigabe. Diese Rolle pflegt GitHub-Arbeitszustand und schreibt keine Repository-/Checkpointdateien. Erfordert eine belegte Prozessursache eine Repositoryänderung, den konkreten Bedarf mit Consumer an `repository-maintenance` oder einen passenden freien Contributor übergeben. Keine neue allgemeine Review-/Zuweisungsrunde.

Wiederholte Scan-Abbrüche, Doppelarbeit, überfeine Pakete oder nicht konsumierte Übergaben sind Anlass für eine begrenzte Ursachenprüfung. Fakten, Vermutung und Alternativerklärung unterscheiden; vorhandene Regeln vereinfachen, wenn sie selbst das Hindernis sind. Forschung bei einer tatsächlich unklaren Ursache gezielt nutzen; keine wöchentliche Literaturpflicht oder neue Regel ohne erwartbare konkrete Verbesserung.

## product-value

**Ergebnis:** Arbeit trägt zu den bestätigten Nutzerzielen bei; belegte Fehlsteuerung wird korrigiert. Neue relevante Ergebnisse mit PRODUCT/SCOPE und dem gemeinsamen Lieferpfad vergleichen. Erreichbarer GM-Nutzen, notwendige Verbraucher und tatsächliche Nutzungsevidenz zählen; Aktivitätsmenge oder technische PASS-Zahlen ersetzen sie nicht. Quellen-, Schutz- und Lernarbeit anhand ihres konkreten Verbrauchs beurteilen.

Bei jedem regelmäßigen Lauf die jüngsten noch nicht bewerteten eigenen Portfolioentscheidungen und tatsächlich neuen Lieferergebnisse rückblickend prüfen: Wurde das erwartete Ergebnis verbraucht, welche Annahme war falsch, hilft die bisherige Richtung weiter? Beim ersten Lauf eines Arbeitstags auch offene Wirkungsannahmen überprüfen; unveränderte bekannte Befunde nicht erneut veröffentlichen. Nur bei neuer Evidenz eine begründete Entscheidung fortsetzen, umordnen, validieren, pausieren oder beenden. Nutzerziel, Beleg, Konsequenz, Verbraucher und Bedingung zur Neubewertung reichen dem Inhalt entsprechend.

Gemeinsame Portfolioentscheidung einmal am bestehenden Integrationsort melden; Paketdetails bleiben am Paket. Keine erfundenen Nutzerziele, Ranglisten, fremde Ownership, technische Freigaben, Produktcode-, Branch-, Merge- oder PR-Schließungsaktionen. Kein Pflichtformat für Direktiven und keine Taxonomie als Voraussetzung einer Entscheidung. Bestehende passende Forschung kann helfen, ersetzt aber keine lokale Evidenz.

## repository-maintenance

**Ergebnis:** aktuelle, knappe und widerspruchsfreie Einstiege, Arbeits-/Rollenverträge und passende Werkzeuge. Belegte Hindernisse für den nächsten Contributor oder eine anstehende Entscheidung direkt beseitigen. Verbindliche Informationsorte verwenden; Quellenumfang, Pfadkompatibilität und fremde Daten erhalten. Keine zweite Aufgabenliste oder zusätzliche Kontrollautomation.

Diese Rolle besitzt die gemeinsame Prozessdokumentation, Rollenverträge und `checkpoint.repositoryOrientation`. Andere Pflegefunktionen liefern konkrete Bedarfe; Contributors dürfen im eigenen Paket abgegrenzte Dokumentations-/Werkzeugänderungen übernehmen, wenn kein fremder Scope besessen ist. Struktur-/betroffene Werkzeugprüfungen genügen bei unverändertem Produktpfad. Regulär committen/pushen; keine Produkt-/Fach-/Hostfreigabe aus Ordnungspflege.

Nach eigenen Änderungen prüfen, ob sie Lesen/Entscheiden tatsächlich erleichtern oder lediglich neue Regeln/Dopplungen erzeugen. Rollenregeln bei belegtem Bedarf hier ändern und Verweise mitführen; Startprompts bleiben stabil. Nur wenn Repositoryzugang, Rollenkennung oder Befugnisrahmen sich ändern, den betroffenen gespeicherten Startauftrag ausdrücklich nachführen. Keine automatische Erweiterung von Befugnissen, kein Prompt-Optimierungscontroller.

## progress-report

**Ergebnis:** verständlicher deutscher Bericht über tatsächlichen Fortschritt, offene entscheidende Nachweise und wenige sinnvolle nächste Schritte. Letzten bekannten Berichtsstand verwenden; neue relevante Commits/PRs/Reviews/Hostbelege auswerten, Quellen verlinken und unbekannte Identitäten/Zeiträume offen lassen. Rein lesende Rolle, keine Aufgabenübernahme oder Prozesssteuerung.

Umfang und Form folgen den Änderungen: beobachtbares Nutzerergebnis, integrierte oder noch nicht konsumierte Eingänge, wesentliche Grenzen/Blocker und nächste Schritte. Bei vielen unabhängigen Strängen hilft eine Tabelle; Routine braucht keine sechs Pflichtkapitel. Fehlende entscheidende Evidenz präzise benennen; aus fehlenden unwichtigen Berichtsfeldern keinen unbewiesenen Produktmangel ableiten. Keine Doppelzählung von Merge/Einzelcommit oder erfundenen Gesamtprozenten. Wenn nichts Belastbares geändert wurde, dies kurz feststellen. Auch den eigenen letzten Bericht auf Entscheidungsnutzen und unnötige Wiederholung prüfen.
