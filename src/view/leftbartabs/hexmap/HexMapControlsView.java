package src.view.leftbartabs.hexmap;

import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

@SuppressWarnings({
        "PMD.AvoidLiteralsInIfCondition",
        "PMD.CognitiveComplexity",
        "PMD.ExcessiveParameterList",
        "PMD.LawOfDemeter"
})
public final class HexMapControlsView extends VBox {

    private static final String DEFAULT_MARKER_TYPE = "LANDMARK";
    private static final String PAINT_TERRAIN_TOOL = "PAINT_TERRAIN";
    private static final String VALUE_DELIMITER = "\u001f";
    private static final String KEY_TILE_SELECTED = "hex.tileSelected";
    private static final String KEY_Q = "hex.q";
    private static final String KEY_R = "hex.r";
    private static final int MAP_ID_PART = 0;
    private static final int MARKER_ID_PART = 0;
    private static final int MARKER_NAME_PART = 1;
    private static final int MARKER_TYPE_PART = 2;
    private static final int MARKER_NOTE_PART = 3;

    private Consumer<HexMapControlsViewInputEvent> eventConsumer = ignored -> { };

    public HexMapControlsView() {
        getStyleClass().addAll("surface-root", "control-stack");
    }

    public void bind(HexMapControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        ComboBox<String> mapSelector = new ComboBox<>();
        TextField mapNameField = new TextField();
        Spinner<Integer> radiusSpinner = new Spinner<>(0, 99, 2);
        Button selectMapButton = button("Auswaehlen");
        Button createMapButton = button("Neu");
        Button updateMapButton = button("Speichern");
        Button confirmShrinkButton = button("Shrink bestaetigen");
        ToggleGroup toolGroup = new ToggleGroup();
        HBox toolButtons = new HBox(6);
        ComboBox<String> terrainSelector = new ComboBox<>();
        Label selectedTileLabel = label("Kein Hex ausgewaehlt", "text-muted");
        ComboBox<String> markerSelector = new ComboBox<>();
        TextField markerNameField = new TextField();
        ComboBox<String> markerTypeSelector = new ComboBox<>();
        TextArea markerNoteArea = new TextArea();
        Button saveMarkerButton = button("Marker speichern");
        boolean[] updating = {false};

        radiusSpinner.setEditable(true);
        mapNameField.setPromptText("Kartenname");
        markerNameField.setPromptText("Markername");
        markerNoteArea.setPromptText("Notiz optional");
        markerNoteArea.setPrefRowCount(3);
        markerNoteArea.setWrapText(true);
        getChildren().setAll(
                section("Karte", mapSelector, row(selectMapButton, createMapButton), mapNameField,
                        row(label("Radius", "text-muted"), radiusSpinner), row(updateMapButton, confirmShrinkButton)),
                section("Werkzeug", toolButtons, row(label("Terrain", "text-muted"), terrainSelector)),
                section("Marker", selectedTileLabel, markerSelector, markerNameField, markerTypeSelector,
                        markerNoteArea, saveMarkerButton));

        selectMapButton.setOnAction(event -> {
            if (!updating[0]) {
                publish(mapSelector, mapNameField, radiusSpinner, toolGroup, terrainSelector, selectedTileLabel,
                        markerSelector, markerNameField, markerTypeSelector, markerNoteArea, false, rawMapId(mapSelector),
                        rawTool(toolGroup), false, true, false, false);
            }
        });
        createMapButton.setOnAction(event -> {
            if (!updating[0]) {
                publish(mapSelector, mapNameField, radiusSpinner, toolGroup, terrainSelector, selectedTileLabel,
                        markerSelector, markerNameField, markerTypeSelector, markerNoteArea, false, 0L,
                        rawTool(toolGroup), true, false, false, false);
            }
        });
        updateMapButton.setOnAction(event -> {
            if (!updating[0]) {
                publish(mapSelector, mapNameField, radiusSpinner, toolGroup, terrainSelector, selectedTileLabel,
                        markerSelector, markerNameField, markerTypeSelector, markerNoteArea, false, rawMapId(mapSelector),
                        rawTool(toolGroup), false, false, true, false);
            }
        });
        confirmShrinkButton.setOnAction(event -> {
            if (!updating[0]) {
                publish(mapSelector, mapNameField, radiusSpinner, toolGroup, terrainSelector, selectedTileLabel,
                        markerSelector, markerNameField, markerTypeSelector, markerNoteArea, true, rawMapId(mapSelector),
                        rawTool(toolGroup), false, false, true, false);
            }
        });
        terrainSelector.setOnAction(event -> {
            if (!updating[0]) {
                publish(mapSelector, mapNameField, radiusSpinner, toolGroup, terrainSelector, selectedTileLabel,
                        markerSelector, markerNameField, markerTypeSelector, markerNoteArea, false, rawMapId(mapSelector),
                        PAINT_TERRAIN_TOOL, false, false, false, false);
            }
        });
        markerSelector.setOnAction(event -> {
            if (!updating[0]) {
                applyMarkerDraft(markerSelector, markerNameField, markerTypeSelector, markerNoteArea);
            }
        });
        saveMarkerButton.setOnAction(event -> {
            if (!updating[0]) {
                publish(mapSelector, mapNameField, radiusSpinner, toolGroup, terrainSelector, selectedTileLabel,
                        markerSelector, markerNameField, markerTypeSelector, markerNoteArea, false, rawMapId(mapSelector),
                        rawTool(toolGroup), false, false, false, true);
            }
        });

        show(contentModel.projectionProperty().get(), updating, mapSelector, mapNameField, radiusSpinner,
                toolGroup, toolButtons, terrainSelector, selectedTileLabel, markerSelector, markerNameField,
                markerTypeSelector, markerNoteArea, updateMapButton, confirmShrinkButton, saveMarkerButton);
        contentModel.projectionProperty().addListener((ignored, before, after) ->
                show(after, updating, mapSelector, mapNameField, radiusSpinner, toolGroup, toolButtons,
                        terrainSelector, selectedTileLabel, markerSelector, markerNameField, markerTypeSelector,
                        markerNoteArea, updateMapButton, confirmShrinkButton, saveMarkerButton));
    }

