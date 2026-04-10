package clean.featuretabs.traveltab;

import clean.featuretabs.mapcatalog.input.LoadMapsInput;
import clean.featuretabs.traveltab.dungeontravel.DungeontravelObject;
import clean.featuretabs.traveltab.dungeontravel.input.ComposeDungeontravelInput;
import clean.featuretabs.traveltab.hextravel.HextravelObject;
import clean.featuretabs.traveltab.hextravel.input.ComposeHextravelInput;
import clean.featuretabs.traveltab.input.ComposeTraveltabInput;
import clean.shell.input.ComposeShellInput;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

/**
 * Aggregated Clean travel surface for Hexmap and Dungeon runtime.
 */
public final class TraveltabObject {

    private final ComposeTraveltabInput.TraveltabInput traveltab;

    public TraveltabObject(ComposeTraveltabInput input) {
        ComposeTraveltabInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.traveltab = new TraveltabAssembly(resolvedInput).composeTraveltab();
    }

    public ComposeTraveltabInput.TraveltabInput composeTraveltab(ComposeTraveltabInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return traveltab;
    }

    private static final class TraveltabAssembly {

        private final ComposeTraveltabInput input;

        private TraveltabAssembly(ComposeTraveltabInput input) {
            this.input = input;
        }

        private ComposeTraveltabInput.TraveltabInput composeTraveltab() {
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

            return new ComposeTraveltabInput.TraveltabInput(new ComposeShellInput.SurfaceInput(
                    "travel",
                    "Travel",
                    "session",
                    "Tr",
                    input.navigationGraphic(),
                    null,
                    controls,
                    mainHost,
                    null,
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
                ComposeDungeontravelInput dungeontravelInput = new ComposeDungeontravelInput(map);
                return new DungeontravelObject(dungeontravelInput).composeDungeontravel(dungeontravelInput).mainContent();
            }
            ComposeHextravelInput hextravelInput = new ComposeHextravelInput(map);
            return new HextravelObject(hextravelInput).composeHextravel(hextravelInput).mainContent();
        }

        private static VBox createControls(ComboBox<LoadMapsInput.MapInput> mapSelector, Label activeModeLabel) {
            Label header = new Label("Runtime");
            header.getStyleClass().add("subheading");

            Label mapLabel = createMutedLabel("Karte");
            Label noteLabel = createMutedLabel(
                    "Travel nutzt dieselbe Auswahl fuer Hexmap- und Dungeon-Runtime und wechselt den Unter-View automatisch.");

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
                    createTitleLabel("Travel"),
                    createMutedLabel("Der Travel-Surface wartet auf mindestens eine registrierte Karte."),
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
            label.getStyleClass().add("heading");
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
