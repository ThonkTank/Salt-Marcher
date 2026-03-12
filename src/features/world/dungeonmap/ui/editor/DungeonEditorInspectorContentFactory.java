package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonEncounterSummary;
import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonEndpointRole;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureCategory;
import features.world.dungeonmap.model.DungeonFeatureTile;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
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

public final class DungeonEditorInspectorContentFactory {

    private final DungeonEditorState state;
    private final DungeonEntityCrudController entityCrudController;
    private final DungeonConnectionEditingController connectionEditingController;

    public DungeonEditorInspectorContentFactory(
            DungeonEditorState state,
            DungeonEntityCrudController entityCrudController,
            DungeonConnectionEditingController connectionEditingController
    ) {
        this.state = state;
        this.entityCrudController = entityCrudController;
        this.connectionEditingController = connectionEditingController;
    }

    public Node buildRoomCard(DungeonRoom room) {
        VBox box = card();
        if (room == null) {
            box.getChildren().add(secondary("Raum nicht gefunden."));
            return box;
        }

        TextField nameField = new TextField(room.name() == null ? "" : room.name());
        TextArea descriptionArea = textArea(room.description());
        Button saveButton = saveButton(() -> entityCrudController.updateRoomMetadata(new DungeonRoom(
                room.roomId(),
                room.mapId(),
                nameField.getText().trim(),
                descriptionArea.getText(),
                room.areaId())));

        List<DungeonSquare> roomSquares = roomSquares(room.roomId());
        box.getChildren().addAll(
                secondary("Bereich: " + valueOrDash(resolveAreaName(room.areaId()))),
                secondary("Felder: " + roomSquares.size()),
                section("Name", nameField, saveRow(saveButton)),
                section("Beschreibung", descriptionArea));
        appendListSection(box, "Features", describeRoomFeatures(room.roomId()));
        appendRoomEndpointSection(box, room.roomId());
        appendRoomPassageSection(box, room.roomId());
        return box;
    }

