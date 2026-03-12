package features.world.dungeonmap.ui.editor.panes;

import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.api.DungeonEncounterSummary;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonEndpointRole;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureCategory;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.PassageDirection;
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

import java.util.List;
import java.util.function.Consumer;

public class DungeonSelectionEditorPane extends VBox {

    public record RoomForm(Long roomId, String name, String description, Long areaId) {}
    public record AreaForm(Long areaId, String name, String description, Long encounterTableId) {}
    public record FeatureForm(Long featureId, DungeonFeatureCategory category, Long encounterId, String name, String notes) {}
    public record EndpointForm(Long endpointId, String name, String notes, DungeonEndpointRole role, boolean defaultEntry) {}
    public record LinkForm(Long linkId, String label) {}
    public record PassageForm(Long passageId, String name, String notes, Long endpointId) {}
    public record DeleteRequest(Long entityId, Node anchor) {}

    private Consumer<RoomForm> onRoomSaved;
    private Consumer<DeleteRequest> onRoomDeleted;
    private Consumer<AreaForm> onAreaSaved;
    private Consumer<DeleteRequest> onAreaDeleted;
    private Consumer<FeatureForm> onFeatureSaved;
    private Consumer<DeleteRequest> onFeatureDeleted;
    private Consumer<EndpointForm> onEndpointSaved;
    private Consumer<DeleteRequest> onEndpointDeleted;
    private Consumer<LinkForm> onLinkSaved;
    private Consumer<DeleteRequest> onLinkDeleted;
    private Consumer<PassageForm> onPassageSaved;
    private Consumer<DeleteRequest> onPassageDeleted;

    private List<DungeonArea> knownAreas = List.of();
    private List<DungeonEncounterTableSummary> knownEncounterTables = List.of();
    private List<DungeonEncounterSummary> knownEncounterSummaries = List.of();
    private List<DungeonEndpoint> knownEndpoints = List.of();

    public DungeonSelectionEditorPane() {
        getStyleClass().addAll("dungeon-sidebar-pane", "dungeon-selection-editor-pane");
        setSpacing(12);
        setPadding(new Insets(12));
        showSelection(DungeonSelection.none());
    }

    public void setAreas(List<DungeonArea> areas) {
        knownAreas = areas == null ? List.of() : List.copyOf(areas);
    }

    public void setEncounterTables(List<DungeonEncounterTableSummary> encounterTables) {
        knownEncounterTables = encounterTables == null ? List.of() : List.copyOf(encounterTables);
    }

    public void setEncounterSummaries(List<DungeonEncounterSummary> encounterSummaries) {
        knownEncounterSummaries = encounterSummaries == null ? List.of() : List.copyOf(encounterSummaries);
    }

    public void setEndpoints(List<DungeonEndpoint> endpoints) {
        knownEndpoints = endpoints == null ? List.of() : List.copyOf(endpoints);
    }

    public void showEditorMessage(String message) {
        resetContent();
        getChildren().add(infoCard("Editor-Hinweis", message));
    }

    public void showSelection(DungeonSelection selection) {
        resetContent();

        if (selection == null || selection.type() == DungeonSelection.SelectionType.NONE) {
            getChildren().add(infoCard("Nichts ausgewählt", "Wähle ein Feld oder eine Entität, um Bearbeitungsaktionen anzuzeigen."));
            return;
        }

        switch (selection.type()) {
            case SQUARE -> renderSquare(selection.square());
            case ROOM -> renderRoom(selection.room());
            case AREA -> renderArea(selection.area());
            case FEATURE -> renderFeature(selection.feature());
            case ENDPOINT -> renderEndpoint(selection.endpoint());
            case LINK -> renderLink(selection.link());
            case PASSAGE -> renderPassage(selection.passage());
            default -> getChildren().add(new Label("Nichts ausgewählt."));
        }
    }

    private void renderSquare(DungeonSquare square) {
        if (square == null) {
            getChildren().add(infoCard("Leeres Feld", "Noch kein Karteneintrag."));
            return;
        }
        getChildren().add(editorCard(
                "Feld " + square.x() + ", " + square.y()));
    }

