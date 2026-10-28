# Installationsweite Generator-Einstellungen

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: campaign
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Original: Salt-Marcher `9de85c1a26f526acbc1af332ac5962e185c0aab2`,
`docs/encounter/requirements/requirements-encounter-generation.md`.

Das Anwendungsmenü öffnet denselben Preseteditor wie die Encounter-Vorbereitung,
auch ohne geladene oder vorhandene Kampagne. Das 66-px-Menü verwendet den
vorhandenen nativen Anchored-Popup-Helfer (176 px, Escape, Light-Dismiss,
Fokusrückgabe). Editorcode und ergänzende Styles werden separat nachgeladen.
Eine ausdrücklich gewählte Kampagnen-ID bestimmt nur den Zuweisungskontext;
Öffnung, Nutzung, Party und Spieltisch werden dadurch nicht aktiviert.

Der geschützte Systemstand lässt sich kopieren. Kopieren und Speichern bleiben
unzugewiesen. Gespeicherte Regeln lassen sich ausdrücklich zuweisen oder löschen;
Löschen entfernt sämtliche Zuweisungen und stellt den Systemfallback her.
Die bestehende gemeinsame Config-V5-Validierung und kanonischen Config-Hashes
bleiben die Autorität. Beide Aufrufwege verwenden dieselbe Policy-Mutation.

Der Editor behält alle 680 semantischen Matrixzellen, Pinsel-, Rechtsklick- und
Tastaturbedienung. Vier Schwierigkeitsgrenzen verändern jeweils benachbarte
Gewichte bei unveränderter Summe 100; Pfeile bewegen um 1, Shift um 5 Prozent.
Zeigerereignisse werden pro Animationframe zusammengefasst. Kopf/Fuß bleiben
fest, der Inhalt scrollt; Regelspalten kollabieren bei kleinen Viewports.

Jeder Editorauftrag hat UUID und erwartete Registryrevision. Mutation und
prüfsummengeschützter Originalbeleg sind atomar; die jüngsten 512 Belege bleiben
installationslokal erhalten und werden aus Kampagnenpaketen entfernt. Eine
unklare Antwort wird ausschließlich über die ursprüngliche Kennung abgefragt;
die Oberfläche wiederholt die Mutation nicht. Der offene Auftrag überlebt im
lokalen Rendererzustand einen Neustart. Gleiche Kennung mit anderem Inhalt wird
abgewiesen. Diese Schnittstelle ergänzt die vorhandenen kampagnengebundenen
Generatorbefehle; deren historische Belege bleiben erhalten.

Versionskonflikte beim Speichern erhalten den Entwurf und bieten Neueste Version
laden oder Als Kopie speichern. Konflikte bei Zuweisung/Löschen aktualisieren die
Registry und benötigen einen weiteren ausdrücklichen Klick. Schließen und
Presetwechsel fragen bei ungespeicherten Änderungen nach. App-Schließen wartet
auch ohne Workspace auf den offenen Editor.

Gezielte Store-/Regressionstests und der native Treiber im eigenen Arbeitsbereich
prüfen Copy/Save/Assign/Delete, Versionskonflikt, Neustart, Originalprosa und
Nutzungszeiten sowie Tastatur und 100 %-Layout. Dies ersetzt nicht die volle
Encounter-Abnahme: Selector-p95, Scene/Session-Parität, vollständige Combatkanten,
Hell/Dunkel-Goldens und weitere Betriebssysteme bleiben getrennte Nachweise.