    public void onViewInputEvent(Consumer<HexMapControlsViewInputEvent> consumer) {
        eventConsumer = consumer == null ? ignored -> { } : consumer;
    }

    private void show(
            HexMapControlsContentModel.Projection projection,
            boolean[] updating,
            ComboBox<String> mapSelector,
            TextField mapNameField,
            Spinner<Integer> radiusSpinner,
            ToggleGroup toolGroup,
            HBox toolButtons,
            ComboBox<String> terrainSelector,
            Label selectedTileLabel,
            ComboBox<String> markerSelector,
            TextField markerNameField,
            ComboBox<String> markerTypeSelector,
            TextArea markerNoteArea,
            Button updateMapButton,
            Button confirmShrinkButton,
            Button saveMarkerButton
    ) {
        if (projection == null) {
            return;
        }
        updating[0] = true;
        String draftName = markerNameField.getText();
        String draftType = rawMarkerType(markerTypeSelector);
        String draftNote = markerNoteArea.getText();
        mapSelector.getItems().setAll(projection.mapValues());
        selectEncodedById(mapSelector, projection.selectedMapId());
        mapNameField.setText(projection.selectedMapName());
        radiusSpinner.getValueFactory().setValue(projection.selectedMapRadius());
        renderToolButtons(toolGroup, toolButtons, projection, toolKey -> {
            if (!updating[0]) {
                publish(mapSelector, mapNameField, radiusSpinner, toolGroup, terrainSelector, selectedTileLabel,
                        markerSelector, markerNameField, markerTypeSelector, markerNoteArea, false, rawMapId(mapSelector),
                        toolKey, false, false, false, false);
            }
        });
        terrainSelector.getItems().setAll(projection.terrainValues());
        selectEncodedByKey(terrainSelector, projection.activeTerrainKey());
        selectedTileLabel.setText(projection.selectedTileText());
        selectedTileLabel.getProperties().put(KEY_TILE_SELECTED, projection.tileSelected());
        selectedTileLabel.getProperties().put(KEY_Q, projection.selectedQ());
        selectedTileLabel.getProperties().put(KEY_R, projection.selectedR());
        markerTypeSelector.getItems().setAll(projection.markerTypeValues());
        selectEncodedByKey(markerTypeSelector, DEFAULT_MARKER_TYPE);
        markerSelector.getItems().setAll(projection.markerValues());
        markerSelector.getSelectionModel().selectFirst();
        showMarkerDraft(
                markerSelector,
                markerNameField,
                markerTypeSelector,
                markerNoteArea,
                projection.failureText().isBlank(),
                draftName,
                draftType,
                draftNote);
        boolean mapLoaded = projection.mapLoaded();
        updateMapButton.setDisable(!mapLoaded);
        confirmShrinkButton.setDisable(!mapLoaded || projection.warningText().isBlank());
        saveMarkerButton.setDisable(!mapLoaded || !projection.tileSelected());
        markerSelector.setDisable(!mapLoaded || !projection.tileSelected());
        markerNameField.setDisable(!mapLoaded || !projection.tileSelected());
        markerTypeSelector.setDisable(!mapLoaded || !projection.tileSelected());
        markerNoteArea.setDisable(!mapLoaded || !projection.tileSelected());
        updating[0] = false;
    }