    private void renderRoom(DungeonRoom room) {
        if (room == null) {
            getChildren().add(infoCard("Raum", "Keine Auswahl."));
            return;
        }
        TextField nameField = new TextField(room.name());
        TextArea descriptionArea = new TextArea(room.description() == null ? "" : room.description());
        ComboBox<DungeonArea> areaCombo = buildComboBox(knownAreas, room.areaId(), DungeonArea::areaId);
        Button saveButton = actionButton("Raum speichern", event -> {
            if (onRoomSaved != null) {
                onRoomSaved.accept(new RoomForm(
                        room.roomId(),
                        nameField.getText().trim(),
                        descriptionArea.getText(),
                        areaCombo.getValue() == null ? null : areaCombo.getValue().areaId()));
            }
        });
        Button deleteButton = new Button("Raum löschen");
        deleteButton.getStyleClass().add("danger");
        deleteButton.setOnAction(event -> {
            if (onRoomDeleted != null) {
                onRoomDeleted.accept(new DeleteRequest(room.roomId(), deleteButton));
            }
        });
        getChildren().add(editorCard(
                titleOrFallback(room.name(), "Unbenannter Raum"),
                labeledField("Name", nameField),
                labeledField("Beschreibung", descriptionArea),
                labeledField("Bereich", areaCombo),
                actionRow(saveButton, deleteButton)));
    }

    private void renderArea(DungeonArea area) {
        if (area == null) {
            getChildren().add(infoCard("Bereich", "Keine Auswahl."));
            return;
        }
        TextField nameField = new TextField(area.name());
        TextArea descriptionArea = new TextArea(area.description() == null ? "" : area.description());
        ComboBox<DungeonEncounterTableSummary> encounterCombo =
                buildComboBox(knownEncounterTables, area.encounterTableId(), DungeonEncounterTableSummary::tableId);
        Button saveButton = actionButton("Bereich speichern", event -> {
            if (onAreaSaved != null) {
                onAreaSaved.accept(new AreaForm(
                        area.areaId(),
                        nameField.getText().trim(),
                        descriptionArea.getText(),
                        encounterCombo.getValue() == null ? null : encounterCombo.getValue().tableId()));
            }
        });
        Button deleteButton = new Button("Bereich löschen");
        deleteButton.getStyleClass().add("danger");
        deleteButton.setOnAction(event -> {
            if (onAreaDeleted != null) {
                onAreaDeleted.accept(new DeleteRequest(area.areaId(), deleteButton));
            }
        });
        getChildren().add(editorCard(
                titleOrFallback(area.name(), "Unbenannter Bereich"),
                labeledField("Name", nameField),
                labeledField("Beschreibung", descriptionArea),
                labeledField("Encounter Table", encounterCombo),
                actionRow(saveButton, deleteButton)));
    }

    private void renderFeature(DungeonFeature feature) {
        if (feature == null) {
            getChildren().add(infoCard("Feature", "Keine Auswahl."));
            return;
        }
        TextField nameField = new TextField(feature.name() == null ? "" : feature.name());
        TextArea notesArea = new TextArea(feature.notes() == null ? "" : feature.notes());
        ComboBox<DungeonFeatureCategory> categoryCombo = new ComboBox<>();
        categoryCombo.setMaxWidth(Double.MAX_VALUE);
        categoryCombo.getItems().setAll(DungeonFeatureCategory.values());
        categoryCombo.setValue(feature.category() == null ? DungeonFeatureCategory.CURIOSITY : feature.category());
        ComboBox<DungeonEncounterSummary> encounterCombo =
                buildComboBox(knownEncounterSummaries, feature.encounterId(), DungeonEncounterSummary::encounterId);
        VBox encounterField = labeledField("Gebundenes Encounter", encounterCombo);
        updateEncounterFieldVisibility(encounterField, categoryCombo.getValue());
        categoryCombo.valueProperty().addListener((obs, oldValue, newValue) -> {
            updateEncounterFieldVisibility(encounterField, newValue);
            if (newValue != DungeonFeatureCategory.ENCOUNTER) {
                encounterCombo.setValue(null);
            }
        });
        Button saveButton = actionButton("Feature speichern", event -> {
            if (onFeatureSaved != null) {
                DungeonFeatureCategory category = categoryCombo.getValue() == null ? DungeonFeatureCategory.CURIOSITY : categoryCombo.getValue();
                onFeatureSaved.accept(new FeatureForm(
                        feature.featureId(),
                        category,
                        category == DungeonFeatureCategory.ENCOUNTER && encounterCombo.getValue() != null
                                ? encounterCombo.getValue().encounterId()
                                : null,
                        nameField.getText().trim(),
                        notesArea.getText()));
            }
        });
        Button deleteButton = new Button("Feature löschen");
        deleteButton.getStyleClass().add("danger");
        deleteButton.setOnAction(event -> {
            if (onFeatureDeleted != null) {
                onFeatureDeleted.accept(new DeleteRequest(feature.featureId(), deleteButton));
            }
        });
        getChildren().add(editorCard(
                titleOrFallback(feature.name(), feature.category().label()),
                labeledField("Kategorie", categoryCombo),
                encounterField,
                labeledField("Name", nameField),
                labeledField("Notizen", notesArea),
                actionRow(saveButton, deleteButton)));
    }

