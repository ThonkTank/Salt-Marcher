package features.world.dungeonmap.ui.editor.panes;

import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.model.BrushShape;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.control.SpinnerValueFactory;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;

public class DungeonToolSettingsPane extends VBox {

    private final ComboBox<DungeonRoom> roomCombo = new ComboBox<>();
    private final ComboBox<DungeonArea> areaCombo = new ComboBox<>();
    private final ComboBox<DungeonEncounterTableSummary> encounterTableCombo = new ComboBox<>();
    private final CheckBox linksVisible = new CheckBox("Links anzeigen");
    private final CheckBox endpointsVisible = new CheckBox("Übergänge anzeigen");
    private final Button newRoomButton = new Button("Raum neu");
    private final Button deleteRoomButton = new Button("Raum löschen");
    private final Button newAreaButton = new Button("Bereich neu");
    private final Button deleteAreaButton = new Button("Bereich löschen");

    private final Spinner<Integer> brushSizeSpinner = new Spinner<>(new SpinnerValueFactory.IntegerSpinnerValueFactory(1, 5, 1));
    private final ToggleGroup shapeGroup = new ToggleGroup();
    private final ToggleButton squareShapeBtn = new ToggleButton("\u25a1 Viereck");
    private final ToggleButton circleShapeBtn = new ToggleButton("\u25cb Kreis");
    private final ToggleButton diamondShapeBtn = new ToggleButton("\u25c7 Raute");

    private final VBox roomGroup;
    private final VBox brushGroup;
    private final VBox areaGroup;
    private final VBox visibilityGroup;
    private final VBox linkStatusGroup;
    private final Label activeToolLabel = new Label("Auswahl");
    private final Label activeToolHintLabel = new Label("Wähle ein Feld, einen Raum oder einen Übergang aus, um Details zu bearbeiten.");
    private final Label linkStatusLabel = new Label("Ersten Übergang klicken, dann zweiten Übergang klicken.");
    private final Button cancelLinkButton = new Button("Abbrechen");

    private boolean updatingSelections = false;
    private Consumer<DungeonRoom> onRoomSelected;
    private Consumer<DungeonArea> onAreaSelected;
    private Runnable onCancelLink;

