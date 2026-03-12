package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonEncounterSummary;
import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureCategory;
import features.world.dungeonmap.model.DungeonFeatureTile;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

final class DungeonEditorInspectorContentFactory {

    private final DungeonEditorState state;
    private final DungeonEntityCrudController entityCrudController;

    DungeonEditorInspectorContentFactory(
            DungeonEditorState state,
            DungeonEntityCrudController entityCrudController
    ) {
        this.state = state;
        this.entityCrudController = entityCrudController;
    }

    Node buildRoomCard(DungeonRoom room) {
        VBox box = card();
        if (room == null) {
            box.getChildren().add(secondary("Raum nicht gefunden."));
            return box;
        }

        TextField nameField = new TextField(room.name() == null ? "" : room.name());
        TextArea descriptionArea = textArea(room.description());
        Button saveButton = saveButton(() -> {
            entityCrudController.saveRoom(new DungeonRoom(
                    room.roomId(),
                    room.mapId(),
                    nameField.getText().trim(),
                    descriptionArea.getText(),
                    room.areaId()));
        });

        List<DungeonSquare> roomSquares = roomSquares(room.roomId());
        box.getChildren().addAll(
                secondary("Bereich: " + valueOrDash(resolveAreaName(room.areaId()))),
                secondary("Felder: " + roomSquares.size()),
                section("Name", nameField, saveRow(saveButton)),
                section("Beschreibung", descriptionArea));
        appendListSection(box, "Features", describeRoomFeatures(room.roomId()));
        appendListSection(box, "Übergänge", describeRoomEndpoints(room.roomId()));
        appendListSection(box, "Durchgänge", describeRoomPassages(room.roomId()));
        return box;
    }

    Node buildAreaCard(DungeonArea area) {
        VBox box = card();
        if (area == null) {
            box.getChildren().add(secondary("Bereich nicht gefunden."));
            return box;
        }

        TextField nameField = new TextField(area.name() == null ? "" : area.name());
        TextArea descriptionArea = textArea(area.description());
        ComboBox<DungeonEncounterTableSummary> encounterTableCombo = new ComboBox<>();
        encounterTableCombo.setMaxWidth(Double.MAX_VALUE);
        encounterTableCombo.setConverter(namedConverter(DungeonEncounterTableSummary::name));
        encounterTableCombo.getItems().setAll(state.encounterTables());
        encounterTableCombo.setValue(findById(state.encounterTables(), area.encounterTableId(), DungeonEncounterTableSummary::tableId));
        Button saveButton = saveButton(() -> {
            DungeonEncounterTableSummary selectedTable = encounterTableCombo.getValue();
            entityCrudController.saveArea(new DungeonArea(
                    area.areaId(),
                    area.mapId(),
                    nameField.getText().trim(),
                    descriptionArea.getText(),
                    selectedTable == null ? null : selectedTable.tableId()));
        });

        List<DungeonRoom> rooms = roomsForArea(area.areaId());
        box.getChildren().addAll(
                secondary("Encounter Table: " + valueOrDash(resolveEncounterTableName(area.encounterTableId()))),
                secondary("Räume: " + rooms.size()),
                section("Name", nameField),
                section("Beschreibung", descriptionArea),
                section("Encounter Table", encounterTableCombo, saveRow(saveButton)));
        appendListSection(box, "Räume", describeRooms(rooms));
        return box;
    }

    Node buildFeatureCard(DungeonFeature feature) {
        VBox box = card();
        if (feature == null) {
            box.getChildren().add(secondary("Feature nicht gefunden."));
            return box;
        }

        TextField nameField = new TextField(feature.name() == null ? "" : feature.name());
        TextArea notesArea = textArea(feature.notes());
        ComboBox<DungeonFeatureCategory> categoryCombo = new ComboBox<>();
        categoryCombo.setMaxWidth(Double.MAX_VALUE);
        categoryCombo.getItems().setAll(DungeonFeatureCategory.values());
        categoryCombo.setConverter(namedConverter(DungeonFeatureCategory::label));
        categoryCombo.setValue(feature.category() == null ? DungeonFeatureCategory.CURIOSITY : feature.category());
        ComboBox<DungeonEncounterSummary> encounterCombo = new ComboBox<>();
        encounterCombo.setMaxWidth(Double.MAX_VALUE);
        encounterCombo.setConverter(namedConverter(DungeonEncounterSummary::name));
        encounterCombo.getItems().setAll(state.encounters());
        encounterCombo.setValue(findById(state.encounters(), feature.encounterId(), DungeonEncounterSummary::encounterId));
        updateEncounterComboState(encounterCombo, categoryCombo.getValue());
        categoryCombo.valueProperty().addListener((obs, oldValue, newValue) -> updateEncounterComboState(encounterCombo, newValue));
        Button saveButton = saveButton(() -> {
            DungeonFeatureCategory category = categoryCombo.getValue() == null ? DungeonFeatureCategory.CURIOSITY : categoryCombo.getValue();
            DungeonEncounterSummary selectedEncounter = encounterCombo.getValue();
            entityCrudController.saveFeature(new DungeonFeature(
                    feature.featureId(),
                    feature.mapId(),
                    category,
                    category == DungeonFeatureCategory.ENCOUNTER && selectedEncounter != null
                            ? selectedEncounter.encounterId()
                            : null,
                    nameField.getText().trim(),
                    notesArea.getText()));
        });

        List<DungeonFeatureTile> tiles = featureTiles(feature.featureId());
        box.getChildren().addAll(
                secondary("Kategorie: " + valueOrDash(feature.category() == null ? null : feature.category().label())),
                secondary("Encounter: " + valueOrDash(resolveEncounterName(feature.encounterId()))),
                secondary("Felder: " + tiles.size()),
                section("Name", nameField),
                section("Kategorie", categoryCombo),
                section("Encounter", encounterCombo),
                section("Notizen", notesArea, saveRow(saveButton)));
        appendListSection(box, "Positionen", describeFeatureTiles(tiles));
        appendListSection(box, "Räume", describeFeatureRooms(tiles));
        return box;
    }