    public Node buildAreaCard(DungeonArea area) {
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

    public Node buildFeatureCard(DungeonFeature feature) {
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

    private void appendRoomEndpointSection(VBox parent, Long roomId) {
        List<DungeonEndpoint> endpoints = roomEndpoints(roomId);
        if (endpoints.isEmpty()) {
            return;
        }
        VBox content = new VBox(8);
        for (DungeonEndpoint endpoint : endpoints) {
            content.getChildren().add(buildEndpointEditor(endpoint));
        }
        parent.getChildren().add(section("Übergänge", content));
    }

    private void appendRoomPassageSection(VBox parent, Long roomId) {
        List<DungeonPassage> passages = roomPassages(roomId);
        if (passages.isEmpty()) {
            return;
        }
        VBox content = new VBox(8);
        for (DungeonPassage passage : passages) {
            content.getChildren().add(buildPassageEditor(passage));
        }
        parent.getChildren().add(section("Durchgänge", content));
    }

    private VBox buildEndpointEditor(DungeonEndpoint endpoint) {
        VBox box = editorCard();
        TextField nameField = new TextField(endpoint.name() == null ? "" : endpoint.name());
        TextArea notesArea = compactTextArea(endpoint.notes());
        ComboBox<DungeonEndpointRole> roleCombo = new ComboBox<>();
        roleCombo.setMaxWidth(Double.MAX_VALUE);
        roleCombo.getItems().setAll(DungeonEndpointRole.values());
        roleCombo.setConverter(namedConverter(this::endpointRoleLabel));
        roleCombo.setValue(endpoint.role() == null ? DungeonEndpointRole.BOTH : endpoint.role());
        CheckBox defaultEntryCheckBox = new CheckBox("Standard-Eingang");
        defaultEntryCheckBox.setSelected(endpoint.defaultEntry());
        updateDefaultEntryState(defaultEntryCheckBox, roleCombo.getValue());
        roleCombo.valueProperty().addListener((obs, oldValue, newValue) -> updateDefaultEntryState(defaultEntryCheckBox, newValue));

        Button saveButton = saveButton(() -> {
            DungeonEndpointRole selectedRole = roleCombo.getValue() == null ? DungeonEndpointRole.BOTH : roleCombo.getValue();
            connectionEditingController.saveEndpoint(new DungeonEndpoint(
                    endpoint.endpointId(),
                    endpoint.mapId(),
                    endpoint.squareId(),
                    nameField.getText().trim(),
                    notesArea.getText(),
                    selectedRole,
                    defaultEntryCheckBox.isSelected() && selectedRole.allowsEntry(),
                    endpoint.x(),
                    endpoint.y()));
        });
        Button deleteButton = dangerButton("Löschen");
        deleteButton.setOnAction(event -> connectionEditingController.deleteEndpoint(endpoint.endpointId(), deleteButton));

        box.getChildren().addAll(
                secondary(titleOrFallback(endpoint.name(), "Übergang") + " • " + formatPosition(endpoint.x(), endpoint.y())),
                section("Name", nameField),
                section("Notizen", notesArea),
                section("Typ", roleCombo, defaultEntryCheckBox, saveRow(saveButton, deleteButton)));
        appendEndpointLinks(box, endpoint);
        return box;
    }

    private void appendEndpointLinks(VBox parent, DungeonEndpoint endpoint) {
        List<DungeonLink> links = linksForEndpoint(endpoint.endpointId());
        if (links.isEmpty()) {
            return;
        }
        VBox content = new VBox(6);
        for (DungeonLink link : links) {
            content.getChildren().add(buildLinkEditor(link, endpoint.endpointId()));
        }
        parent.getChildren().add(section("Links", content));
    }

    private VBox buildLinkEditor(DungeonLink link, Long endpointId) {
        VBox box = new VBox(6);
        TextField labelField = new TextField(link.label() == null ? "" : link.label());
        Button saveButton = saveButton(() -> {
            if (link.linkId() != null) {
                connectionEditingController.updateLinkLabel(link.linkId(), labelField.getText().trim(), null);
            }
        });
        Button deleteButton = dangerButton("Löschen");
        deleteButton.setOnAction(event -> connectionEditingController.deleteLink(link.linkId()));
        box.getChildren().addAll(
                secondary(resolveLinkCounterpartName(link, endpointId)),
                section("Label", labelField, saveRow(saveButton, deleteButton)));
        return box;
    }

    private VBox buildPassageEditor(DungeonPassage passage) {
        VBox box = editorCard();
        TextField nameField = new TextField(passage.name() == null ? "" : passage.name());
        TextArea notesArea = compactTextArea(passage.notes());
        ComboBox<DungeonEndpoint> endpointCombo = new ComboBox<>();
        endpointCombo.setMaxWidth(Double.MAX_VALUE);
        endpointCombo.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonEndpoint endpoint) {
                return endpoint == null ? "Kein Übergang" : titleOrFallback(endpoint.name(), "Übergang");
            }

            @Override
            public DungeonEndpoint fromString(String string) {
                return null;
            }
        });
        endpointCombo.getItems().setAll(state.currentState() == null ? List.of() : state.currentState().endpoints());
        endpointCombo.setValue(findById(
                state.currentState() == null ? List.<DungeonEndpoint>of() : state.currentState().endpoints(),
                passage.endpointId(),
                DungeonEndpoint::endpointId));

        Button saveButton = saveButton(() -> connectionEditingController.savePassage(new DungeonPassage(
                passage.passageId(),
                passage.mapId(),
                passage.x(),
                passage.y(),
                passage.direction(),
                nameField.getText().trim(),
                notesArea.getText(),
                endpointCombo.getValue() == null ? null : endpointCombo.getValue().endpointId())));
        Button deleteButton = dangerButton("Zurücksetzen");
        deleteButton.setOnAction(event -> connectionEditingController.deletePassage(passage.passageId(), deleteButton));

