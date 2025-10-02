| Ordner | README sinnvoll? | Kurzbegründung |
| --- | --- | --- |
| ./ | Ja | Repository braucht Einstieg für Anwender und Installation. |
| ./salt-marcher | Ja | Plugin-Bundle wird separat verteilt und benötigt Nutzerhinweise. |
| ./salt-marcher/src | Nein | Enthält reine Entwicklerstruktur ohne direkte Nutzeroberfläche. |
| ./salt-marcher/src/app | Nein | Bootstrap-Code wirkt ausschließlich intern. |
| ./salt-marcher/src/apps | Ja | Überblick über verfügbare Apps erleichtert Bedienstart. |
| ./salt-marcher/src/apps/cartographer | Ja | Hauptwerkzeug mit eigenem Nutzer-Workflow. |
| ./salt-marcher/src/apps/cartographer/editor | Nein | Nutzung wird besser im Cartographer-Überblick erklärt. |
| ./salt-marcher/src/apps/cartographer/editor/tools | Nein | Einzelfunktionen folgen der Editor-Anleitung. |
| ./salt-marcher/src/apps/cartographer/editor/tools/terrain-brush | Nein | Spezifisches Werkzeug, UI erklärt sich innerhalb des Editors. |
| ./salt-marcher/src/apps/cartographer/mode-registry | Nein | Registrierungslogik ohne unmittelbare Nutzerinteraktion. |
| ./salt-marcher/src/apps/cartographer/mode-registry/providers | Nein | Technische Ableitungen für Registry, nicht nutzerrelevant. |
| ./salt-marcher/src/apps/cartographer/modes | Nein | Nutzerführung besser zentral im Cartographer-README. |
| ./salt-marcher/src/apps/cartographer/modes/travel-guide | Nein | Reiseleitfaden wird bereits im Gesamtworkflow adressiert. |
| ./salt-marcher/src/apps/cartographer/travel | Nein | Reisefunktionen gehören zur Cartographer-Dokumentation. |
| ./salt-marcher/src/apps/cartographer/travel/domain | Nein | Domänenschicht ohne UI-Anteile. |
| ./salt-marcher/src/apps/cartographer/travel/infra | Nein | Infrastruktur, nicht für Endnutzer bestimmt. |
| ./salt-marcher/src/apps/cartographer/travel/render | Nein | Rendering-Hilfen, keine eigenständige Bedienung. |
| ./salt-marcher/src/apps/cartographer/travel/ui | Nein | UI-Unterbau wird in der übergeordneten Anleitung beschrieben. |
| ./salt-marcher/src/apps/cartographer/view-shell | Nein | Shell-Komponenten dienen nur der Implementation. |
| ./salt-marcher/src/apps/encounter | Ja | Begegnungs-App benötigt Anwenderführung. |
| ./salt-marcher/src/apps/library | Ja | Bibliotheks-App bündelt mehrere Nutzerflüsse. |
| ./salt-marcher/src/apps/library/core | Nein | Backend-Logik ohne Nutzersicht. |
| ./salt-marcher/src/apps/library/create | Nein | Erstellung wird im Library-README behandelt. |
| ./salt-marcher/src/apps/library/create/creature | Nein | Spezialfall der Create-Anleitung. |
| ./salt-marcher/src/apps/library/create/shared | Nein | Geteilte Helfer ohne UI. |
| ./salt-marcher/src/apps/library/create/spell | Nein | Teilmenge der Create-Anleitung. |
| ./salt-marcher/src/apps/library/view | Nein | Anzeige-Fluss liegt in der Library-Beschreibung. |
| ./salt-marcher/src/core | Nein | Kernlogik ohne Endnutzeroberfläche. |
| ./salt-marcher/src/core/hex-mapper | Nein | Interne Hex-Mapping-Engine. |
| ./salt-marcher/src/core/hex-mapper/render | Nein | Rendering-Hilfen ohne direkten Nutzerkontakt. |
| ./salt-marcher/src/ui | Nein | UI-Bausteine für Entwickler. |
| ./salt-marcher/tests | Nein | Test-Suites adressieren Entwickler, nicht Anwender. |
| ./salt-marcher/tests/app | Nein | Entwicklerfokus. |
| ./salt-marcher/tests/cartographer | Nein | Entwicklerfokus. |
| ./salt-marcher/tests/cartographer/editor | Nein | Entwicklerfokus. |
| ./salt-marcher/tests/cartographer/travel | Nein | Entwicklerfokus. |
| ./salt-marcher/tests/core | Nein | Entwicklerfokus. |
| ./salt-marcher/tests/encounter | Nein | Entwicklerfokus. |
| ./salt-marcher/tests/library | Nein | Entwicklerfokus. |
| ./salt-marcher/tests/mocks | Nein | Testhilfen für Entwickler. |
| ./salt-marcher/tests/ui | Nein | Entwicklerfokus. |
