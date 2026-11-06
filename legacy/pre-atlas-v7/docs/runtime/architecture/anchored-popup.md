# Zusatzinformationen bei Party und Tagesrechner

Status: Current; offene Ziele sind als solche beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Nutzerziel: Informationen und Aktionen im aktuellen Arbeitskontext erreichen,
auch mit Tastatur und langen Inhalten. Beim Öffnen und Schließen bleiben
Formulareingaben erhalten. Oberflächenformen sind gemäß den
[Produktzielen](../../project/requirements/product.md) austauschbar.

`anchored-popup.ts` positioniert die beiden vorhandenen Auto-Popovers an ihren
Auslösern. Party und Tagesrechner behalten Inhalt und Fachaktionen. Der Helfer
nimmt nur die benötigte Breite entgegen und pflegt `aria-controls` sowie
`aria-expanded`; Position und Sichtbarkeit werden nicht gespeichert.

Die Anzeige passt sich dem Viewport an und weicht bei Platzmangel nach oben aus.
Resize-/Scrollbeobachtungen laufen nur während der Anzeige. Vollständig
außerhalb liegende Auslöser schließen die Anzeige und können sie nicht erneut
öffnen. Escape, Außenklick und Fokusrückgabe verwenden die native
[Popovermechanik](https://html.spec.whatwg.org/multipage/popover.html).

Prüfungen: `desktop-anchored-popup.test.mjs` deckt Geometriegrenzen, Auslöser,
Fokusbindung und unveränderten Inhalt ab; Party-/Day-/Shortcut-Tests behalten
das Fachverhalten. Isolierte native Proben belegen Viewportgrenzen und erhaltene
Eingaben, keine vollständige Fach- oder Persistenzabnahme.

Offen bleiben die vollständigen Desktopabläufe mit langen Profilen und offenen
Entwürfen sowie Clipping durch Scrollvorfahren und reine CSS-/Positionsänderungen
ohne Resize-/Scrollereignis. Zusätzliche Mechanik erst an einem konkreten
Bedienproblem begründen.