    public DungeonToolSettingsPane() {
        getStyleClass().addAll("dungeon-sidebar-pane", "dungeon-tool-settings-pane");
        setSpacing(12);
        setPadding(new Insets(12));

        Label header = new Label("EINSTELLUNGEN");
        header.getStyleClass().addAll("section-header", "text-muted");
        activeToolLabel.getStyleClass().add("dungeon-panel-title");
        activeToolHintLabel.getStyleClass().add("text-secondary");
        activeToolHintLabel.setWrapText(true);

        roomCombo.setPromptText("Raum wählen…");
        areaCombo.setPromptText("Bereich wählen…");
        encounterTableCombo.setPromptText("Encounter Table…");
        roomCombo.setMaxWidth(Double.MAX_VALUE);
        areaCombo.setMaxWidth(Double.MAX_VALUE);
        encounterTableCombo.setMaxWidth(Double.MAX_VALUE);
        linksVisible.setSelected(true);
        endpointsVisible.setSelected(true);
        deleteRoomButton.getStyleClass().add("danger");
        deleteAreaButton.getStyleClass().add("danger");

        roomCombo.setOnAction(event -> {
            if (!updatingSelections && onRoomSelected != null) {
                onRoomSelected.accept(roomCombo.getValue());
            }
        });
        areaCombo.setOnAction(event -> {
            if (!updatingSelections && onAreaSelected != null) {
                onAreaSelected.accept(areaCombo.getValue());
            }
        });
        cancelLinkButton.setOnAction(event -> {
            if (onCancelLink != null) {
                onCancelLink.run();
            }
        });

        squareShapeBtn.setToggleGroup(shapeGroup);
        squareShapeBtn.setUserData(BrushShape.SQUARE);
        squareShapeBtn.setSelected(true);
        circleShapeBtn.setToggleGroup(shapeGroup);
        circleShapeBtn.setUserData(BrushShape.CIRCLE);
        diamondShapeBtn.setToggleGroup(shapeGroup);
        diamondShapeBtn.setUserData(BrushShape.DIAMOND);
        shapeGroup.selectedToggleProperty().addListener((obs, oldToggle, newToggle) -> {
            if (newToggle == null) oldToggle.setSelected(true);
        });

        Label roomLabel = new Label("Aktiver Raum");
        roomLabel.getStyleClass().add("text-muted");
        Label roomHint = helperLabel("Lege den Raum fest, den das Malwerkzeug auf neue oder bestehende Felder schreibt.");
        HBox roomActions = actionRow(newRoomButton, deleteRoomButton);
        roomGroup = card("Raumzuweisung", roomHint, new VBox(6, roomLabel, roomCombo, roomActions));

        brushSizeSpinner.setPrefWidth(70);
        brushSizeSpinner.setEditable(false);
        Label brushLabel = new Label("Pinselgröße");
        brushLabel.getStyleClass().add("text-muted");
        HBox brushRow = new HBox(6, brushLabel, brushSizeSpinner);
        brushRow.setAlignment(Pos.CENTER_LEFT);
        HBox shapeRow = new HBox(4, squareShapeBtn, circleShapeBtn, diamondShapeBtn);
        Label brushHint = helperLabel("Größe und Form bestimmen, welche Felder beim Ziehen gleichzeitig geändert werden.");
        brushGroup = card("Pinsel", brushHint, new VBox(8, brushRow, shapeRow));

        Label areaLabel = new Label("Aktiver Bereich");
        areaLabel.getStyleClass().add("text-muted");
        Label tableLabel = new Label("Encounter Table");
        tableLabel.getStyleClass().add("text-muted");
        Label areaHint = helperLabel("Ordne Räume einem Bereich zu und verknüpfe optional eine Encounter Table.");
        HBox areaActions = actionRow(newAreaButton, deleteAreaButton);
        areaGroup = card("Bereich", areaHint, new VBox(6, areaLabel, areaCombo, areaActions, tableLabel, encounterTableCombo));

        Label visibilityHint = helperLabel("Schalte Orientierungshilfen auf der Karte ein oder aus, ohne Daten zu verändern.");
        visibilityGroup = card("Anzeige", visibilityHint, new VBox(6, linksVisible, endpointsVisible));

        linkStatusLabel.getStyleClass().add("text-muted");
        Label linkHint = helperLabel("Ein Link verbindet zwei Übergänge. Der Startpunkt bleibt markiert, bis du den zweiten Übergang auswählst.");
        cancelLinkButton.getStyleClass().add("compact");
        linkStatusGroup = card("Link erstellen", linkHint, new VBox(6, linkStatusLabel, cancelLinkButton));
        linkStatusGroup.setVisible(false);
        linkStatusGroup.setManaged(false);

        VBox overviewCard = card("Aktives Werkzeug", activeToolHintLabel, activeToolLabel);
        getChildren().addAll(
                header,
                overviewCard,
                roomGroup,
                brushGroup,
                areaGroup,
                visibilityGroup,
                linkStatusGroup);

        // start with no tool-specific groups visible
        setGroupVisible(roomGroup, false);
        setGroupVisible(brushGroup, false);
        setGroupVisible(areaGroup, false);
        setMapLoaded(false);
    }