    private static VBox card() {
        VBox box = new VBox(10);
        box.setPadding(new Insets(12));
        return box;
    }

    private static VBox section(String title, Node... content) {
        VBox box = new VBox(6);
        Label label = new Label(title);
        label.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().add(label);
        box.getChildren().addAll(content);
        return box;
    }

    private static Label secondary(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        label.setWrapText(true);
        return label;
    }

    private static TextArea textArea(String value) {
        TextArea area = new TextArea(value == null ? "" : value);
        area.setWrapText(true);
        area.setPrefRowCount(4);
        return area;
    }

    private static Button saveButton(Runnable onSave) {
        Button button = new Button("Speichern");
        button.setOnAction(event -> onSave.run());
        return button;
    }

    private static HBox saveRow(Node... nodes) {
        HBox row = new HBox(8, nodes);
        row.setFillHeight(true);
        return row;
    }

    private static <T> StringConverter<T> namedConverter(Function<T, String> labelProvider) {
        return new StringConverter<>() {
            @Override
            public String toString(T object) {
                return object == null ? "" : valueOrDash(labelProvider.apply(object));
            }

            @Override
            public T fromString(String string) {
                return null;
            }
        };
    }

    private static void updateEncounterComboState(ComboBox<DungeonEncounterSummary> comboBox, DungeonFeatureCategory category) {
        boolean enabled = category == DungeonFeatureCategory.ENCOUNTER;
        comboBox.setDisable(!enabled);
        comboBox.setManaged(true);
        if (!enabled) {
            comboBox.setValue(null);
        }
    }

    private void appendListSection(VBox parent, String title, List<String> items) {
        if (items.isEmpty()) {
            return;
        }
        VBox content = new VBox(4);
        for (String item : items) {
            Label label = new Label(item);
            label.setWrapText(true);
            content.getChildren().add(label);
        }
        VBox section = section(title, content);
        VBox.setVgrow(content, Priority.NEVER);
        parent.getChildren().add(section);
    }

    private List<DungeonSquare> roomSquares(Long roomId) {
        List<DungeonSquare> result = new ArrayList<>();
        if (roomId == null || state.currentState() == null) {
            return result;
        }
        for (DungeonSquare square : state.currentState().squares()) {
            if (roomId.equals(square.roomId())) {
                result.add(square);
            }
        }
        return result;
    }

    private List<DungeonRoom> roomsForArea(Long areaId) {
        List<DungeonRoom> result = new ArrayList<>();
        if (areaId == null || state.currentState() == null) {
            return result;
        }
        for (DungeonRoom room : state.currentState().rooms()) {
            if (areaId.equals(room.areaId())) {
                result.add(room);
            }
        }
        return result;
    }

    private List<DungeonFeatureTile> featureTiles(Long featureId) {
        List<DungeonFeatureTile> result = new ArrayList<>();
        if (featureId == null || state.currentState() == null) {
            return result;
        }
        for (DungeonFeatureTile tile : state.currentState().featureTiles()) {
            if (featureId.equals(tile.featureId())) {
                result.add(tile);
            }
        }
        return result;
    }

    private List<String> describeRoomFeatures(Long roomId) {
        if (roomId == null || state.currentState() == null) {
            return List.of();
        }
        Map<Long, List<String>> positionsByFeature = new LinkedHashMap<>();
        for (DungeonFeatureTile tile : state.currentState().featureTiles()) {
            DungeonSquare square = findSquareById(tile.squareId());
            if (square == null || !roomId.equals(square.roomId())) {
                continue;
            }
            positionsByFeature.computeIfAbsent(tile.featureId(), ignored -> new ArrayList<>())
                    .add(formatPosition(tile.x(), tile.y()));
        }
        List<String> lines = new ArrayList<>();
        for (Map.Entry<Long, List<String>> entry : positionsByFeature.entrySet()) {
            DungeonFeature feature = findFeature(entry.getKey());
            lines.add(titleOrFallback(feature == null ? null : feature.toString(), "Feature")
                    + " (" + String.join(", ", entry.getValue()) + ")");
        }
        return lines;
    }

