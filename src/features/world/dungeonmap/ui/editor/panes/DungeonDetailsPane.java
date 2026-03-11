package features.world.dungeonmap.ui.editor.panes;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonEndpointRole;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonPassage;
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
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

import java.util.List;
import java.util.function.Consumer;

public class DungeonDetailsPane extends VBox {

    public record RoomForm(Long roomId, String name, String description, Long areaId) {}
    public record AreaForm(Long areaId, String name, String description, Long encounterTableId) {}
    public record EndpointForm(Long endpointId, String name, String notes, DungeonEndpointRole role, boolean defaultEntry) {}
    public record LinkForm(Long linkId, String label) {}
    public record PassageForm(Long passageId, String name, String notes, PassageType type, Long endpointId) {}
    public record DeleteRequest(Long entityId, Node anchor) {}

    private Consumer<RoomForm> onRoomSaved;
    private Consumer<DeleteRequest> onRoomDeleted;
    private Consumer<AreaForm> onAreaSaved;
    private Consumer<DeleteRequest> onAreaDeleted;
    private Consumer<EndpointForm> onEndpointSaved;
    private Consumer<DeleteRequest> onEndpointDeleted;
    private Consumer<LinkForm> onLinkSaved;
    private Consumer<DeleteRequest> onLinkDeleted;
    private Consumer<PassageForm> onPassageSaved;
    private Consumer<DeleteRequest> onPassageDeleted;

    private List<DungeonArea> knownAreas = List.of();
    private List<DungeonEncounterTableSummary> knownEncounterTables = List.of();
    private List<DungeonEndpoint> knownEndpoints = List.of();

    public DungeonDetailsPane() {
        setSpacing(8);
        setPadding(new Insets(8));
        showSelection(DungeonSelection.none());
    }

    public void setAreas(List<DungeonArea> areas) {
        knownAreas = areas == null ? List.of() : List.copyOf(areas);
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
        Label msg = new Label(message);
        msg.getStyleClass().add("text-muted");
        msg.setWrapText(true);
        getChildren().addAll(header, msg);
    }

    public void showSelection(DungeonSelection selection) {
        getChildren().clear();
        Label header = new Label("DETAILS");
        header.getStyleClass().addAll("section-header", "text-muted");
        getChildren().add(header);

        if (selection == null || selection.type() == DungeonSelection.SelectionType.NONE) {
            getChildren().add(new Label("Nichts ausgewählt."));
            return;
        }

        switch (selection.type()) {
            case SQUARE -> renderSquare(selection.square());
            case ROOM -> renderRoom(selection.room());
            case AREA -> renderArea(selection.area());
            case ENDPOINT -> renderEndpoint(selection.endpoint());
            case LINK -> renderLink(selection.link());
            case PASSAGE -> renderPassage(selection.passage());
            default -> getChildren().add(new Label("Nichts ausgewählt."));
        }
    }

    private void renderSquare(DungeonSquare square) {
        if (square == null) {
            getChildren().add(new Label("Leeres Feld."));
            return;
        }
        Label coordLabel = new Label("Koordinate");
        coordLabel.getStyleClass().add("text-muted");
        Label roomLabel = new Label("Raum");
        roomLabel.getStyleClass().add("text-muted");
        Label areaLabel = new Label("Bereich");
        areaLabel.getStyleClass().add("text-muted");
        getChildren().addAll(
                coordLabel, new Label(square.x() + ", " + square.y()),
                roomLabel, new Label(valueOrDash(square.roomName())),
                areaLabel, new Label(valueOrDash(square.areaName())));
    }

    private void renderRoom(DungeonRoom room) {
        if (room == null) {
            getChildren().add(new Label("Kein Raum ausgewählt."));
            return;
        }
        TextField nameField = new TextField(room.name());
        TextArea descriptionArea = new TextArea(room.description() == null ? "" : room.description());
        ComboBox<DungeonArea> areaCombo = new ComboBox<>();
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
        deleteButton.setOnAction(event -> {
            if (onRoomDeleted != null) {
                onRoomDeleted.accept(new DeleteRequest(room.roomId(), deleteButton));
            }
        });
        appendLabeled("Name", nameField);
        appendLabeled("Beschreibung", descriptionArea);
        appendLabeled("Bereich", areaCombo);
        getChildren().addAll(saveButton, deleteButton);
    }

    private void renderArea(DungeonArea area) {
        if (area == null) {
            getChildren().add(new Label("Kein Bereich ausgewählt."));
            return;
        }
        TextField nameField = new TextField(area.name());
        TextArea descriptionArea = new TextArea(area.description() == null ? "" : area.description());
        ComboBox<DungeonEncounterTableSummary> encounterCombo = new ComboBox<>();
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
        deleteButton.setOnAction(event -> {
            if (onAreaDeleted != null) {
                onAreaDeleted.accept(new DeleteRequest(area.areaId(), deleteButton));
            }
        });
        appendLabeled("Name", nameField);
        appendLabeled("Beschreibung", descriptionArea);
        appendLabeled("Encounter Table", encounterCombo);
        getChildren().addAll(saveButton, deleteButton);
    }