    private void renderEndpoint(DungeonEndpoint endpoint) {
        if (endpoint == null) {
            getChildren().add(infoCard("Übergang", "Keine Auswahl."));
            return;
        }
        TextField nameField = new TextField(endpoint.name() == null ? "" : endpoint.name());
        TextArea notesArea = new TextArea(endpoint.notes() == null ? "" : endpoint.notes());
        ComboBox<DungeonEndpointRole> roleCombo = new ComboBox<>();
        roleCombo.setMaxWidth(Double.MAX_VALUE);
        roleCombo.getItems().setAll(DungeonEndpointRole.values());
        roleCombo.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonEndpointRole role) {
                if (role == null) {
                    return "";
                }
                return endpointRoleLabel(role);
            }

            @Override
            public DungeonEndpointRole fromString(String string) {
                return null;
            }
        });
        roleCombo.setValue(endpoint.role() == null ? DungeonEndpointRole.BOTH : endpoint.role());
        CheckBox defaultEntryCheckBox = new CheckBox("Als Standard-Eingang verwenden");
        defaultEntryCheckBox.setSelected(endpoint.defaultEntry());
        roleCombo.valueProperty().addListener((obs, oldValue, newValue) -> {
            DungeonEndpointRole effectiveRole = newValue == null ? DungeonEndpointRole.BOTH : newValue;
            boolean entryAllowed = effectiveRole.allowsEntry();
            defaultEntryCheckBox.setDisable(!entryAllowed);
            if (!entryAllowed) {
                defaultEntryCheckBox.setSelected(false);
            }
        });
        DungeonEndpointRole initialRole = roleCombo.getValue() == null ? DungeonEndpointRole.BOTH : roleCombo.getValue();
        defaultEntryCheckBox.setDisable(!initialRole.allowsEntry());
        Button saveButton = actionButton("Übergang speichern", event -> {
            if (onEndpointSaved != null) {
                DungeonEndpointRole role = roleCombo.getValue() == null ? DungeonEndpointRole.BOTH : roleCombo.getValue();
                onEndpointSaved.accept(new EndpointForm(endpoint.endpointId(), nameField.getText().trim(), notesArea.getText(), role, defaultEntryCheckBox.isSelected() && role.allowsEntry()));
            }
        });
        Button deleteButton = new Button("Übergang löschen");
        deleteButton.getStyleClass().add("danger");
        deleteButton.setOnAction(event -> {
            if (onEndpointDeleted != null) {
                onEndpointDeleted.accept(new DeleteRequest(endpoint.endpointId(), deleteButton));
            }
        });
        getChildren().add(editorCard(titleOrFallback(endpoint.name(), "Unbenannter Übergang"),
                labeledField("Name", nameField),
                labeledField("Notizen", notesArea),
                labeledField("Typ", roleCombo),
                defaultEntryCheckBox,
                actionRow(saveButton, deleteButton)));
    }

    private void renderLink(DungeonLink link) {
        if (link == null) {
            getChildren().add(infoCard("Link", "Keine Auswahl."));
            return;
        }
        TextField labelField = new TextField(link.label() == null ? "" : link.label());
        Button saveButton = actionButton("Link speichern", event -> {
            if (onLinkSaved != null) {
                onLinkSaved.accept(new LinkForm(link.linkId(), labelField.getText().trim()));
            }
        });
        Button deleteButton = new Button("Link löschen");
        deleteButton.getStyleClass().add("danger");
        deleteButton.setOnAction(event -> {
            if (onLinkDeleted != null) {
                onLinkDeleted.accept(new DeleteRequest(link.linkId(), deleteButton));
            }
        });
        String fromName = resolveEndpointName(link.fromEndpointId());
        String toName = resolveEndpointName(link.toEndpointId());
        getChildren().add(editorCard(
                fromName + " -> " + toName,
                labeledField("Label", labelField),
                actionRow(saveButton, deleteButton)));
    }

    private void renderPassage(DungeonPassage passage) {
        if (passage == null) {
            getChildren().add(infoCard("Kante", "Keine Auswahl."));
            return;
        }
        String edgeDesc = passage.direction() == PassageDirection.EAST
                ? "(" + passage.x() + "," + passage.y() + ") → (" + (passage.x() + 1) + "," + passage.y() + ")"
                : "(" + passage.x() + "," + passage.y() + ") → (" + passage.x() + "," + (passage.y() + 1) + ")";
        TextField nameField = new TextField(passage.name() == null ? "" : passage.name());
        TextArea notesArea = new TextArea(passage.notes() == null ? "" : passage.notes());
        ComboBox<DungeonEndpoint> endpointCombo = buildComboBox(knownEndpoints, passage.endpointId(), DungeonEndpoint::endpointId);
        endpointCombo.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonEndpoint endpoint) {
                if (endpoint == null) {
                    return "Kein Übergang";
                }
                String name = endpoint.name();
                return (name != null && !name.isBlank()) ? name : "Übergang #" + endpoint.endpointId();
            }

            @Override
            public DungeonEndpoint fromString(String string) {
                return null;
            }
        });
        Button saveButton = actionButton("Kante speichern", event -> {
            if (onPassageSaved != null) {
                onPassageSaved.accept(new PassageForm(
                        passage.passageId(),
                        nameField.getText().trim(),
                        notesArea.getText(),
                        endpointCombo.getValue() == null ? null : endpointCombo.getValue().endpointId()));
            }
        });
        Button deleteButton = new Button("Geschlossene Wand wiederherstellen");
        deleteButton.getStyleClass().add("danger");
        deleteButton.setOnAction(event -> {
            if (onPassageDeleted != null) {
                onPassageDeleted.accept(new DeleteRequest(passage.passageId(), deleteButton));
            }
        });
        getChildren().add(editorCard(titleOrFallback(passage.name(), "Unbenannte Kante"),
                labeledField("Verknüpfter Übergang", endpointCombo),
                labeledField("Name", nameField),
                labeledField("Notizen", notesArea),
                actionRow(saveButton, deleteButton)));
    }

    private String resolveEndpointName(long endpointId) {
        for (DungeonEndpoint endpoint : knownEndpoints) {
            if (endpointId == endpoint.endpointId()) {
                String name = endpoint.name();
                return (name != null && !name.isBlank()) ? name : "Übergang #" + endpointId;
            }
        }
        return "Übergang #" + endpointId;
    }

    private VBox labeledField(String labelText, Node node) {
        Label label = new Label(labelText);
        label.getStyleClass().add("text-muted");
        VBox box = new VBox(4, label, node);
        if (node instanceof TextArea textArea) {
            textArea.setPrefRowCount(4);
            VBox.setVgrow(textArea, Priority.NEVER);
        }
        return box;
    }

    private VBox editorCard(String headline, Node... details) {
        Label headlineLabel = new Label(headline);
        headlineLabel.getStyleClass().add("dungeon-panel-title");
        headlineLabel.setWrapText(true);
        VBox box = new VBox(6);
        box.getStyleClass().add("dungeon-editor-card");
        box.getChildren().add(headlineLabel);
        box.getChildren().addAll(details);
        return box;
    }

    private VBox infoCard(String title, String body) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("dungeon-panel-title");
        Label bodyLabel = new Label(body);
        bodyLabel.getStyleClass().add("text-secondary");
        bodyLabel.setWrapText(true);
        VBox box = new VBox(6, titleLabel, bodyLabel);
        box.getStyleClass().add("dungeon-editor-card");
        return box;
    }

    private HBox actionRow(Button saveButton, Button deleteButton) {
        HBox row = new HBox(8, saveButton, deleteButton);
        row.getStyleClass().add("editor-action-row");
        return row;
    }

    private void resetContent() {
        getChildren().clear();
        Label header = new Label("BEARBEITEN");
        header.getStyleClass().addAll("section-header", "text-muted");
        getChildren().add(header);
    }

    private Button actionButton(String text, javafx.event.EventHandler<javafx.event.ActionEvent> handler) {
        Button button = new Button(text);
        button.setOnAction(handler);
        return button;
    }

    private <T> ComboBox<T> buildComboBox(List<T> items, Long selectedId, java.util.function.Function<T, Long> idGetter) {
        ComboBox<T> comboBox = new ComboBox<>();
        comboBox.setMaxWidth(Double.MAX_VALUE);
        comboBox.getItems().setAll(items == null ? List.of() : items);
        if (selectedId != null) {
            for (T item : comboBox.getItems()) {
                Long itemId = idGetter.apply(item);
                if (selectedId.equals(itemId)) {
                    comboBox.setValue(item);
                    break;
                }
            }
        }
        return comboBox;
    }

    private static void updateEncounterFieldVisibility(Node node, DungeonFeatureCategory category) {
        boolean visible = category == DungeonFeatureCategory.ENCOUNTER;
        node.setVisible(visible);
        node.setManaged(visible);
    }

    private String resolveAreaName(Long areaId) {
        if (areaId == null) {
            return "-";
        }
        for (DungeonArea area : knownAreas) {
            if (areaId.equals(area.areaId())) {
                return valueOrDash(area.name());
            }
        }
        return "-";
    }

    private String resolveOptionalEndpointName(Long endpointId) {
        if (endpointId == null) {
            return "-";
        }
        return resolveEndpointName(endpointId);
    }

    private String resolveEncounterTableName(Long encounterTableId) {
        if (encounterTableId == null) {
            return null;
        }
        for (DungeonEncounterTableSummary table : knownEncounterTables) {
            if (encounterTableId.equals(table.tableId())) {
                return table.name();
            }
        }
        return null;
    }

    private String resolveEncounterName(Long encounterId) {
        if (encounterId == null) {
            return null;
        }
        for (DungeonEncounterSummary encounter : knownEncounterSummaries) {
            if (encounterId.equals(encounter.encounterId())) {
                return encounter.name();
            }
        }
        return null;
    }

    private String endpointRoleLabel(DungeonEndpointRole role) {
        DungeonEndpointRole effectiveRole = role == null ? DungeonEndpointRole.BOTH : role;
        return switch (effectiveRole) {
            case ENTRY -> "Eingang";
            case EXIT -> "Ausgang";
            case BOTH -> "Ein- und Ausgang";
        };
    }

    private String titleOrFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String valueOrDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    public void setOnRoomSaved(Consumer<RoomForm> onRoomSaved) {
        this.onRoomSaved = onRoomSaved;
    }

    public void setOnRoomDeleted(Consumer<DeleteRequest> onRoomDeleted) {
        this.onRoomDeleted = onRoomDeleted;
    }

    public void setOnAreaSaved(Consumer<AreaForm> onAreaSaved) {
        this.onAreaSaved = onAreaSaved;
    }

    public void setOnAreaDeleted(Consumer<DeleteRequest> onAreaDeleted) {
        this.onAreaDeleted = onAreaDeleted;
    }

    public void setOnFeatureSaved(Consumer<FeatureForm> onFeatureSaved) {
        this.onFeatureSaved = onFeatureSaved;
    }

    public void setOnFeatureDeleted(Consumer<DeleteRequest> onFeatureDeleted) {
        this.onFeatureDeleted = onFeatureDeleted;
    }

    public void setOnEndpointSaved(Consumer<EndpointForm> onEndpointSaved) {
        this.onEndpointSaved = onEndpointSaved;
    }

    public void setOnEndpointDeleted(Consumer<DeleteRequest> onEndpointDeleted) {
        this.onEndpointDeleted = onEndpointDeleted;
    }

    public void setOnLinkSaved(Consumer<LinkForm> onLinkSaved) {
        this.onLinkSaved = onLinkSaved;
    }

    public void setOnLinkDeleted(Consumer<DeleteRequest> onLinkDeleted) {
        this.onLinkDeleted = onLinkDeleted;
    }

    public void setOnPassageSaved(Consumer<PassageForm> onPassageSaved) {
        this.onPassageSaved = onPassageSaved;
    }

    public void setOnPassageDeleted(Consumer<DeleteRequest> onPassageDeleted) {
        this.onPassageDeleted = onPassageDeleted;
    }

}
