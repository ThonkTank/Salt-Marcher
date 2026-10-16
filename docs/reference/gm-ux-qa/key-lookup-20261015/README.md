# Raumhinweise am Spieltisch wiederfinden: Kampagnenwerkstatt und TiddlyWiki

Geprüft am 15. Oktober 2026. Aufgabe: In einer vorbereiteten Garnison den Raum
mit dem Bronzeschlüssel und dem Verweis auf Nera wiederfinden, ohne den Text
vorsorglich in jeden Raum zu kopieren. Drei Räume, ein wiederverwendeter
Beschreibungstext und eine NSC-Notiz bilden den gleichen Suchfall in beiden
Produkten. Die Daten sind ausschließlich synthetisch.

## Tatsächlich benutzte Oberflächen

- Kampagnenwerkstatt 0.129.0, Electron-Runtime 44.7.0, Linux: regulärer
  Desktopprozess mit eigenem SQLite-Datenordner. Die Vorbereitung entsteht vor
  dem Start über den bestehenden öffentlichen CampaignStore; Auswahl, Suche,
  Öffnen und spätere Textkorrektur erfolgen über die echte Electron-Oberfläche.
  Vorher: `d38e91df`; nachher: `d41a02d7` mit diesem Suchfix.
  Die dazwischen integrierten Änderungen betreffen diese Key-Suche nicht.
- [TiddlyWiki empty.html](https://tiddlywiki.com/empty.html), Version **5.4.1**,
  abgelesen unter ControlPanel → Info → Basics. Alle fünf Notizen wurden in
  der Browseroberfläche angelegt und bestätigt. Die Wachstube enthält den
  wiederverwendeten Text über `{{Wachposten}}` und den NSC über einen Wikilink.
  [Aufbau und beobachtete UI-Antworten](comparator.json).

Verglichen wird das **Wiederfinden vorhandener Vorbereitung**, nicht die
Geschwindigkeit der unterschiedlich vorbereiteten Datensätze. Keine
Zeitmessung oder allgemeine Überlegenheit für menschliche Spielleitungen.

## Beobachtung und Entscheidung

| Suchaufgabe | Kampagnenwerkstatt vorher | TiddlyWiki im geprüften Standardstand | Kampagnenwerkstatt nachher |
| --- | --- | --- | --- |
| Eigener Text „Silberschlüssel“ | Archiv | Archiv | Archiv mit passendem Textausschnitt |
| Vorlagentext „Bronzeschlüssel“ | Keine Räume, obwohl der Hinweis in der Beschreibungsvorschau steht | Nur die Quellnotiz Wachposten; die gerenderte Wachstube fehlt in den Treffern | Wachstube mit „Vorlage · Wachposten“ und dem gesuchten Hinweis |
| Verknüpfter NSC „Nera“ | Keine Räume | NSC-Notiz und Wachstube | Wachstube mit „Verweis: Nera die Quartiermeisterin“ |

Die vorherige Beschriftung „Volltext“ versprach mehr als die Bearbeitersuche
lieferte. Der vorhandene **Binder** konnte Vorlagentext und gespeicherte
Verweislabels bereits finden; der Nachher-Lauf prüft diesen unveränderten
Ausweichweg ausdrücklich. Der Mangel betraf somit die inkonsistente Suche
zwischen Lesen und Bearbeiten, nicht sämtliche Suchwege des Produkts.

TiddlyWiki verbindet kleine Notizen und Wiederverwendung ohne doppelte Prosa.
Seine Suche nach dem NSC erschließt auch den verweisenden Raum. Beim gesuchten
Vorlagentext bleibt im geprüften Standardsuchweg jedoch die zusätzliche Frage,
an welchen Orten diese Quelle verwendet wird. Unsere Raumsuche liefert deshalb
direkt den Einsatzort und nennt daneben die Quelle des Treffers.

Die Korrektur durchsucht expandierte Vorlagen, Such-/Entdeckungshinweise,
wirksame geerbte Eigenschaften und Verweislabels zusätzlich zu den eigenen
Raumtexten. Bekannte aktuelle Verweisnamen haben Vorrang vor dem gespeicherten
Label; nicht geladene oder nicht auflösbare Ziele behalten dessen Wortlaut.
Unterdrückte Eigenschaften und Vorlagen fremder Dungeons liefern keine Treffer.
Die Suche schreibt weder Originaltexte noch duplizierte Vorlagenprosa.
Enter öffnet weiter den ersten Raum; ein leerer Trefferstand wird erklärt.

## Belege und Wiederholung

- [Vorher-Ergebnisse](before.json), [Vorher: Vorlagentext](before-template-search.png),
  [Vorher: NSC-Verweis](before-reference-search.png).
- [Nachher-Ergebnisse einschließlich Buildhashes](after.json),
  [Nachher: Vorlagentext](after-template-search.png),
  [Nachher: NSC-Verweis](after-reference-search.png).
- [Nativer Ablauf](../../../../tools/test-desktop-key-lookup.mjs):
  `npm run test:desktop-key-lookup-ui` unter Linux. Drei eigene Appstarts,
  jeder mit bestätigtem Exit 0. Reines Suchen erhält alle Keyrecords unverändert;
  die anschließende UI-Korrektur der Vorlage auf „Eisenschlüssel“ ändert nur die
  ausdrücklich bearbeitete Vorlage. Die neue Suche wirkt sofort und nach einem
  weiteren frischen Prozessstart; originale Raumtexte bleiben erhalten.
- [Suchregressionen](../../../../tests/desktop-key-search.test.mjs) und vorhandene
  Key-/Discovery-/Copy-/Binderprüfungen: 47 Tests bestanden. Beide Typechecks,
  Repositoryprüfung sowie Plugin- und Desktopbuild sind getrennte lokale Checks.

Die Vergleichsnotizen sind im Browser bestätigt. Der versuchte Dateiexport
wurde unterbrochen; Export oder Wiederaufnahme von TiddlyWiki werden daher
nicht als bestanden ausgewiesen. Die Vergleichsdaten oben sind dokumentierte
UI-Beobachtungen, kein exportiertes Wiki.

## Weiterer Vergleichsauftrag bleibt offen

Dieser Lauf prüft einen konkreten Suchfall. Notizen anlegen und umorganisieren,
Rückverweise bearbeiten, längere Raum-Keys während des Leitens lesen sowie
weitere Produkte und reale große Kampagnen benötigen weitere direkte Abläufe.
Spielerfreigabe, gesamte Raum-Key-Parität und Produktabnahme sind hiermit nicht
abgeschlossen.
