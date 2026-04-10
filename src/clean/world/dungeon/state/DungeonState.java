package clean.world.dungeon.state;

import clean.shell.input.ComposeShellInput;
import clean.world.dungeon.input.ComposeDungeoneditorInput;
import clean.world.dungeon.input.ComposeDungeontravelInput;
import clean.world.mapcatalog.input.LoadMapsInput;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

/**
 * Local host factory state for dungeon world surfaces.
 */
public final class DungeonState {
    private DungeonState() {
        throw new AssertionError("No instances");
    }

    public static ComposeDungeontravelInput.DungeontravelInput composeDungeontravel(ComposeDungeontravelInput input) {
        LoadMapsInput.MapSummary map = requireMap(input == null ? null : input.map());
        Label lifecycleLabel = createMutedLabel("Lifecycle: bereit");
        Label hooksLabel = createMutedLabel("Shell-Hooks: noch nicht verbunden");

        return new ComposeDungeontravelInput.DungeontravelInput(new ComposeShellInput.SurfaceInput(
                "travel-dungeon",
                "Travel Dungeon",
                "session",
                "TD",
                null,
                createToolbar("Dungeon-Travel Host", "Dungeon #" + map.ref().mapId()),
                createControls("Dungeon Runtime", map.title(),
                        "Spaeter folgen Runtime-Navigation, Travel-Aktionen und Zentrierung."),
                createMain("Travel: Dungeon", map),
                createDetails(map,
                        "Naechster Ausbau: Raumdetails, Aktionen und Fokussierung im Runtime-Kontext."),
                createState(map, lifecycleLabel, hooksLabel),
                () -> lifecycleLabel.setText("Lifecycle: sichtbar"),
                () -> lifecycleLabel.setText("Lifecycle: versteckt"),
                hooks -> hooksLabel.setText(hooks == null
                        ? "Shell-Hooks: keine Daten"
                        : "Shell-Hooks: verbunden")
        ));
    }

    public static ComposeDungeoneditorInput.DungeoneditorInput composeDungeoneditor(ComposeDungeoneditorInput input) {
        LoadMapsInput.MapSummary map = requireMap(input == null ? null : input.map());
        Label lifecycleLabel = createMutedLabel("Lifecycle: bereit");
        Label hooksLabel = createMutedLabel("Shell-Hooks: noch nicht verbunden");

        return new ComposeDungeoneditorInput.DungeoneditorInput(new ComposeShellInput.SurfaceInput(
                "editor-dungeon",
                "Editor Dungeon",
                "editor",
                "ED",
                null,
                createToolbar("Dungeon-Editor Host", "Dungeon #" + map.ref().mapId()),
                createControls("Dungeon Editor", map.title(),
                        "Spaeter folgen Raum-, Boden-, Wand- und Connection-Werkzeuge."),
                createMain("Map Editor: Dungeon", map),
                createDetails(map,
                        "Naechster Ausbau: Tool-Familien fuer Raum, Boden, Wand, Connections und Uebergaenge."),
                createState(map, lifecycleLabel, hooksLabel),
                () -> lifecycleLabel.setText("Lifecycle: sichtbar"),
                () -> lifecycleLabel.setText("Lifecycle: versteckt"),
                hooks -> hooksLabel.setText(hooks == null
                        ? "Shell-Hooks: keine Daten"
                        : "Shell-Hooks: verbunden")
        ));
    }

    private static LoadMapsInput.MapSummary requireMap(LoadMapsInput.MapSummary map) {
        if (map == null) {
            throw new IllegalArgumentException("map");
        }
        return map;
    }

    private static HBox createToolbar(String titleText, String idText) {
        Label title = new Label(titleText);
        title.getStyleClass().add("subheading");

        Label idLabel = createMutedLabel(idText);
        HBox toolbar = new HBox(12, title, idLabel);
        toolbar.setPadding(new Insets(12));
        return toolbar;
    }

    private static VBox createControls(String sectionText, String mapTitle, String noteText) {
        VBox controls = new VBox(
                8,
                createSectionLabel(sectionText),
                createMutedLabel("Aktive Karte: " + mapTitle),
                createMutedLabel(noteText)
        );
        controls.setPadding(new Insets(12));
        return controls;
    }

    private static VBox createMain(String headingText, LoadMapsInput.MapSummary map) {
        VBox main = new VBox(
                12,
                createHeadingLabel(headingText),
                createMutedLabel(map.summary()),
                createMutedLabel("Map-Referenz: DUNGEON #" + map.ref().mapId()),
                createMutedLabel("Dieser Host reserviert die Flaeche fuer Dungeon-Runtime oder -Editing.")
        );
        main.setPadding(new Insets(12));
        return main;
    }

    private static VBox createDetails(LoadMapsInput.MapSummary map, String noteText) {
        VBox details = new VBox(
                8,
                createSectionLabel("Details"),
                createMutedLabel("Kartenname: " + map.title()),
                createMutedLabel("Typ: Dungeon"),
                createMutedLabel(noteText)
        );
        details.setPadding(new Insets(12));
        return details;
    }

    private static VBox createState(
            LoadMapsInput.MapSummary map,
            Label lifecycleLabel,
            Label hooksLabel
    ) {
        VBox state = new VBox(
                8,
                createSectionLabel("State"),
                createMutedLabel("Aktive Referenz: DUNGEON #" + map.ref().mapId()),
                lifecycleLabel,
                hooksLabel
        );
        state.setPadding(new Insets(12));
        return state;
    }

    private static Label createHeadingLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("heading");
        return label;
    }

    private static Label createSectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("subheading");
        return label;
    }

    private static Label createMutedLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        label.setWrapText(true);
        return label;
    }
}