    private void publish(
            ComboBox<String> mapSelector,
            TextField mapNameField,
            Spinner<Integer> radiusSpinner,
            ToggleGroup toolGroup,
            ComboBox<String> terrainSelector,
            Label selectedTileLabel,
            ComboBox<String> markerSelector,
            TextField markerNameField,
            ComboBox<String> markerTypeSelector,
            TextArea markerNoteArea,
            boolean confirmShrink,
            long mapId,
            String toolKey,
            boolean createMapRequested,
            boolean selectMapRequested,
            boolean updateMapRequested,
            boolean saveMarkerRequested
    ) {
        eventConsumer.accept(new HexMapControlsViewInputEvent(
                createMapRequested,
                selectMapRequested,
                updateMapRequested,
                saveMarkerRequested,
                mapId,
                mapNameField.getText(),
                radiusSpinner.getValue(),
                confirmShrink,
                toolKey,
                rawTerrain(terrainSelector),
                rawTileSelected(selectedTileLabel),
                rawInt(selectedTileLabel, KEY_Q),
                rawInt(selectedTileLabel, KEY_R),
                rawMarkerId(markerSelector),
                markerNameField.getText(),
                rawMarkerType(markerTypeSelector),
                markerNoteArea.getText()));
    }

    private static void renderToolButtons(
            ToggleGroup toolGroup,
            HBox toolButtons,
            HexMapControlsContentModel.Projection projection,
            Consumer<String> toolPublisher
    ) {
        toolButtons.getChildren().clear();
        for (HexMapControlsContentModel.ToolOption tool : projection.tools()) {
            ToggleButton button = new ToggleButton(tool.label());
            button.setUserData(tool.key());
            button.setToggleGroup(toolGroup);
            button.getStyleClass().add("tool-btn");
            button.setSelected(tool.key().equals(projection.activeToolKey()));
            button.setOnAction(event -> toolPublisher.accept(rawButtonTool(button)));
            toolButtons.getChildren().add(button);
        }
    }

    private static void applyMarkerDraft(
            ComboBox<String> markerSelector,
            TextField markerNameField,
            ComboBox<String> markerTypeSelector,
            TextArea markerNoteArea
    ) {
        String[] parts = rawParts(markerSelector.getValue());
        long markerId = rawLongPart(parts, MARKER_ID_PART);
        if (markerId <= 0L) {
            markerNameField.clear();
            markerNoteArea.clear();
            selectEncodedByKey(markerTypeSelector, DEFAULT_MARKER_TYPE);
            return;
        }
        markerNameField.setText(rawPart(parts, MARKER_NAME_PART));
        markerNoteArea.setText(rawPart(parts, MARKER_NOTE_PART));
        selectEncodedByKey(markerTypeSelector, rawPart(parts, MARKER_TYPE_PART));
    }

