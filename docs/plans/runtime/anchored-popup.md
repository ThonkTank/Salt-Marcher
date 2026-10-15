# Verankerte Popups

Originalverträge: [Anchored Popup](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/project/requirements/requirements-anchored-popup.md)
und [Topbar Dropdown](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/project/requirements/requirements-dropdown-popup.md).

Die historischen UI-Quellen liefern hier Prüffragen. Gemäß den
[Produktzielen](../../PRODUCT.md) sind Popups und Dialoge austauschbare Mittel;
eine gemeinsame Klasse oder ein bestimmtes Oberflächenmuster ist keine eigene
Produktfähigkeit. Diese Änderung dient konkret erreichbaren Zusatzinformationen,
nachvollziehbarem Fokus und einer Anzeige am tatsächlichen Auslöser.

## Aktueller Vertrag

`anchored-popup.ts` bindet den Auslöser an ein vorhandenes natives Auto-Popover.
Party und Tagesrechner liefern Inhalt, Breite und eigene Aktionen; der Host
öffnet/schließt und pflegt `aria-controls`/`aria-expanded`. Der Tagesrechner
überschreibt keine Party-Aktion und aktiviert nicht deren Auslöser.

Topbar-Popups richten ihre rechte Kante am Auslöser aus, soweit der Viewport
Platz bietet. Inline-Popups können dieselbe Mechanik mit `below` verwenden.
Der Host begrenzt Breite/Höhe und hält Abstand zu den Viewporträndern. Reicht der
Platz unten nicht, nutzt er den größeren Platz oberhalb. Größenänderungen,
Scrollen und veränderte Inhaltsmaße positionieren erneut; ein verschwundener
Auslöser schließt sein Popup. Dafür werden nur während der Anzeige Resize-/
Scrollbeobachtungen gehalten. Position und Sichtbarkeit werden nicht persistiert.

Escape, Außenklick, gegenseitiges Schließen von Auto-Popovers und Fokusrückgabe
bleiben native Browsermechanik gemäß [HTML Popoverstandard](https://html.spec.whatwg.org/multipage/popover.html).
Beim Öffnen wird der Auslöser als Invoker gebunden und fokussiert, auch bei
programmatischem Öffnen. Ein Außenklick auf ein anderes Control zieht dessen
Fokus nicht zurück. Keine eigenen globalen Escape-/Outsideclick-Handler.

`desktop-anchored-popup.test.mjs` prüft Hostzustand, Geometriegrenzen, entfernte/
gesperrte Auslöser und programmatisches Öffnen; bestehende Party-/Day-/Shortcut-
Proben behalten Fachverhalten und Kontextgrenzen. DOM-Geometriestubs sind kein
nativer Layout- oder Fokusnachweis.

## Noch ausstehende Abnahmen

- Die native Mechanik zusätzlich im vollständigen ausgelieferten Desktop mit
  echten Daten, langen Profilen, offenen Entwürfen und verschachtelten Dialogen
  prüfen. Die isolierte Electron-Bedienprobe nutzt echte Popovermechanik und
  Originaloberflächen mit lesenden APIstubs; sie qualifiziert keine Persistenz.
- Lange Forminhalte und ihre Aktionen im vollständigen Desktop prüfen.
  Ob ein geteilter Kopf-/Aktionsbereich oder eine andere Oberfläche dafür den
  geringsten Aufwand bietet, am konkreten Bedienproblem entscheiden. Die alte
  Dialog-Surface-Form ist keine zusätzliche Lieferpflicht. Der Popuphost besitzt
  weiterhin weder Formulare noch Fachaktionen.
- Weitere Inline-Popups erst bei realem Aufrufer anbinden; keine zweite
  Tooltip-/Menüarchitektur allein zur Vervollständigung dieser Dokumentation.