    private List<String> describeRoomEndpoints(Long roomId) {
        if (roomId == null || state.currentState() == null) {
            return List.of();
        }
        List<String> lines = new ArrayList<>();
        for (DungeonEndpoint endpoint : state.currentState().endpoints()) {
            DungeonSquare square = squareAt(endpoint.x(), endpoint.y());
            if (square == null || !roomId.equals(square.roomId())) {
                continue;
            }
            lines.add(titleOrFallback(endpoint.name(), "Übergang")
                    + " (" + formatPosition(endpoint.x(), endpoint.y()) + ")");
        }
        return lines;
    }

    private List<String> describeRoomPassages(Long roomId) {
        if (roomId == null || state.currentState() == null) {
            return List.of();
        }
        List<String> lines = new ArrayList<>();
        for (DungeonPassage passage : state.currentState().passages()) {
            if (!passageTouchesRoom(passage, roomId)) {
                continue;
            }
            lines.add(titleOrFallback(passage.name(), "Durchgang")
                    + " (" + formatPosition(passage.x(), passage.y()) + ", "
                    + valueOrDash(passage.direction() == null ? null : passage.direction().name()) + ")");
        }
        return lines;
    }

    private List<String> describeRooms(List<DungeonRoom> rooms) {
        List<String> lines = new ArrayList<>();
        for (DungeonRoom room : rooms) {
            lines.add(titleOrFallback(room.name(), "Raum") + " (" + roomSquares(room.roomId()).size() + " Felder)");
        }
        return lines;
    }

    private List<String> describeFeatureTiles(List<DungeonFeatureTile> tiles) {
        List<String> lines = new ArrayList<>();
        for (DungeonFeatureTile tile : tiles) {
            DungeonSquare square = findSquareById(tile.squareId());
            String roomName = square == null ? null : square.roomName();
            lines.add(formatPosition(tile.x(), tile.y())
                    + (roomName == null || roomName.isBlank() ? "" : " • " + roomName));
        }
        return lines;
    }

    private List<String> describeFeatureRooms(List<DungeonFeatureTile> tiles) {
        LinkedHashSet<String> names = new LinkedHashSet<>();
        for (DungeonFeatureTile tile : tiles) {
            DungeonSquare square = findSquareById(tile.squareId());
            if (square != null && square.roomId() != null) {
                names.add(titleOrFallback(square.roomName(), "Raum"));
            }
        }
        return List.copyOf(names);
    }

    private DungeonSquare squareAt(int x, int y) {
        if (state.currentState() == null) {
            return null;
        }
        for (DungeonSquare square : state.currentState().squares()) {
            if (square.x() == x && square.y() == y) {
                return square;
            }
        }
        return null;
    }

    private DungeonSquare findSquareById(long squareId) {
        if (state.currentState() == null) {
            return null;
        }
        for (DungeonSquare square : state.currentState().squares()) {
            if (square.squareId() != null && square.squareId() == squareId) {
                return square;
            }
        }
        return null;
    }

    private DungeonFeature findFeature(Long featureId) {
        if (featureId == null || state.currentState() == null) {
            return null;
        }
        for (DungeonFeature feature : state.currentState().features()) {
            if (featureId.equals(feature.featureId())) {
                return feature;
            }
        }
        return null;
    }

    private boolean passageTouchesRoom(DungeonPassage passage, Long roomId) {
        DungeonSquare primary = squareAt(passage.x(), passage.y());
        if (primary != null && roomId.equals(primary.roomId())) {
            return true;
        }
        DungeonSquare adjacent = switch (passage.direction()) {
            case EAST -> squareAt(passage.x() + 1, passage.y());
            case SOUTH -> squareAt(passage.x(), passage.y() + 1);
            case null -> null;
        };
        return adjacent != null && roomId.equals(adjacent.roomId());
    }

    private String resolveAreaName(Long areaId) {
        DungeonArea area = findById(state.currentState() == null ? List.<DungeonArea>of() : state.currentState().areas(),
                areaId,
                DungeonArea::areaId);
        return area == null ? null : area.name();
    }

    private String resolveEncounterTableName(Long encounterTableId) {
        DungeonEncounterTableSummary summary = findById(state.encounterTables(), encounterTableId, DungeonEncounterTableSummary::tableId);
        return summary == null ? null : summary.name();
    }

    private String resolveEncounterName(Long encounterId) {
        DungeonEncounterSummary summary = findById(state.encounters(), encounterId, DungeonEncounterSummary::encounterId);
        return summary == null ? null : summary.name();
    }

    private static <T> T findById(List<T> values, Long id, Function<T, Long> idExtractor) {
        return findById(values, id, idExtractor, null);
    }

    private static <T> T findById(List<T> values, Long id, Function<T, Long> idExtractor, T fallback) {
        if (values != null && id != null) {
            for (T value : values) {
                if (Objects.equals(idExtractor.apply(value), id)) {
                    return value;
                }
            }
        }
        return fallback;
    }

    private static String formatPosition(int x, int y) {
        return x + ", " + y;
    }

    private static String titleOrFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String valueOrDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}
