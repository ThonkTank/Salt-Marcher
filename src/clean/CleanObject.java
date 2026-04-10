package clean;

import clean.input.ShowApplicationInput;
import clean.navigation.input.ComposeNavigationInput;
import clean.placeholder.PlaceholderObject;
import clean.placeholder.input.ComposePlaceholderInput;
import clean.startup.StartupObject;
import clean.startup.input.StartApplicationInput;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.scene.control.Alert;
import javafx.stage.Stage;

/**
 * Public root seam for the isolated clean application lifecycle.
 */
@SuppressWarnings("unused")
public final class CleanObject {

    public void showApplication(ShowApplicationInput input) {
        ShowApplicationInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        PlaceholderObject placeholderObject = new PlaceholderObject();
        java.util.List<ComposeNavigationInput.SurfaceInput> surfaces = java.util.List.of(
                placeholderObject.composePlaceholder(new ComposePlaceholderInput(
                        "start",
                        "Clean Start",
                        "Start",
                        "Neuer isolierter Projekteinstieg. Diese Shell ist der Ausgangspunkt fuer den manuellen Neuaufbau aller bisherigen Capabilities.",
                        java.util.List.of(
                                "Default-Lifecycle laeuft jetzt ausschliesslich auf src/clean.",
                                "Keine Legacy-Imports aus src/features, src/ui, src/database, src/shared oder src/importer.",
                                "Jede Capability wird hier spaeter separat neu implementiert."
                        ),
                        java.util.List.of(
                                "Phase 1 liefert nur Shell, Navigation und Ausbauziele.",
                                "Die alte Codebase bleibt unveraendert und wird nicht adaptiert.",
                                "Build-Guard blockiert jeden Rueckgriff auf Legacy-Projektpakete."
                        ),
                        java.util.List.of(
                                "Naechster Ausbau: echte Clean-Owner pro Capability-Familie.",
                                "Persistenz und Datenpipeline werden spaeter clean neu aufgebaut."
                        ))),
                placeholderObject.composePlaceholder(new ComposePlaceholderInput(
                        "encounter",
                        "Encounter",
                        "Encounter",
                        "Neubau fuer Builder, Generation, Kampfzustand und Difficulty-Feedback.",
                        java.util.List.of(
                                "Builder- und Combat-Workflow neu modellieren.",
                                "Kein Rueckgriff auf alte Generator- oder Tracker-Klassen.",
                                "Eigene Clean-Zustands- und Persistenzgrenzen definieren."
                        ),
                        java.util.List.of(
                                "Bisher nur Ausbauziel markiert.",
                                "Interaktionen und Datenfluesse werden hier spaeter clean nachgebaut."
                        ),
                        java.util.List.of(
                                "Status: Placeholder.",
                                "Abhaengigkeiten: spaetere Party-, Tables- und Catalog-Owner in clean."
                        ))),
                placeholderObject.composePlaceholder(new ComposePlaceholderInput(
                        "overworld",
                        "Overworld",
                        "Overworld",
                        "Neubau fuer Kartenansicht, Reiseflaeche und Welt-Navigation.",
                        java.util.List.of(
                                "World-Runtime in clean kapseln.",
                                "Eigene Karten- und Reisezustandsgrenzen schaffen.",
                                "Inspector- und State-Interaktion spaeter clean definieren."
                        ),
                        java.util.List.of(
                                "Der bisherige Hexmap-/World-Stack wird hier nicht wiederverwendet.",
                                "Alle Datenmodelle entstehen spaeter direkt unter src/clean."
                        ),
                        java.util.List.of(
                                "Status: Placeholder.",
                                "Ziel: vollwertige Clean-Weltoberflaeche."
                        ))),
                placeholderObject.composePlaceholder(new ComposePlaceholderInput(
                        "map-editor",
                        "Map Editor",
                        "Map Editor",
                        "Neubau fuer Karten-Editing, Werkzeuge und persistente Editor-Workflows.",
                        java.util.List.of(
                                "Editor-Werkzeuge neu unter clean modellieren.",
                                "Keine Legacy-Canvas- oder Tool-Controller importieren.",
                                "Spaetere Clean-Persistenz separat anbinden."
                        ),
                        java.util.List.of(
                                "Toolbar- und Panel-Slots sind bereits reserviert.",
                                "Phase 1 markiert nur die kuenftige Surface."
                        ),
                        java.util.List.of(
                                "Status: Placeholder.",
                                "Abhaengigkeiten: spaetere clean world/map owners."
                        ))),
                placeholderObject.composePlaceholder(new ComposePlaceholderInput(
                        "dungeon",
                        "Dungeon",
                        "Dungeon",
                        "Neubau fuer Dungeon-Runtime, Navigation und Referenzinformationen.",
                        java.util.List.of(
                                "Legacy dungeon und dungeonclean werden nicht angebunden.",
                                "Neue Clean-Runtime und Datenmodelle folgen spaeter.",
                                "Globale Shell bleibt davon entkoppelt."
                        ),
                        java.util.List.of(
                                "Bisher nur Capabilities-Ziel fuer den Neuaufbau.",
                                "Kein Hybrid mit altem Dungeon-Stack."
                        ),
                        java.util.List.of(
                                "Status: Placeholder.",
                                "Fokus spaeter: Runtime-Flaeche und Referenz-Inspector."
                        ))),
                placeholderObject.composePlaceholder(new ComposePlaceholderInput(
                        "dungeon-editor",
                        "Dungeon Editor",
                        "Dungeon Editor",
                        "Neubau fuer den sauberen Dungeon-Editor mit eigener Interaction- und State-Struktur.",
                        java.util.List.of(
                                "Editorzustand, Werkzeuge und Schreibpfade werden clean neu geschnitten.",
                                "Keine Legacy-Editor-Komposition oder Cluster-Rewrite-Services importieren.",
                                "State- und Details-Panels bleiben im Cockpit bereits vorbereitet."
                        ),
                        java.util.List.of(
                                "Der bisherige Editor ist nur Referenz fuer den funktionalen Umfang.",
                                "Phase 1 liefert die Shell-Oberflaeche als Ausbauziel."
                        ),
                        java.util.List.of(
                                "Status: Placeholder.",
                                "Ziel: spaeter vollwertiger sauberer Editor unter clean."
                        ))),
                placeholderObject.composePlaceholder(new ComposePlaceholderInput(
                        "tables",
                        "Tables",
                        "Tables",
                        "Neubau fuer Encounter- und Loot-Tabellen unter einer clean Workspace-Surface.",
                        java.util.List.of(
                                "Generische Tabellen-Scaffolds spaeter in clean neu bauen.",
                                "Encounter- und Loot-Semantik getrennt neu modellieren.",
                                "Keine Alt-Workspace- oder Editor-Views wiederverwenden."
                        ),
                        java.util.List.of(
                                "Der Tabellenbereich bleibt als eigene Capability-Familie sichtbar.",
                                "Die neue Clean-Shell reserviert dafuer alle vier Pane-Slots."
                        ),
                        java.util.List.of(
                                "Status: Placeholder.",
                                "Abhaengigkeiten: spaetere clean encounter- und loot-owner."
                        ))),
                placeholderObject.composePlaceholder(new ComposePlaceholderInput(
                        "spells",
                        "Spells",
                        "Spells",
                        "Neubau fuer Spell-Katalog, Filterung und Detailanzeige.",
                        java.util.List.of(
                                "Eigene Clean-Catalog- und Browser-Owner spaeter aufbauen.",
                                "Keine Alt-Spell-API oder Browser-Panes importieren.",
                                "Die neue Shell haelt bereits die Ziel-Surface vor."
                        ),
                        java.util.List.of(
                                "Bisher nur Ausbauziel fuer die Clean-Architektur.",
                                "Suche, Filter und Details folgen spaeter separat."
                        ),
                        java.util.List.of(
                                "Status: Placeholder.",
                                "Ziel: eigener Clean-Read- und UI-Stack."
                        ))));
        StartApplicationInput startApplicationInput = new StartApplicationInput(
                resolvedInput.primaryStage(),
                "Salt Marcher",
                surfaces,
                "start");
        new StartupObject().startApplication(startApplicationInput);
    }

    public static final class Runtime extends Application {

        @Override
        public void start(Stage primaryStage) {
            try {
                new CleanObject().showApplication(new ShowApplicationInput(primaryStage));
            } catch (RuntimeException exception) {
                Alert alert = new Alert(Alert.AlertType.ERROR);
                alert.setTitle("Start fehlgeschlagen");
                alert.setHeaderText("Salt Marcher konnte nicht gestartet werden.");
                alert.setContentText(exception.getMessage() == null
                        ? "Unbekannter Fehler beim Start."
                        : exception.getMessage());
                alert.showAndWait();
                Platform.exit();
            }
        }
    }
}