    private void renderEndpoint(DungeonEndpoint endpoint) {
        if (endpoint == null) {
            getChildren().add(new Label("Kein Übergang ausgewählt."));
            return;
        }
        TextField nameField = new TextField(endpoint.name() == null ? "" : endpoint.name());
        TextArea notesArea = new TextArea(endpoint.notes() == null ? "" : endpoint.notes());
        ComboBox<DungeonEndpointRole> roleCombo = new ComboBox<>();
        roleCombo.getItems().setAll(DungeonEndpointRole.values());
        roleCombo.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonEndpointRole role) {
                if (role == null) {
                    return "";
                }
                return switch (role) {
                    case ENTRY -> "Eingang";
                    case EXIT -> "Ausgang";
                    case BOTH -> "Ein- und Ausgang";
                };
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
                onEndpointSaved.accept(new EndpointForm(
                        endpoint.endpointId(),
                        nameField.getText().trim(),
                        notesArea.getText(),
                        role,
                        defaultEntryCheckBox.isSelected() && role.allowsEntry()));
            }
        });
        Button deleteButton = new Button("Übergang löschen");
        deleteButton.setOnAction(event -> {
            if (onEndpointDeleted != null) {
                onEndpointDeleted.accept(new DeleteRequest(endpoint.endpointId(), deleteButton));
            }
        });
        Label posLabel = new Label("Position");
        posLabel.getStyleClass().add("text-muted");
        getChildren().addAll(posLabel, new Label(endpoint.x() + ", " + endpoint.y()));
        appendLabeled("Name", nameField);
        appendLabeled("Notizen", notesArea);
        appendLabeled("Typ", roleCombo);
        getChildren().add(defaultEntryCheckBox);
        getChildren().addAll(saveButton, deleteButton);
    }

    private void renderLink(DungeonLink link) {
        if (link == null) {
            getChildren().add(new Label("Kein Link ausgewählt."));
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
        deleteButton.setOnAction(event -> {
            if (onLinkDeleted != null) {
                onLinkDeleted.accept(new DeleteRequest(link.linkId(), deleteButton));
            }
        });
        Label connLabel = new Label("Verbindet");
        connLabel.getStyleClass().add("text-muted");
        String fromName = resolveEndpointName(link.fromEndpointId());
        String toName = resolveEndpointName(link.toEndpointId());
        getChildren().addAll(connLabel, new Label(fromName + " — " + toName));
        appendLabeled("Label", labelField);
        getChildren().addAll(saveButton, deleteButton);
    }

    private void renderPassage(DungeonPassage passage) {
        if (passage == null) {
            getChildren().add(new Label("Kein Durchgang ausgewählt."));
            return;
        }
        String edgeDesc;
        if (passage.direction() == PassageDirection.EAST) {
            edgeDesc = "(" + passage.x() + "," + passage.y() + ") → (" + (passage.x() + 1) + "," + passage.y() + ")";
        } else {
            edgeDesc = "(" + passage.x() + "," + passage.y() + ") → (" + passage.x() + "," + (passage.y() + 1) + ")";
        }
        TextField nameField = new TextField(passage.name() == null ? "" : passage.name());
        TextArea notesArea = new TextArea(passage.notes() == null ? "" : passage.notes());
        ComboBox<PassageType> typeCombo = new ComboBox<>();
        typeCombo.getItems().setAll(PassageType.values());
        typeCombo.setValue(passage.type() == null ? PassageType.DOOR : passage.type());
        ComboBox<DungeonEndpoint> endpointCombo = new ComboBox<>();
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
        Button saveButton = new Button("Durchgang speichern");
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
        Button deleteButton = new Button("Durchgang löschen");
        deleteButton.setOnAction(event -> {
            if (onPassageDeleted != null) {
                onPassageDeleted.accept(new DeleteRequest(passage.passageId(), deleteButton));
            }
        });
        Label edgeLabel = new Label("Kante");
        edgeLabel.getStyleClass().add("text-muted");
        getChildren().addAll(edgeLabel, new Label(edgeDesc));
        appendLabeled("Name", nameField);
        appendLabeled("Notizen", notesArea);
        appendLabeled("Typ", typeCombo);
        appendLabeled("Verknüpfter Übergang", endpointCombo);
        getChildren().addAll(saveButton, deleteButton);
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

    private void appendLabeled(String labelText, Node node) {
        Label label = new Label(labelText);
        label.getStyleClass().add("text-muted");
        getChildren().addAll(label, node);
        if (node instanceof TextArea textArea) {
            textArea.setPrefRowCount(4);
            VBox.setVgrow(textArea, Priority.NEVER);
        }
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
