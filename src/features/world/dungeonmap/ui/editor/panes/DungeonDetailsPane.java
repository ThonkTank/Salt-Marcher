package features.world.dungeonmap.ui.editor.panes;

import features.world.dungeonmap.api.DungeonEncounterTableSummary;
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
import features.world.dungeonmap.model.PassageType;
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

public class DungeonDetailsPane extends VBox {

    public record RoomForm(Long roomId, String name, String description, Long areaId) {}
    public record AreaForm(Long areaId, String name, String description, Long encounterTableId) {}
    public record FeatureForm(Long featureId, DungeonFeatureCategory category, String name, String notes) {}
    public record EndpointForm(Long endpointId, String name, String notes, DungeonEndpointRole role, boolean defaultEntry) {}
    public record LinkForm(Long linkId, String label) {}
    public record PassageForm(Long passageId, String name, String notes, PassageType type, Long endpointId) {}
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
    private List<DungeonFeature> knownFeatures = List.of();
    private List<DungeonEndpoint> knownEndpoints = List.of();

    public DungeonDetailsPane() {
        getStyleClass().addAll("dungeon-sidebar-pane", "dungeon-details-pane");
        setSpacing(12);
        setPadding(new Insets(12));
        showSelection(DungeonSelection.none());
    }

    public void setAreas(List<DungeonArea> areas) {
        knownAreas = areas == null ? List.of() : List.copyOf(areas);
    }

    public void setFeatures(List<DungeonFeature> features) {
        knownFeatures = features == null ? List.of() : List.copyOf(features);
    }

    public void setEncounterTables(List<DungeonEncounterTableSummary> encounterTables) {
        knownEncounterTables = encounterTables == null ? List.of() : List.copyOf(encounterTables);
    }

    public void setEndpoints(List<DungeonEndpoint> endpoints) {
        knownEndpoints = endpoints == null ? List.of() : List.copyOf(endpoints);
    }

    public void showInfoMessage(String message) {
        getChildren().clear();
        Label header = new Label("DETAILS");
        header.getStyleClass().addAll("section-header", "text-muted");
        getChildren().addAll(header, infoCard("Hinweis", message));
    }

    public void showSelection(DungeonSelection selection) {
        getChildren().clear();
        Label header = new Label("DETAILS");
        header.getStyleClass().addAll("section-header", "text-muted");
        getChildren().add(header);

        if (selection == null || selection.type() == DungeonSelection.SelectionType.NONE) {
            getChildren().add(infoCard("Nichts ausgewählt", "Wähle ein Feld, einen Raum, einen Bereich, ein Feature oder eine Verbindung auf der Karte aus."));
            return;
        }

        switch (selection.type()) {
            case SQUARE -> renderSquare(selection.square(), selection.tileFeatures());
            case ROOM -> renderRoom(selection.room());
            case AREA -> renderArea(selection.area());
            case FEATURE -> renderFeature(selection.feature());
            case ENDPOINT -> renderEndpoint(selection.endpoint());
            case LINK -> renderLink(selection.link());
            case PASSAGE -> renderPassage(selection.passage());
            default -> getChildren().add(new Label("Nichts ausgewählt."));
        }
    }

    private void renderSquare(DungeonSquare square, List<DungeonFeature> tileFeatures) {
        if (square == null) {
            getChildren().add(infoCard("Leeres Feld", "Dieses Feld existiert noch nicht als bearbeiteter Karteneintrag."));
            return;
        }
        VBox featureBox = new VBox(4);
        if (tileFeatures == null || tileFeatures.isEmpty()) {
            featureBox.getChildren().add(kvRow("Features", "-"));
        } else {
            featureBox.getChildren().add(kvRow("Features", Integer.toString(tileFeatures.size())));
            for (DungeonFeature feature : tileFeatures) {
                featureBox.getChildren().add(kvRow(feature.category().label(), valueOrDash(feature.name())));
            }
        }
        getChildren().add(summaryCard(
                "Feld",
                "Position " + square.x() + ", " + square.y(),
                kvRow("Raum", valueOrDash(square.roomName())),
                kvRow("Bereich", valueOrDash(square.areaName())),
                featureBox));
    }