    public void setActiveTool(DungeonEditorTool tool) {
        DungeonEditorTool effectiveTool = tool == null ? DungeonEditorTool.SELECT : tool;
        activeToolLabel.setText(toolTitle(effectiveTool));
        activeToolHintLabel.setText(toolHint(effectiveTool));
        setGroupVisible(roomGroup, effectiveTool.roomSettingsVisible());
        setGroupVisible(brushGroup, effectiveTool.brushSettingsVisible());
        setGroupVisible(areaGroup, effectiveTool.areaSettingsVisible());
        if (effectiveTool.linkStatusVisible()) {
            linkStatusLabel.setText("Ersten Übergang klicken, dann zweiten Übergang klicken.");
            setGroupVisible(linkStatusGroup, true);
            cancelLinkButton.setVisible(false);
            cancelLinkButton.setManaged(false);
        } else {
            setGroupVisible(linkStatusGroup, false);
        }
    }

    public void showLinkPending(boolean pending) {
        if (pending) {
            linkStatusLabel.setText("Startübergang gewählt - zweiten Übergang klicken");
            setGroupVisible(linkStatusGroup, true);
            cancelLinkButton.setVisible(true);
            cancelLinkButton.setManaged(true);
        } else {
            setGroupVisible(linkStatusGroup, false);
        }
    }

    public int getBrushSize() {
        return brushSizeSpinner.getValue();
    }

    public BrushShape getBrushShape() {
        Toggle selected = shapeGroup.getSelectedToggle();
        return selected != null ? (BrushShape) selected.getUserData() : BrushShape.SQUARE;
    }

    public void setMapLoaded(boolean loaded) {
        newRoomButton.setDisable(!loaded);
        newAreaButton.setDisable(!loaded);
    }

    public Long getActiveRoomId() {
        return roomCombo.getValue() == null ? null : roomCombo.getValue().roomId();
    }

    public Long getActiveAreaId() {
        return areaCombo.getValue() == null ? null : areaCombo.getValue().areaId();
    }

    public DungeonEncounterTableSummary getSelectedEncounterTable() {
        return encounterTableCombo.getValue();
    }

    public void setRooms(List<DungeonRoom> rooms) {
        updatingSelections = true;
        DungeonRoom previous = roomCombo.getValue();
        roomCombo.getItems().setAll(rooms);
        if (previous != null) {
            for (DungeonRoom room : rooms) {
                if (room.roomId().equals(previous.roomId())) {
                    roomCombo.setValue(room);
                    updatingSelections = false;
                    return;
                }
            }
        }
        roomCombo.setValue(rooms.isEmpty() ? null : rooms.get(0));
        updatingSelections = false;
    }

    public void setAreas(List<DungeonArea> areas) {
        updatingSelections = true;
        DungeonArea previous = areaCombo.getValue();
        areaCombo.getItems().setAll(areas);
        if (previous != null) {
            for (DungeonArea area : areas) {
                if (area.areaId().equals(previous.areaId())) {
                    areaCombo.setValue(area);
                    updatingSelections = false;
                    return;
                }
            }
        }
        areaCombo.setValue(areas.isEmpty() ? null : areas.get(0));
        updatingSelections = false;
    }

    public void setEncounterTables(List<DungeonEncounterTableSummary> tables) {
        encounterTableCombo.getItems().setAll(tables);
    }

    public void selectRoom(Long roomId) {
        updatingSelections = true;
        if (roomId == null) {
            roomCombo.setValue(null);
            updatingSelections = false;
            return;
        }
        for (DungeonRoom room : roomCombo.getItems()) {
            if (roomId.equals(room.roomId())) {
                roomCombo.setValue(room);
                updatingSelections = false;
                return;
            }
        }
        updatingSelections = false;
    }

    public void selectArea(Long areaId) {
        updatingSelections = true;
        if (areaId == null) {
            areaCombo.setValue(null);
            updatingSelections = false;
            return;
        }
        for (DungeonArea area : areaCombo.getItems()) {
            if (areaId.equals(area.areaId())) {
                areaCombo.setValue(area);
                updatingSelections = false;
                return;
            }
        }
        updatingSelections = false;
    }

