package clean.featuretabs.mapeditortab;

import clean.featuretabs.mapcatalog.input.LoadMapsInput;
import clean.featuretabs.mapeditortab.dungeoneditor.DungeoneditorObject;
import clean.featuretabs.mapeditortab.dungeoneditor.input.ComposeDungeoneditorInput;
import clean.featuretabs.mapeditortab.hexeditor.HexeditorObject;
import clean.featuretabs.mapeditortab.hexeditor.input.ComposeHexeditorInput;
import clean.featuretabs.mapeditortab.input.ComposeMapeditortabInput;
import clean.shell.input.ComposeShellInput;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

/**
 * Aggregated Clean editor surface for Hexmap and Dungeon map editing.
 */
@SuppressWarnings("unused")
public final class MapeditortabObject {

    private final ComposeMapeditortabInput.MapeditortabInput mapeditortab;

    public MapeditortabObject(ComposeMapeditortabInput input) {
        ComposeMapeditortabInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.mapeditortab = new MapeditortabAssembly(resolvedInput).composeMapeditortab();
    }

    public ComposeMapeditortabInput.MapeditortabInput composeMapeditortab(ComposeMapeditortabInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return mapeditortab;
    }

    private static final class MapeditortabAssembly {

        private final ComposeMapeditortabInput input;

        private MapeditortabAssembly(ComposeMapeditortabInput input) {
            this.input = input;
        }

        private ComposeMapeditortabInput.MapeditortabInput composeMapeditortab() {
            java.util.List<LoadMapsInput.MapInput> maps = normalizeMaps(input.maps());
            StackPane mainHost = new StackPane();
            Label activeModeLabel = createMutedLabel("Keine Karte ausgewaehlt");
            ComboBox<LoadMapsInput.MapInput> mapSelector = createMapSelector(maps);
            VBox controls = createControls(mapSelector, activeModeLabel);

            if (!maps.isEmpty()) {
                mapSelector.getSelectionModel().selectFirst();
                showSelectedMap(mainHost, activeModeLabel, mapSelector.getValue());
            } else {
                mainHost.getChildren().setAll(createEmptyMain());
            }
            mapSelector.getSelectionModel().selectedItemProperty().addListener(
                    (observable, previousMap, selectedMap) -> showSelectedMap(mainHost, activeModeLabel, selectedMap));

            return new ComposeMapeditortabInput.MapeditortabInput(new ComposeShellInput.SurfaceInput(
                    "map-editor",
                    "Map Editor",
                    "editor",
                    "ME",
                    input.navigationGraphic(),
                    null,
                    controls,
                    mainHost,
                    null,
                    null,
                    null,
                    null
            ));
        }

        private void showSelectedMap(StackPane mainHost, Label activeModeLabel, LoadMapsInput.MapInput selectedMap) {
            if (selectedMap == null) {
                activeModeLabel.setText("Keine Karte ausgewaehlt");
                mainHost.getChildren().setAll(createEmptyMain());
                return;
            }
            activeModeLabel.setText("Automatischer Unter-View: " + describeKind(selectedMap.mapKind()));
            mainHost.getChildren().setAll(createSubview(selectedMap));
        }

        private Node createSubview(LoadMapsInput.MapInput map) {
            if (isDungeon(map)) {
                ComposeDungeoneditorInput dungeoneditorInput = new ComposeDungeoneditorInput(map);
                return new DungeoneditorObject(dungeoneditorInput).composeDungeoneditor(dungeoneditorInput).mainContent();
            }
            ComposeHexeditorInput hexeditorInput = new ComposeHexeditorInput(map);
            return new HexeditorObject(hexeditorInput).composeHexeditor(hexeditorInput).mainContent();
        }

        private static VBox createControls(ComboBox<LoadMapsInput.MapInput> mapSelector, Label activeModeLabel) {
            Label header = new Label("Editor");
            header.getStyleClass().addAll("section-header", "text-muted");

            Label mapLabel = createMutedLabel("Karte");
            Label noteLabel = createMutedLabel(
                    "Map Editor nutzt dieselbe Auswahl fuer Hexmap- und Dungeon-Bearbeitung und wechselt den Unter-View automatisch.");

            VBox controls = new VBox(8, header, mapLabel, mapSelector, activeModeLabel, noteLabel);
            controls.setFillWidth(true);
            controls.setPadding(new Insets(12));
            return controls;
        }

        private static ComboBox<LoadMapsInput.MapInput> createMapSelector(java.util.List<LoadMapsInput.MapInput> maps) {
            ComboBox<LoadMapsInput.MapInput> comboBox = new ComboBox<>();
            comboBox.getItems().setAll(maps);
            comboBox.setMaxWidth(Double.MAX_VALUE);
            comboBox.setButtonCell(createMapCell());
            comboBox.setCellFactory(listView -> createMapCell());
            return comboBox;
        }

        private static ListCell<LoadMapsInput.MapInput> createMapCell() {
            return new ListCell<>() {
                @Override
                protected void updateItem(LoadMapsInput.MapInput item, boolean empty) {
                    super.updateItem(item, empty);
                    setText(empty || item == null ? "" : item.title() + " (" + describeKind(item.mapKind()) + ")");
                }
            };
        }

        private static Node createEmptyMain() {
            VBox main = new VBox(
                    12,
                    createTitleLabel("Map Editor"),
                    createMutedLabel("Der Map-Editor-Surface wartet auf mindestens eine registrierte Karte."),
                    createMutedLabel("Sobald eine Hexmap oder Dungeon-Map verfuegbar ist, schaltet der Unter-View automatisch.")
            );
            main.setPadding(new Insets(12));
            return main;
        }

        private static java.util.List<LoadMapsInput.MapInput> normalizeMaps(java.util.List<LoadMapsInput.MapInput> maps) {
            return maps == null ? java.util.List.of() : java.util.List.copyOf(maps.stream()
                    .filter(java.util.Objects::nonNull)
                    .toList());
        }

        private static boolean isDungeon(LoadMapsInput.MapInput map) {
            return map != null && "DUNGEON".equalsIgnoreCase(normalizeText(map.mapKind()));
        }

        private static String describeKind(String mapKind) {
            return isDungeon(new LoadMapsInput.MapInput("", mapKind, "", ""))
                    ? "Dungeon"
                    : "Hexmap";
        }

        private static Label createTitleLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("title");
            return label;
        }

        private static Label createMutedLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("text-muted");
            label.setWrapText(true);
            return label;
        }

        private static String normalizeText(String value) {
            return value == null ? "" : value.trim();
        }
    }
}