    private static void showMarkerDraft(
            ComboBox<String> markerSelector,
            TextField markerNameField,
            ComboBox<String> markerTypeSelector,
            TextArea markerNoteArea,
            boolean useSelectedMarker,
            String draftName,
            String draftType,
            String draftNote
    ) {
        if (useSelectedMarker) {
            applyMarkerDraft(markerSelector, markerNameField, markerTypeSelector, markerNoteArea);
            return;
        }
        markerNameField.setText(draftName);
        markerNoteArea.setText(draftNote);
        selectEncodedByKey(markerTypeSelector, draftType);
    }

    private static void selectEncodedById(ComboBox<String> comboBox, long id) {
        for (String value : comboBox.getItems()) {
            if (rawLongPart(rawParts(value), MAP_ID_PART) == id) {
                comboBox.getSelectionModel().select(value);
                return;
            }
        }
        comboBox.getSelectionModel().clearSelection();
    }

    private static void selectEncodedByKey(ComboBox<String> comboBox, String key) {
        for (String value : comboBox.getItems()) {
            if (rawPart(rawParts(value), 0).equals(key)) {
                comboBox.getSelectionModel().select(value);
                return;
            }
        }
        comboBox.getSelectionModel().selectFirst();
    }

    private static long rawMapId(ComboBox<String> mapSelector) {
        return rawLongPart(rawParts(mapSelector.getValue()), MAP_ID_PART);
    }

    private static String rawTool(ToggleGroup toolGroup) {
        return toolGroup.getSelectedToggle() == null
                || !(toolGroup.getSelectedToggle().getUserData() instanceof String key)
                ? ""
                : key;
    }

    private static String rawButtonTool(ToggleButton button) {
        return button.getUserData() instanceof String key ? key : "";
    }

    private static String rawTerrain(ComboBox<String> terrainSelector) {
        return rawPart(rawParts(terrainSelector.getValue()), 0);
    }

    private static String rawMarkerType(ComboBox<String> markerTypeSelector) {
        return rawPart(rawParts(markerTypeSelector.getValue()), 0);
    }

    private static long rawMarkerId(ComboBox<String> markerSelector) {
        return rawLongPart(rawParts(markerSelector.getValue()), MARKER_ID_PART);
    }

    private static boolean rawTileSelected(Node node) {
        Object value = node.getProperties().get(KEY_TILE_SELECTED);
        return value instanceof Boolean selected && selected;
    }

    private static int rawInt(Node node, String key) {
        Object value = node.getProperties().get(key);
        return value instanceof Number number ? number.intValue() : 0;
    }

    private static String[] rawParts(String encodedValue) {
        return rawText(encodedValue).split(VALUE_DELIMITER, -1);
    }

    private static String rawPart(String[] parts, int index) {
        return index >= 0 && index < parts.length ? rawText(parts[index]) : "";
    }

    private static long rawLongPart(String[] parts, int index) {
        try {
            return Long.parseLong(rawPart(parts, index));
        } catch (NumberFormatException exception) {
            return 0L;
        }
    }

    private static VBox section(String title, Node... nodes) {
        VBox box = new VBox(8);
        box.getStyleClass().add("content-card");
        box.getChildren().add(label(title, "section-title"));
        box.getChildren().addAll(nodes);
        return box;
    }

    private static HBox row(Node... nodes) {
        return new HBox(8, nodes);
    }

    private static Button button(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("toolbar-action-button");
        return button;
    }

    private static Label label(String text, String... styleClasses) {
        Label label = new Label(text);
        label.getStyleClass().addAll(styleClasses);
        return label;
    }

    private static String rawText(String text) {
        return text == null ? "" : text.trim();
    }
}
