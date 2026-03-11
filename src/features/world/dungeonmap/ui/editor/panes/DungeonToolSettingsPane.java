package features.world.dungeonmap.ui.editor.panes;

import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.model.BrushShape;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import javafx.geometry.Insets;
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
import ui.components.ThemeColors;

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
    private final Label linkStatusLabel = new Label("Ersten Übergang klicken, dann zweiten Übergang klicken.");
    private final Button cancelLinkButton = new Button("Abbrechen");

    private boolean updatingSelections = false;
    private Consumer<DungeonRoom> onRoomSelected;
    private Consumer<DungeonArea> onAreaSelected;
    private Runnable onCancelLink;

    public DungeonToolSettingsPane() {
        setSpacing(8);
        setPadding(new Insets(8));

        Label header = new Label("EINSTELLUNGEN");
        header.getStyleClass().addAll("section-header", "text-muted");

        roomCombo.setPromptText("Raum wählen…");
        areaCombo.setPromptText("Bereich wählen…");
        encounterTableCombo.setPromptText("Encounter Table…");
        linksVisible.setSelected(true);
        endpointsVisible.setSelected(true);

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
        roomGroup = new VBox(4, roomLabel, roomCombo, newRoomButton, deleteRoomButton);

        brushSizeSpinner.setPrefWidth(70);
        brushSizeSpinner.setEditable(false);
        Label brushLabel = new Label("Pinselgröße");
        brushLabel.getStyleClass().add("text-muted");
        HBox brushRow = new HBox(6, brushLabel, brushSizeSpinner);
        brushRow.setAlignment(javafx.geometry.Pos.CENTER_LEFT);
        HBox shapeRow = new HBox(4, squareShapeBtn, circleShapeBtn, diamondShapeBtn);
        brushGroup = new VBox(4, brushRow, shapeRow);

        Label areaLabel = new Label("Aktiver Bereich");
        areaLabel.getStyleClass().add("text-muted");
        Label tableLabel = new Label("Encounter Table");
        tableLabel.getStyleClass().add("text-muted");
        areaGroup = new VBox(4, areaLabel, areaCombo, newAreaButton, deleteAreaButton, tableLabel, encounterTableCombo);

        visibilityGroup = new VBox(4, linksVisible, endpointsVisible);

        linkStatusLabel.getStyleClass().add("text-muted");
        linkStatusGroup = new VBox(4, linkStatusLabel, cancelLinkButton);
        linkStatusGroup.setVisible(false);
        linkStatusGroup.setManaged(false);

        getChildren().addAll(
                header,
                ThemeColors.controlSeparator(),
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
        boolean paint = tool == DungeonEditorTool.PAINT;
        boolean paintOrErase = paint || tool == DungeonEditorTool.ERASE;
        setGroupVisible(roomGroup, paint);
        setGroupVisible(brushGroup, paintOrErase);
        setGroupVisible(areaGroup, tool == DungeonEditorTool.AREA_ASSIGN);
        if (tool == DungeonEditorTool.LINK) {
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

    private static void setGroupVisible(VBox group, boolean visible) {
        group.setVisible(visible);
        group.setManaged(visible);
    }
}