        box.getChildren().addAll(
                secondary(titleOrFallback(passage.name(), "Durchgang") + " • " + formatPassagePosition(passage)),
                section("Übergang", endpointCombo),
                section("Name", nameField),
                section("Notizen", notesArea, saveRow(saveButton, deleteButton)));
        return box;
    }

    private static VBox card() {
        VBox box = new VBox(10);
        box.setPadding(new Insets(12));
        return box;
    }

    private static VBox editorCard() {
        VBox box = new VBox(8);
        box.getStyleClass().add("dungeon-editor-card");
        box.setPadding(new Insets(10));
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

    private static TextArea compactTextArea(String value) {
        TextArea area = textArea(value);
        area.setPrefRowCount(3);
        return area;
    }

    private static Button saveButton(Runnable onSave) {
        Button button = new Button("Speichern");
        button.setOnAction(event -> onSave.run());
        return button;
    }

    private static Button dangerButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("danger");
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

    private List<DungeonEndpoint> roomEndpoints(Long roomId) {
        List<DungeonEndpoint> result = new ArrayList<>();
        if (roomId == null || state.currentState() == null) {
            return result;
        }
        for (DungeonEndpoint endpoint : state.currentState().endpoints()) {
            DungeonSquare square = squareAt(endpoint.x(), endpoint.y());
            if (square != null && roomId.equals(square.roomId())) {
                result.add(endpoint);
            }
        }
        return result;
    }

    private List<DungeonPassage> roomPassages(Long roomId) {
        List<DungeonPassage> result = new ArrayList<>();
        if (roomId == null || state.currentState() == null) {
            return result;
        }
        for (DungeonPassage passage : state.currentState().passages()) {
            if (passageTouchesRoom(passage, roomId)) {
                result.add(passage);
            }
        }
        return result;
    }

    private List<DungeonLink> linksForEndpoint(Long endpointId) {
        List<DungeonLink> result = new ArrayList<>();
        if (endpointId == null || state.currentState() == null) {
            return result;
        }
        for (DungeonLink link : state.currentState().links()) {
            if (endpointId.equals(link.fromEndpointId()) || endpointId.equals(link.toEndpointId())) {
                result.add(link);
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

    private DungeonEndpoint findEndpoint(Long endpointId) {
        if (endpointId == null || state.currentState() == null) {
            return null;
        }
        for (DungeonEndpoint endpoint : state.currentState().endpoints()) {
            if (endpointId.equals(endpoint.endpointId())) {
                return endpoint;
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
        DungeonArea area = findById(
                state.currentState() == null ? List.<DungeonArea>of() : state.currentState().areas(),
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

    private String resolveLinkCounterpartName(DungeonLink link, Long endpointId) {
        Long counterpartId = Objects.equals(endpointId, link.fromEndpointId()) ? link.toEndpointId() : link.fromEndpointId();
        DungeonEndpoint counterpart = findEndpoint(counterpartId);
        String name = counterpart == null ? "Unbekannter Übergang" : titleOrFallback(counterpart.name(), "Übergang");
        String notes = link.notes();
        return notes == null || notes.isBlank() ? name : name + " • " + notes;
    }

    private String formatPassagePosition(DungeonPassage passage) {
        return switch (passage.direction()) {
            case EAST -> formatPosition(passage.x(), passage.y()) + " -> " + formatPosition(passage.x() + 1, passage.y());
            case SOUTH -> formatPosition(passage.x(), passage.y()) + " -> " + formatPosition(passage.x(), passage.y() + 1);
        };
    }

    private void updateDefaultEntryState(CheckBox checkBox, DungeonEndpointRole role) {
        DungeonEndpointRole effectiveRole = role == null ? DungeonEndpointRole.BOTH : role;
        boolean entryAllowed = effectiveRole.allowsEntry();
        checkBox.setDisable(!entryAllowed);
        if (!entryAllowed) {
            checkBox.setSelected(false);
        }
    }

    private String endpointRoleLabel(DungeonEndpointRole role) {
        DungeonEndpointRole effectiveRole = role == null ? DungeonEndpointRole.BOTH : role;
        return switch (effectiveRole) {
            case ENTRY -> "Eingang";
            case EXIT -> "Ausgang";
            case BOTH -> "Ein- und Ausgang";
        };
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
