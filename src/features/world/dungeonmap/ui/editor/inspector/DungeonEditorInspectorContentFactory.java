package features.world.dungeonmap.ui.editor.inspector;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonAreaEncounterTableLink;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureCategory;
import features.world.dungeonmap.model.DungeonFeatureTile;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonLinkAnchorType;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.index.DungeonMapIndex;
import features.world.dungeonmap.service.catalog.DungeonEncounterSummary;
import features.world.dungeonmap.ui.DungeonAreaEncounterText;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.workflow.editing.DungeonConnectionEditingController;
import features.world.dungeonmap.ui.editor.workflow.editing.DungeonEntityCrudController;
import javafx.scene.Node;
import javafx.scene.control.ComboBox;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DungeonEditorInspectorContentFactory {

    private final DungeonEditorState state;
    private final DungeonEntityCrudController entityCrudController;
    private final DungeonConnectionEditingController connectionEditingController;
    private final DungeonConnectionInspectorSectionBuilder connectionSectionBuilder;

    public DungeonEditorInspectorContentFactory(
            DungeonEditorState state,
            DungeonEntityCrudController entityCrudController,
            DungeonConnectionEditingController connectionEditingController
    ) {
        this.state = state;
        this.entityCrudController = entityCrudController;
        this.connectionEditingController = connectionEditingController;
        this.connectionSectionBuilder = new DungeonConnectionInspectorSectionBuilder(state, connectionEditingController);
    }

    public Node buildRoomCard(DungeonRoom room) {
        VBox box = DungeonInspectorCards.card();
        if (room == null) {
            box.getChildren().add(DungeonInspectorCards.secondary("Raum nicht gefunden."));
            return box;
        }

        TextField nameField = new TextField(room.name() == null ? "" : room.name());
        TextArea descriptionArea = DungeonInspectorCards.textArea(room.description());
        var saveButton = DungeonInspectorCards.saveButton(() -> entityCrudController.updateRoomMetadata(new DungeonRoom(
                room.roomId(),
                room.mapId(),
                nameField.getText().trim(),
                descriptionArea.getText(),
                room.areaId())));

        List<DungeonSquare> roomSquares = roomSquares(room.roomId());
        box.getChildren().addAll(
                DungeonInspectorCards.secondary("Bereich: " + DungeonInspectorCards.valueOrDash(resolveAreaName(room.areaId()))),
                DungeonInspectorCards.secondary("Felder: " + roomSquares.size()),
                DungeonInspectorCards.section("Name", nameField, DungeonInspectorCards.saveRow(saveButton)),
                DungeonInspectorCards.section("Beschreibung", descriptionArea));
        DungeonInspectorCards.appendListSection(box, "Features", describeRoomFeatures(room.roomId()));
        appendRoomEndpointSection(box, room.roomId());
        appendRoomPassageSection(box, room.roomId());
        return box;
    }

    public Node buildAreaCard(DungeonArea area) {
        VBox box = DungeonInspectorCards.card();
        if (area == null) {
            box.getChildren().add(DungeonInspectorCards.secondary("Bereich nicht gefunden."));
            return box;
        }

        List<DungeonRoom> rooms = roomsForArea(area.areaId());
        box.getChildren().addAll(
                DungeonInspectorCards.secondary("Name: " + DungeonInspectorCards.valueOrDash(area.name())),
                DungeonInspectorCards.secondary("Encounter-Rhythmus: " + DungeonAreaEncounterText.formatCadence(area.encounterEveryHours())),
                DungeonInspectorCards.secondary("Räume: " + rooms.size()));
        DungeonInspectorCards.appendListSection(box, "Encounter-Tabellen", describeEncounterTables(area.encounterTableLinks()));
        DungeonInspectorCards.appendListSection(box, "Räume", describeRooms(rooms));
        return box;
    }

    public Node buildFeatureCard(DungeonFeature feature) {
        VBox box = DungeonInspectorCards.card();
        if (feature == null) {
            box.getChildren().add(DungeonInspectorCards.secondary("Feature nicht gefunden."));
            return box;
        }

        TextField nameField = new TextField(feature.name() == null ? "" : feature.name());
        TextArea notesArea = DungeonInspectorCards.textArea(feature.notes());
        ComboBox<DungeonFeatureCategory> categoryCombo = new ComboBox<>();
        categoryCombo.setMaxWidth(Double.MAX_VALUE);
        categoryCombo.getItems().setAll(DungeonFeatureCategory.values());
        categoryCombo.setConverter(DungeonInspectorCards.namedConverter(DungeonFeatureCategory::label));
        categoryCombo.setValue(feature.category() == null ? DungeonFeatureCategory.CURIOSITY : feature.category());
        ComboBox<DungeonEncounterSummary> encounterCombo = new ComboBox<>();
        encounterCombo.setMaxWidth(Double.MAX_VALUE);
        encounterCombo.setConverter(DungeonInspectorCards.namedConverter(DungeonEncounterSummary::name));
        encounterCombo.getItems().setAll(state.encounters());
        encounterCombo.setValue(DungeonInspectorCards.findById(state.encounters(), feature.encounterId(), DungeonEncounterSummary::encounterId));
        DungeonInspectorCards.updateEncounterComboState(encounterCombo, categoryCombo.getValue());
        categoryCombo.valueProperty().addListener((obs, oldValue, newValue) -> DungeonInspectorCards.updateEncounterComboState(encounterCombo, newValue));
        var saveButton = DungeonInspectorCards.saveButton(() -> {
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
                DungeonInspectorCards.secondary("Kategorie: " + DungeonInspectorCards.valueOrDash(feature.category() == null ? null : feature.category().label())),
                DungeonInspectorCards.secondary("Encounter: " + DungeonInspectorCards.valueOrDash(resolveEncounterName(feature.encounterId()))),
                DungeonInspectorCards.secondary("Felder: " + tiles.size()),
                DungeonInspectorCards.section("Name", nameField),
                DungeonInspectorCards.section("Kategorie", categoryCombo),
                DungeonInspectorCards.section("Encounter", encounterCombo),
                DungeonInspectorCards.section("Notizen", notesArea, DungeonInspectorCards.saveRow(saveButton)));
        DungeonInspectorCards.appendListSection(box, "Positionen", describeFeatureTiles(tiles));
        DungeonInspectorCards.appendListSection(box, "Räume", describeFeatureRooms(tiles));
        return box;
    }

    public Node buildEndpointCard(DungeonEndpoint endpoint) {
        VBox box = DungeonInspectorCards.card();
        if (endpoint == null) {
            box.getChildren().add(DungeonInspectorCards.secondary("Übergang nicht gefunden."));
            return box;
        }
        box.getChildren().add(connectionSectionBuilder.buildEndpointEditor(endpoint));
        appendEndpointLinks(box, endpoint);
        return box;
    }

    public Node buildPassageCard(DungeonPassage passage) {
        VBox box = DungeonInspectorCards.card();
        if (passage == null) {
            box.getChildren().add(DungeonInspectorCards.secondary("Durchgang nicht gefunden."));
            return box;
        }
        box.getChildren().add(connectionSectionBuilder.buildPassageEditor(passage));
        appendPassageLinks(box, passage);
        return box;
    }

    public Node buildLinkCard(DungeonLink link) {
        VBox box = DungeonInspectorCards.card();
        if (link == null) {
            box.getChildren().add(DungeonInspectorCards.secondary("Link nicht gefunden."));
            return box;
        }
        box.getChildren().addAll(
                DungeonInspectorCards.secondary("Von: " + resolveAnchorName(link.fromAnchor())),
                DungeonInspectorCards.secondary("Nach: " + resolveAnchorName(link.toAnchor())),
                connectionSectionBuilder.buildLinkEditor(link, link.fromAnchor(), resolveLinkCounterpartName(link, link.fromAnchor())));
        return box;
    }

    private void appendRoomEndpointSection(VBox parent, Long roomId) {
        List<DungeonEndpoint> endpoints = roomEndpoints(roomId);
        if (endpoints.isEmpty()) {
            return;
        }
        VBox content = new VBox(8);
        for (DungeonEndpoint endpoint : endpoints) {
            content.getChildren().add(connectionSectionBuilder.buildEndpointEditor(endpoint));
        }
        parent.getChildren().add(DungeonInspectorCards.section("Übergänge", content));
    }

    private void appendRoomPassageSection(VBox parent, Long roomId) {
        List<DungeonPassage> passages = roomPassages(roomId);
        if (passages.isEmpty()) {
            return;
        }
        VBox content = new VBox(8);
        for (DungeonPassage passage : passages) {
            content.getChildren().add(connectionSectionBuilder.buildPassageEditor(passage));
        }
        parent.getChildren().add(DungeonInspectorCards.section("Durchgänge", content));
    }

    private void appendEndpointLinks(VBox parent, DungeonEndpoint endpoint) {
        List<DungeonLink> links = linksForEndpoint(endpoint.endpointId());
        if (links.isEmpty()) {
            return;
        }
        VBox content = new VBox(6);
        DungeonLinkAnchor anchor = DungeonLinkAnchor.endpoint(endpoint.endpointId());
        for (DungeonLink link : links) {
            content.getChildren().add(connectionSectionBuilder.buildLinkEditor(link, anchor, resolveLinkCounterpartName(link, anchor)));
        }
        parent.getChildren().add(DungeonInspectorCards.section("Links", content));
    }

    private void appendPassageLinks(VBox parent, DungeonPassage passage) {
        List<DungeonLink> links = linksForPassage(passage.passageId());
        if (links.isEmpty()) {
            return;
        }
        VBox content = new VBox(6);
        DungeonLinkAnchor anchor = DungeonLinkAnchor.passage(passage.passageId());
        for (DungeonLink link : links) {
            content.getChildren().add(connectionSectionBuilder.buildLinkEditor(link, anchor, resolveLinkCounterpartName(link, anchor)));
        }
        parent.getChildren().add(DungeonInspectorCards.section("Links", content));
    }

    private List<DungeonSquare> roomSquares(Long roomId) {
        return currentIndex().squaresForRoom(roomId);
    }

    private List<DungeonRoom> roomsForArea(Long areaId) {
        return currentIndex().roomsForArea(areaId);
    }

    private List<DungeonFeatureTile> featureTiles(Long featureId) {
        return currentIndex().featureTilesForFeature(featureId);
    }

    private List<DungeonEndpoint> roomEndpoints(Long roomId) {
        return currentIndex().endpointsForRoom(roomId);
    }

    private List<DungeonPassage> roomPassages(Long roomId) {
        return currentIndex().passagesForRoom(roomId);
    }

    private List<DungeonLink> linksForEndpoint(Long endpointId) {
        return linksForAnchor(endpointId == null ? null : DungeonLinkAnchor.endpoint(endpointId));
    }

    private List<DungeonLink> linksForPassage(Long passageId) {
        return linksForAnchor(passageId == null ? null : DungeonLinkAnchor.passage(passageId));
    }

    private List<DungeonLink> linksForAnchor(DungeonLinkAnchor anchor) {
        return currentIndex().linksForAnchor(anchor);
    }

    private List<String> describeRoomFeatures(Long roomId) {
        if (roomId == null) {
            return List.of();
        }
        Map<Long, List<String>> positionsByFeature = new LinkedHashMap<>();
        for (DungeonSquare roomSquare : roomSquares(roomId)) {
            for (DungeonFeature feature : currentIndex().featuresAtSquare(roomSquare.squareId())) {
                if (feature.featureId() == null) {
                    continue;
                }
                for (DungeonFeatureTile tile : featureTiles(feature.featureId())) {
                    if (tile.squareId() != roomSquare.squareId().longValue()) {
                        continue;
                    }
                    positionsByFeature.computeIfAbsent(feature.featureId(), ignored -> new ArrayList<>())
                            .add(DungeonInspectorCards.formatPosition(tile.x(), tile.y()));
                }
            }
        }
        List<String> lines = new ArrayList<>();
        for (Map.Entry<Long, List<String>> entry : positionsByFeature.entrySet()) {
            DungeonFeature feature = currentIndex().findFeature(entry.getKey());
            lines.add(DungeonInspectorCards.titleOrFallback(feature == null ? null : feature.toString(), "Feature")
                    + " (" + String.join(", ", entry.getValue()) + ")");
        }
        return lines;
    }

    private List<String> describeRooms(List<DungeonRoom> rooms) {
        List<String> lines = new ArrayList<>();
        for (DungeonRoom room : rooms) {
            lines.add(DungeonInspectorCards.titleOrFallback(room.name(), "Raum") + " (" + roomSquares(room.roomId()).size() + " Felder)");
        }
        return lines;
    }

    private List<String> describeFeatureTiles(List<DungeonFeatureTile> tiles) {
        List<String> lines = new ArrayList<>();
        for (DungeonFeatureTile tile : tiles) {
            DungeonSquare square = currentIndex().findSquare(tile.squareId());
            String roomName = square == null ? null : square.roomName();
            lines.add(DungeonInspectorCards.formatPosition(tile.x(), tile.y())
                    + (roomName == null || roomName.isBlank() ? "" : " • " + roomName));
        }
        return lines;
    }

    private List<String> describeFeatureRooms(List<DungeonFeatureTile> tiles) {
        LinkedHashSet<String> names = new LinkedHashSet<>();
        for (DungeonFeatureTile tile : tiles) {
            DungeonSquare square = currentIndex().findSquare(tile.squareId());
            if (square != null && square.roomName() != null && !square.roomName().isBlank()) {
                names.add(square.roomName());
            }
        }
        return List.copyOf(names);
    }

    private List<String> describeEncounterTables(List<DungeonAreaEncounterTableLink> links) {
        List<String> lines = new ArrayList<>();
        for (DungeonAreaEncounterTableLink link : links == null ? List.<DungeonAreaEncounterTableLink>of() : links) {
            String tableName = "Encounter Table #" + link.tableId();
            lines.add(tableName + " • Gewicht " + link.weight());
        }
        return lines;
    }

    private String resolveAreaName(Long areaId) {
        DungeonArea area = currentIndex().findArea(areaId);
        return area == null ? null : area.name();
    }

    private String resolveEncounterName(Long encounterId) {
        DungeonEncounterSummary encounter = DungeonInspectorCards.findById(state.encounters(), encounterId, DungeonEncounterSummary::encounterId);
        return encounter == null ? null : encounter.name();
    }

    private String resolveLinkCounterpartName(DungeonLink link, DungeonLinkAnchor currentAnchor) {
        DungeonLinkAnchor counterpart = Objects.equals(link.fromAnchor(), currentAnchor) ? link.toAnchor() : link.fromAnchor();
        return resolveAnchorName(counterpart);
    }

    private String resolveAnchorName(DungeonLinkAnchor anchor) {
        if (anchor == null) {
            return "-";
        }
        return switch (anchor.type()) {
            case ENDPOINT -> {
                DungeonEndpoint endpoint = currentIndex().findEndpoint(anchor.anchorId());
                yield endpoint == null
                        ? "Übergang #" + anchor.anchorId()
                        : DungeonInspectorCards.titleOrFallback(endpoint.name(), "Übergang #" + anchor.anchorId());
            }
            case PASSAGE -> {
                DungeonPassage passage = currentIndex().findPassage(anchor.anchorId());
                yield passage == null
                        ? "Durchgang #" + anchor.anchorId()
                        : DungeonInspectorCards.titleOrFallback(passage.name(), "Durchgang") + " • "
                        + DungeonInspectorCards.formatPassagePosition(passage);
            }
        };
    }

    private DungeonMapIndex currentIndex() {
        return state.currentState() == null ? DungeonMapIndex.empty() : state.currentState().index();
    }
}
