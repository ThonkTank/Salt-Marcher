package clean.world.hex.state;

import clean.shell.input.ComposeShellInput;
import clean.world.hex.input.ComposeHexeditorInput;
import clean.world.hex.input.ComposeHextravelInput;
import clean.world.mapcatalog.input.LoadMapsInput;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

/**
 * Local host factory state for Hexmap world surfaces.
 */
public final class HexState {
    private HexState() {
        throw new AssertionError("No instances");
    }

    public static ComposeHextravelInput.HextravelInput composeHextravel(ComposeHextravelInput input) {
        LoadMapsInput.MapSummary map = requireMap(input == null ? null : input.map());
        Label lifecycleLabel = createMutedLabel("Lifecycle: bereit");
        Label hooksLabel = createMutedLabel("Shell-Hooks: noch nicht verbunden");

        return new ComposeHextravelInput.HextravelInput(new ComposeShellInput.SurfaceInput(
                "travel-hex",
                "Travel Hexmap",
                "session",
                "TH",
                null,
                createToolbar("Hex-Travel Host", "Hexmap #" + map.ref().mapId()),
                createControls("Hexmap Runtime", map.title(),
                        "Spaeter folgen Read-only-Hexgrid, Party-Token und Travel-Aktionen."),
                createMain("Travel: Hexmap", map),
                createDetails(map,
                        "Naechster Ausbau: Kontextdetails, Marker und Tile-Informationen."),
                createState(map, lifecycleLabel, hooksLabel),
                () -> lifecycleLabel.setText("Lifecycle: sichtbar"),
                () -> lifecycleLabel.setText("Lifecycle: versteckt"),
                hooks -> hooksLabel.setText(hooks == null
                        ? "Shell-Hooks: keine Daten"
                        : "Shell-Hooks: verbunden")
        ));
    }

    public static ComposeHexeditorInput.HexeditorInput composeHexeditor(ComposeHexeditorInput input) {
        LoadMapsInput.MapSummary map = requireMap(input == null ? null : input.map());
        Label lifecycleLabel = createMutedLabel("Lifecycle: bereit");
        Label hooksLabel = createMutedLabel("Shell-Hooks: noch nicht verbunden");

        return new ComposeHexeditorInput.HexeditorInput(new ComposeShellInput.SurfaceInput(
                "editor-hex",
                "Editor Hexmap",
                "editor",
                "EH",
                null,
                createToolbar("Hex-Editor Host", "Hexmap #" + map.ref().mapId()),
                createControls("Hexmap Editor", map.title(),
                        "Spaeter folgen Terrain-Brush, Tool-Palette und Dirty-Batching."),
                createMain("Map Editor: Hexmap", map),
                createDetails(map,
                        "Naechster Ausbau: Tile-Inspector, Terrain-Werkzeuge und Bearbeitungsdetails."),
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
                createMutedLabel("Map-Referenz: HEXMAP #" + map.ref().mapId()),
                createMutedLabel("Dieser Host reserviert die Flaeche fuer Hexmap-Runtime oder -Editing.")
        );
        main.setPadding(new Insets(12));
        return main;
    }

    private static VBox createDetails(LoadMapsInput.MapSummary map, String noteText) {
        VBox details = new VBox(
                8,
                createSectionLabel("Details"),
                createMutedLabel("Kartenname: " + map.title()),
                createMutedLabel("Typ: Hexmap"),
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
                createMutedLabel("Aktive Referenz: HEXMAP #" + map.ref().mapId()),
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