    public void selectEncounterTable(Long tableId) {
        if (tableId == null) {
            encounterTableCombo.setValue(null);
            return;
        }
        for (DungeonEncounterTableSummary table : encounterTableCombo.getItems()) {
            if (table.tableId() == tableId) {
                encounterTableCombo.setValue(table);
                return;
            }
        }
    }

    public ComboBox<DungeonRoom> roomComboBox() {
        return roomCombo;
    }

    public ComboBox<DungeonArea> areaComboBox() {
        return areaCombo;
    }

    public ComboBox<DungeonEncounterTableSummary> encounterTableComboBox() {
        return encounterTableCombo;
    }

    public CheckBox linksVisibleCheckBox() {
        return linksVisible;
    }

    public CheckBox endpointsVisibleCheckBox() {
        return endpointsVisible;
    }

    public Button newRoomButton() {
        return newRoomButton;
    }

    public Button deleteRoomButton() {
        return deleteRoomButton;
    }

    public Button newAreaButton() {
        return newAreaButton;
    }

    public Button deleteAreaButton() {
        return deleteAreaButton;
    }

    public void setOnRoomSelected(Consumer<DungeonRoom> onRoomSelected) {
        this.onRoomSelected = onRoomSelected;
    }

    public void setOnAreaSelected(Consumer<DungeonArea> onAreaSelected) {
        this.onAreaSelected = onAreaSelected;
    }

    public void setOnCancelLink(Runnable onCancelLink) {
        this.onCancelLink = onCancelLink;
    }

    private static VBox card(String title, Label hint, javafx.scene.Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("dungeon-panel-title");
        VBox box = new VBox(8);
        box.getStyleClass().add("dungeon-editor-card");
        box.getChildren().addAll(titleLabel, hint);
        box.getChildren().addAll(content);
        return box;
    }

    private static Label helperLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-secondary");
        label.setWrapText(true);
        return label;
    }

    private static HBox actionRow(Button primary, Button secondary) {
        primary.getStyleClass().add("compact");
        secondary.getStyleClass().add("compact");
        HBox row = new HBox(8, primary, secondary);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private static String toolTitle(DungeonEditorTool tool) {
        DungeonEditorTool effectiveTool = tool == null ? DungeonEditorTool.SELECT : tool;
        return switch (effectiveTool) {
            case SELECT -> "Auswahl";
            case PAINT -> "Raum malen";
            case ERASE -> "Raum löschen";
            case AREA_ASSIGN -> "Bereich zuweisen";
            case PASSAGE -> "Wände und Kanten";
            case ENDPOINT -> "Übergänge";
            case LINK -> "Links";
        };
    }

    private static String toolHint(DungeonEditorTool tool) {
        DungeonEditorTool effectiveTool = tool == null ? DungeonEditorTool.SELECT : tool;
        return switch (effectiveTool) {
            case SELECT -> "Wähle ein Feld, einen Raum, einen Bereich oder eine Verbindung aus, um die Details rechts zu bearbeiten.";
            case PAINT -> "Male Felder in den aktiven Raum. Pinselgröße und Form steuern die Ausdehnung des Malstrichs.";
            case ERASE -> "Entferne Raumzuweisungen von Feldern. Die Form des Pinsels bestimmt, wie breit gelöscht wird.";
            case AREA_ASSIGN -> "Klicke auf ein Feld mit Raum, um den aktiven Bereich diesem Raum zuzuweisen.";
            case PASSAGE -> "Klicke auf Kanten zwischen Feldern, um Wände zu öffnen, Kantentypen zu ändern oder die geschlossene Wand wiederherzustellen.";
            case ENDPOINT -> "Klicke auf ein Feld, um dort einen Übergang zu erstellen oder einen vorhandenen Übergang auszuwählen.";
            case LINK -> "Wähle zwei Übergänge nacheinander aus, um einen Link zwischen ihnen zu erstellen.";
        };
    }

    private static void setGroupVisible(VBox group, boolean visible) {
        group.setVisible(visible);
        group.setManaged(visible);
    }
}