    private void renderRoom(DungeonRoom room) {
        if (room == null) {
            getChildren().add(infoCard("Kein Raum ausgewählt", "Wähle einen Raum auf der Karte oder in den Werkzeugeinstellungen aus."));
            return;
        }
        TextField nameField = new TextField(room.name());
        TextArea descriptionArea = new TextArea(room.description() == null ? "" : room.description());
        ComboBox<DungeonArea> areaCombo = new ComboBox<>();
        areaCombo.setMaxWidth(Double.MAX_VALUE);
        areaCombo.getItems().setAll(knownAreas);
        for (DungeonArea area : knownAreas) {
            if (room.areaId() != null && room.areaId().equals(area.areaId())) {
                areaCombo.setValue(area);
                break;
            }
        }
        Button saveButton = new Button("Raum speichern");
        saveButton.setOnAction(event -> {
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
        getChildren().add(summaryCard("Raum", titleOrFallback(room.name(), "Unbenannter Raum"), kvRow("Bereich", resolveAreaName(room.areaId()))));
        getChildren().add(formCard("Raum bearbeiten", "Namen, Beschreibung und Bereich dieses Raums anpassen.",
                labeledField("Name", nameField), labeledField("Beschreibung", descriptionArea), labeledField("Bereich", areaCombo), actionRow(saveButton, deleteButton)));
    }

    private void renderArea(DungeonArea area) {
        if (area == null) {
            getChildren().add(infoCard("Kein Bereich ausgewählt", "Wähle einen Bereich auf der Karte oder in den Werkzeugeinstellungen aus."));
            return;
        }
        TextField nameField = new TextField(area.name());
        TextArea descriptionArea = new TextArea(area.description() == null ? "" : area.description());
        ComboBox<DungeonEncounterTableSummary> encounterCombo = new ComboBox<>();
        encounterCombo.setMaxWidth(Double.MAX_VALUE);
        encounterCombo.getItems().setAll(knownEncounterTables);
        for (DungeonEncounterTableSummary table : knownEncounterTables) {
            if (area.encounterTableId() != null && area.encounterTableId().equals(table.tableId())) {
                encounterCombo.setValue(table);
                break;
            }
        }
        Button saveButton = new Button("Bereich speichern");
        saveButton.setOnAction(event -> {
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
        getChildren().add(summaryCard("Bereich", titleOrFallback(area.name(), "Unbenannter Bereich"), kvRow("Encounter Table", valueOrDash(area.encounterTableName()))));
        getChildren().add(formCard("Bereich bearbeiten", "Bereiche fassen mehrere Räume zusammen und können eine Encounter Table mitführen.",
                labeledField("Name", nameField), labeledField("Beschreibung", descriptionArea), labeledField("Encounter Table", encounterCombo), actionRow(saveButton, deleteButton)));
    }

    private void renderFeature(DungeonFeature feature) {
        if (feature == null) {
            getChildren().add(infoCard("Kein Feature ausgewählt", "Wähle ein Feature auf einem Feld oder in den Werkzeugeinstellungen aus."));
            return;
        }
        TextField nameField = new TextField(feature.name() == null ? "" : feature.name());
        TextArea notesArea = new TextArea(feature.notes() == null ? "" : feature.notes());
        ComboBox<DungeonFeatureCategory> categoryCombo = new ComboBox<>();
        categoryCombo.setMaxWidth(Double.MAX_VALUE);
        categoryCombo.getItems().setAll(DungeonFeatureCategory.values());
        categoryCombo.setValue(feature.category() == null ? DungeonFeatureCategory.CURIOSITY : feature.category());
        Button saveButton = new Button("Feature speichern");
        saveButton.setOnAction(event -> {
            if (onFeatureSaved != null) {
                onFeatureSaved.accept(new FeatureForm(
                        feature.featureId(),
                        categoryCombo.getValue() == null ? DungeonFeatureCategory.CURIOSITY : categoryCombo.getValue(),
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
        getChildren().add(summaryCard("Feature", titleOrFallback(feature.name(), feature.category().label()), kvRow("Kategorie", feature.category().label())));
        getChildren().add(formCard("Feature bearbeiten", "Verwalte Kategorie, Namen und Notizen. Die Feldzuordnung erfolgt im Feature-Werkzeug.",
                labeledField("Kategorie", categoryCombo), labeledField("Name", nameField), labeledField("Notizen", notesArea), actionRow(saveButton, deleteButton)));
    }

    private void renderEndpoint(DungeonEndpoint endpoint) {
        if (endpoint == null) {
            getChildren().add(infoCard("Kein Übergang ausgewählt", "Wähle einen Übergang auf der Karte aus."));
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
        Button saveButton = new Button("Übergang speichern");
        saveButton.setOnAction(event -> {
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
        getChildren().add(summaryCard("Übergang", titleOrFallback(endpoint.name(), "Unbenannter Übergang"),
                kvRow("Position", endpoint.x() + ", " + endpoint.y()),
                kvRow("Typ", endpointRoleLabel(endpoint.role())),
                kvRow("Standard-Einstieg", endpoint.defaultEntry() ? "Ja" : "Nein")));
        getChildren().add(formCard("Übergang bearbeiten", "Übergänge verbinden die Karte mit Passagen und Links.",
                labeledField("Name", nameField), labeledField("Notizen", notesArea), labeledField("Typ", roleCombo), defaultEntryCheckBox, actionRow(saveButton, deleteButton)));
    }

    private void renderLink(DungeonLink link) {
        if (link == null) {
            getChildren().add(infoCard("Kein Link ausgewählt", "Wähle einen Link zwischen zwei Übergängen aus."));
            return;
        }
        TextField labelField = new TextField(link.label() == null ? "" : link.label());
        Button saveButton = new Button("Link speichern");
        saveButton.setOnAction(event -> {
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
        getChildren().add(summaryCard("Link", fromName + " -> " + toName, kvRow("Von", fromName), kvRow("Nach", toName)));
        getChildren().add(formCard("Link bearbeiten", "Links erzeugen gerichtete Verbindungen zwischen zwei Übergängen.",
                labeledField("Label", labelField), actionRow(saveButton, deleteButton)));
    }

    private void renderPassage(DungeonPassage passage) {
        if (passage == null) {
            getChildren().add(infoCard("Keine Kante ausgewählt", "Wähle eine Kante auf der Karte aus, um ihren Wand- oder Durchgangszustand zu bearbeiten."));
            return;
        }
        String edgeDesc = passage.direction() == PassageDirection.EAST
                ? "(" + passage.x() + "," + passage.y() + ") → (" + (passage.x() + 1) + "," + passage.y() + ")"
                : "(" + passage.x() + "," + passage.y() + ") → (" + passage.x() + "," + (passage.y() + 1) + ")";
        TextField nameField = new TextField(passage.name() == null ? "" : passage.name());
        TextArea notesArea = new TextArea(passage.notes() == null ? "" : passage.notes());
        ComboBox<PassageType> typeCombo = new ComboBox<>();
        typeCombo.setMaxWidth(Double.MAX_VALUE);
        typeCombo.getItems().setAll(PassageType.values());
        typeCombo.setValue(passage.type() == null ? PassageType.OPEN : passage.type());
        ComboBox<DungeonEndpoint> endpointCombo = new ComboBox<>();
        endpointCombo.setMaxWidth(Double.MAX_VALUE);
        endpointCombo.getItems().setAll(knownEndpoints);
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
        if (passage.endpointId() != null) {
            for (DungeonEndpoint endpoint : knownEndpoints) {
                if (passage.endpointId().equals(endpoint.endpointId())) {
                    endpointCombo.setValue(endpoint);
                    break;
                }
            }
        }
        Button saveButton = new Button("Kante speichern");
        saveButton.setOnAction(event -> {
            if (onPassageSaved != null) {
                onPassageSaved.accept(new PassageForm(
                        passage.passageId(),
                        nameField.getText().trim(),
                        notesArea.getText(),
                        typeCombo.getValue() == null ? PassageType.DOOR : typeCombo.getValue(),
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
        getChildren().add(summaryCard("Kante", titleOrFallback(passage.name(), "Unbenannte Kante"),
                kvRow("Kante", edgeDesc),
                kvRow("Typ", passage.type() == null ? PassageType.OPEN.toString() : passage.type().toString()),
                kvRow("Verknüpfter Übergang", resolveOptionalEndpointName(passage.endpointId()))));
        getChildren().add(formCard("Kante bearbeiten", "Lege fest, ob die Kante eine geschlossene Wand, ein offener Durchgang, eine Tür, ein Fenster, ein Loch oder eine Geheimtür ist. Das Löschen stellt die normale geschlossene Wand wieder her.",
                labeledField("Name", nameField), labeledField("Notizen", notesArea), labeledField("Typ", typeCombo), labeledField("Verknüpfter Übergang", endpointCombo), actionRow(saveButton, deleteButton)));
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

    private VBox summaryCard(String kind, String headline, Node... details) {
        Label kindLabel = new Label(kind.toUpperCase());
        kindLabel.getStyleClass().addAll("section-header", "text-muted");
        Label headlineLabel = new Label(headline);
        headlineLabel.getStyleClass().add("dungeon-panel-title");
        headlineLabel.setWrapText(true);
        VBox box = new VBox(8);
        box.getStyleClass().add("dungeon-editor-card");
        box.getChildren().addAll(kindLabel, headlineLabel);
        box.getChildren().addAll(details);
        return box;
    }

    private VBox formCard(String title, String hint, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("dungeon-panel-title");
        Label hintLabel = new Label(hint);
        hintLabel.getStyleClass().add("text-secondary");
        hintLabel.setWrapText(true);
        VBox box = new VBox(8);
        box.getStyleClass().add("dungeon-editor-card");
        box.getChildren().addAll(titleLabel, hintLabel);
        box.getChildren().addAll(content);
        return box;
    }

    private VBox infoCard(String title, String body) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("dungeon-panel-title");
        Label bodyLabel = new Label(body);
        bodyLabel.getStyleClass().add("text-secondary");
        bodyLabel.setWrapText(true);
        VBox box = new VBox(8, titleLabel, bodyLabel);
        box.getStyleClass().add("dungeon-editor-card");
        return box;
    }

    private HBox kvRow(String labelText, String valueText) {
        Label label = new Label(labelText);
        label.getStyleClass().add("text-muted");
        Label value = new Label(valueText);
        value.getStyleClass().add("text-secondary");
        value.setWrapText(true);
        HBox row = new HBox(8, label, value);
        row.getStyleClass().add("dungeon-meta-row");
        HBox.setHgrow(value, Priority.ALWAYS);
        return row;
    }

    private HBox actionRow(Button saveButton, Button deleteButton) {
        return new HBox(8, saveButton, deleteButton);
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
