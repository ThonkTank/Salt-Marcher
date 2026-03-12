package features.world.dungeonmap.ui.editor.panes;

import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.api.DungeonEncounterSummary;
import features.world.dungeonmap.model.BrushShape;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureCategory;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.controls.WallEditorMode;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
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

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public class DungeonToolSettingsPane extends VBox {

    private final ComboBox<DungeonRoom> roomCombo = new ComboBox<>();
    private final ComboBox<DungeonArea> areaCombo = new ComboBox<>();
    private final ComboBox<DungeonEncounterTableSummary> encounterTableCombo = new ComboBox<>();
    private final ComboBox<DungeonEncounterSummary> encounterCombo = new ComboBox<>();
    private final ComboBox<DungeonFeatureCategory> featureCategoryCombo = new ComboBox<>();
    private final ComboBox<DungeonFeature> activeFeatureCombo = new ComboBox<>();
    private final ComboBox<DungeonFeature> tileFeatureCombo = new ComboBox<>();
    private final CheckBox linksVisible = new CheckBox("Links anzeigen");
    private final CheckBox endpointsVisible = new CheckBox("Übergänge anzeigen");
    private final CheckBox featuresVisible = new CheckBox("Features anzeigen");
    private final Button newRoomButton = new Button("Raum neu");
    private final Button deleteRoomButton = new Button("Raum löschen");
    private final Button newAreaButton = new Button("Bereich neu");
    private final Button deleteAreaButton = new Button("Bereich löschen");
    private final Button newFeatureButton = new Button("Feature neu");
    private final Button deleteFeatureButton = new Button("Feature löschen");
    private final Button addTileToFeatureButton = new Button("Ausgewähltes Feld hinzufügen");
    private final Button removeTileFromFeatureButton = new Button("Ausgewähltes Feld entfernen");

    private final Spinner<Integer> brushSizeSpinner = new Spinner<>(new SpinnerValueFactory.IntegerSpinnerValueFactory(1, 5, 1));
    private final ToggleGroup shapeGroup = new ToggleGroup();
    private final ToggleButton squareShapeBtn = new ToggleButton("\u25a1 Viereck");
    private final ToggleButton circleShapeBtn = new ToggleButton("\u25cb Kreis");
    private final ToggleButton diamondShapeBtn = new ToggleButton("\u25c7 Raute");

    private final VBox roomGroup;
    private final VBox brushGroup;
    private final VBox areaGroup;
    private final VBox featureGroup;
    private final VBox wallGroup;
    private final VBox visibilityGroup;
    private final VBox linkStatusGroup;
    private final Label activeToolLabel = new Label("Auswahl");
    private final Label encounterSelectionLabel = new Label("Gebundenes Encounter");
    private final Label linkStatusLabel = new Label("Ersten Übergang klicken, dann zweiten Übergang klicken.");
    private final Button cancelLinkButton = new Button("Abbrechen");

    private boolean updatingSelections = false;
    private Consumer<DungeonRoom> onRoomSelected;
    private Consumer<DungeonArea> onAreaSelected;
    private Consumer<DungeonFeature> onFeatureSelected;
    private Consumer<DungeonFeature> onTileContextFeatureSelected;
    private Runnable onCancelLink;
    private List<DungeonFeature> knownFeatures = List.of();
    private final ToggleGroup wallModeGroup = new ToggleGroup();

    public DungeonToolSettingsPane() {
        getStyleClass().addAll("dungeon-sidebar-pane", "dungeon-tool-settings-pane");
        setSpacing(10);
        setPadding(new Insets(10));
        activeToolLabel.getStyleClass().add("dungeon-panel-title");

        roomCombo.setPromptText("Raum wählen…");
        areaCombo.setPromptText("Bereich wählen…");
        encounterTableCombo.setPromptText("Encounter Table…");
        encounterCombo.setPromptText("Encounter wählen…");
        featureCategoryCombo.setPromptText("Kategorie wählen…");
        activeFeatureCombo.setPromptText("Feature wählen…");
        tileFeatureCombo.setPromptText("Feature auf Feld…");
        roomCombo.setMaxWidth(Double.MAX_VALUE);
        areaCombo.setMaxWidth(Double.MAX_VALUE);
        encounterTableCombo.setMaxWidth(Double.MAX_VALUE);
        encounterCombo.setMaxWidth(Double.MAX_VALUE);
        featureCategoryCombo.setMaxWidth(Double.MAX_VALUE);
        activeFeatureCombo.setMaxWidth(Double.MAX_VALUE);
        tileFeatureCombo.setMaxWidth(Double.MAX_VALUE);
        featureCategoryCombo.getItems().setAll(DungeonFeatureCategory.values());
        featureCategoryCombo.setValue(DungeonFeatureCategory.HAZARD);
        linksVisible.setSelected(true);
        endpointsVisible.setSelected(true);
        featuresVisible.setSelected(true);
        deleteRoomButton.getStyleClass().add("danger");
        deleteAreaButton.getStyleClass().add("danger");
        deleteFeatureButton.getStyleClass().add("danger");

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
        activeFeatureCombo.setOnAction(event -> {
            if (!updatingSelections && onFeatureSelected != null) {
                onFeatureSelected.accept(activeFeatureCombo.getValue());
            }
        });
        tileFeatureCombo.setOnAction(event -> {
            if (!updatingSelections && onTileContextFeatureSelected != null) {
                onTileContextFeatureSelected.accept(tileFeatureCombo.getValue());
            }
        });
        featureCategoryCombo.setOnAction(event -> {
            if (!updatingSelections) {
                refreshFeatureChoices(activeFeatureCombo.getValue() == null ? null : activeFeatureCombo.getValue().featureId());
                updateEncounterSelectionState();
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
            if (newToggle == null && oldToggle != null) {
                oldToggle.setSelected(true);
            }
        });

        Label roomLabel = new Label("Aktiver Raum");
        roomLabel.getStyleClass().add("text-muted");
        HBox roomActions = actionRow(newRoomButton, deleteRoomButton);
        roomGroup = card("Raum", new VBox(6, roomLabel, roomCombo, roomActions));

        brushSizeSpinner.setPrefWidth(70);
        brushSizeSpinner.setEditable(false);
        Label brushLabel = new Label("Pinselgröße");
        brushLabel.getStyleClass().add("text-muted");
        HBox brushRow = new HBox(6, brushLabel, brushSizeSpinner);
        brushRow.setAlignment(Pos.CENTER_LEFT);
        HBox shapeRow = new HBox(4, squareShapeBtn, circleShapeBtn, diamondShapeBtn);
        brushGroup = card("Pinsel", new VBox(6, brushRow, shapeRow));

        Label areaLabel = new Label("Aktiver Bereich");
        areaLabel.getStyleClass().add("text-muted");
        Label tableLabel = new Label("Encounter Table");
        tableLabel.getStyleClass().add("text-muted");
        HBox areaActions = actionRow(newAreaButton, deleteAreaButton);
        areaGroup = card("Bereich", new VBox(6, areaLabel, areaCombo, areaActions, tableLabel, encounterTableCombo));

        ToggleButton paintWallButton = new ToggleButton(WallEditorMode.PAINT_WALL.label());
        paintWallButton.setToggleGroup(wallModeGroup);
        paintWallButton.setUserData(WallEditorMode.PAINT_WALL);
        paintWallButton.setSelected(true);
        ToggleButton eraseWallButton = new ToggleButton(WallEditorMode.ERASE_WALL.label());
        eraseWallButton.setToggleGroup(wallModeGroup);
        eraseWallButton.setUserData(WallEditorMode.ERASE_WALL);
        ToggleButton passageButton = new ToggleButton(WallEditorMode.PLACE_PASSAGE.label());
        passageButton.setToggleGroup(wallModeGroup);
        passageButton.setUserData(WallEditorMode.PLACE_PASSAGE);
        wallModeGroup.selectedToggleProperty().addListener((obs, oldToggle, newToggle) -> {
            if (newToggle == null && oldToggle != null) {
                oldToggle.setSelected(true);
            }
        });
        wallGroup = card("Wände", new HBox(4, paintWallButton, eraseWallButton, passageButton));

        Label featureCategoryLabel = new Label("Aktive Kategorie");
        featureCategoryLabel.getStyleClass().add("text-muted");
        Label activeFeatureLabel = new Label("Aktives Feature");
        activeFeatureLabel.getStyleClass().add("text-muted");
        encounterSelectionLabel.getStyleClass().add("text-muted");
        Label tileFeatureLabel = new Label("Features auf ausgewähltem Feld");
        tileFeatureLabel.getStyleClass().add("text-muted");
        HBox featureActions = actionRow(newFeatureButton, deleteFeatureButton);
        VBox featureManagement = new VBox(6,
                featureCategoryLabel, featureCategoryCombo,
                activeFeatureLabel, activeFeatureCombo,
                encounterSelectionLabel, encounterCombo,
                featureActions);
        featureManagement.getStyleClass().add("editor-subsection");
        VBox tileAssignment = new VBox(6,
                tileFeatureLabel, tileFeatureCombo,
                actionRow(addTileToFeatureButton, removeTileFromFeatureButton));
        tileAssignment.getStyleClass().add("editor-subsection");
        featureGroup = card("Features", featureManagement, tileAssignment);

        visibilityGroup = card("Anzeige", new VBox(4, featuresVisible, linksVisible, endpointsVisible));

        linkStatusLabel.getStyleClass().add("text-muted");
        cancelLinkButton.getStyleClass().add("compact");
        linkStatusGroup = card("Link", new VBox(6, linkStatusLabel, cancelLinkButton));
        linkStatusGroup.setVisible(false);
        linkStatusGroup.setManaged(false);

        VBox overviewCard = card("Werkzeug", activeToolLabel);
        getChildren().addAll(overviewCard, roomGroup, brushGroup, areaGroup, wallGroup, featureGroup, visibilityGroup, linkStatusGroup);

        setGroupVisible(roomGroup, false);
        setGroupVisible(brushGroup, false);
        setGroupVisible(areaGroup, false);
        setGroupVisible(wallGroup, false);
        setGroupVisible(featureGroup, false);
        updateEncounterSelectionState();
        setMapLoaded(false);
    }

    public void setActiveTool(DungeonEditorTool tool) {
        DungeonEditorTool effectiveTool = tool == null ? DungeonEditorTool.SELECT : tool;
        activeToolLabel.setText(toolTitle(effectiveTool));
        setGroupVisible(roomGroup, effectiveTool.roomSettingsVisible());
        setGroupVisible(brushGroup, effectiveTool.brushSettingsVisible());
        setGroupVisible(areaGroup, effectiveTool.areaSettingsVisible());
        setGroupVisible(wallGroup, effectiveTool == DungeonEditorTool.PASSAGE);
        setGroupVisible(featureGroup, effectiveTool.featureSettingsVisible());
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

    public WallEditorMode getWallEditorMode() {
        Toggle selected = wallModeGroup.getSelectedToggle();
        return selected == null ? WallEditorMode.PAINT_WALL : (WallEditorMode) selected.getUserData();
    }

    public BrushShape getBrushShape() {
        Toggle selected = shapeGroup.getSelectedToggle();
        return selected != null ? (BrushShape) selected.getUserData() : BrushShape.SQUARE;
    }

    public void setMapLoaded(boolean loaded) {
        newRoomButton.setDisable(!loaded);
        newAreaButton.setDisable(!loaded);
        newFeatureButton.setDisable(!loaded);
    }

    public Long getActiveRoomId() {
        return roomCombo.getValue() == null ? null : roomCombo.getValue().roomId();
    }

    public Long getActiveAreaId() {
        return areaCombo.getValue() == null ? null : areaCombo.getValue().areaId();
    }

    public Long getActiveFeatureId() {
        return activeFeatureCombo.getValue() == null ? null : activeFeatureCombo.getValue().featureId();
    }

    public DungeonFeatureCategory getActiveFeatureCategory() {
        return featureCategoryCombo.getValue() == null ? DungeonFeatureCategory.HAZARD : featureCategoryCombo.getValue();
    }

    public DungeonEncounterTableSummary getSelectedEncounterTable() {
        return encounterTableCombo.getValue();
    }

    public DungeonEncounterSummary getSelectedEncounter() {
        return encounterCombo.getValue();
    }

    public void setRooms(List<DungeonRoom> rooms) {
        updatingSelections = true;
        DungeonRoom previous = roomCombo.getValue();
        roomCombo.getItems().setAll(rooms);
        roomCombo.setValue(findById(rooms, previous == null ? null : previous.roomId(), DungeonRoom::roomId, rooms.isEmpty() ? null : rooms.get(0)));
        updatingSelections = false;
    }

    public void setAreas(List<DungeonArea> areas) {
        updatingSelections = true;
        DungeonArea previous = areaCombo.getValue();
        areaCombo.getItems().setAll(areas);
        areaCombo.setValue(findById(areas, previous == null ? null : previous.areaId(), DungeonArea::areaId, areas.isEmpty() ? null : areas.get(0)));
        updatingSelections = false;
    }

    public void setFeatures(List<DungeonFeature> features) {
        knownFeatures = features == null ? List.of() : List.copyOf(features);
        refreshFeatureChoices(activeFeatureCombo.getValue() == null ? null : activeFeatureCombo.getValue().featureId());
        updateEncounterSelectionState();
    }

    public void setTileContextFeatures(List<DungeonFeature> features) {
        updatingSelections = true;
        List<DungeonFeature> safe = features == null ? List.of() : List.copyOf(features);
        tileFeatureCombo.getItems().setAll(safe);
        tileFeatureCombo.setValue(safe.isEmpty() ? null : safe.get(0));
        updatingSelections = false;
    }

    public void setEncounterTables(List<DungeonEncounterTableSummary> tables) {
        encounterTableCombo.getItems().setAll(tables);
    }

    public void setStoredEncounters(List<DungeonEncounterSummary> encounters) {
        encounterCombo.getItems().setAll(encounters == null ? List.of() : encounters);
        updateEncounterSelectionState();
    }

    public void selectRoom(Long roomId) {
        updatingSelections = true;
        roomCombo.setValue(findById(roomCombo.getItems(), roomId, DungeonRoom::roomId, null));
        updatingSelections = false;
    }

    public void selectArea(Long areaId) {
        updatingSelections = true;
        areaCombo.setValue(findById(areaCombo.getItems(), areaId, DungeonArea::areaId, null));
        updatingSelections = false;
    }

    public void selectFeatureCategory(DungeonFeatureCategory category) {
        updatingSelections = true;
        featureCategoryCombo.setValue(category == null ? DungeonFeatureCategory.HAZARD : category);
        refreshFeatureChoices(activeFeatureCombo.getValue() == null ? null : activeFeatureCombo.getValue().featureId());
        updatingSelections = false;
    }

    public void selectFeature(Long featureId) {
        updatingSelections = true;
        DungeonFeature selected = findById(knownFeatures, featureId, DungeonFeature::featureId, null);
        if (selected != null) {
            featureCategoryCombo.setValue(selected.category());
        }
        refreshFeatureChoices(featureId);
        selectEncounter(selected == null ? null : selected.encounterId());
        updateEncounterSelectionState();
        updatingSelections = false;
    }

    public void clearEntitySelections() {
        updatingSelections = true;
        roomCombo.setValue(null);
        areaCombo.setValue(null);
        activeFeatureCombo.setValue(null);
        encounterTableCombo.setValue(null);
        encounterCombo.setValue(null);
        tileFeatureCombo.getItems().clear();
        tileFeatureCombo.setValue(null);
        updatingSelections = false;
        updateEncounterSelectionState();
    }

    public void clearFeatureSelection() {
        updatingSelections = true;
        activeFeatureCombo.setValue(null);
        encounterCombo.setValue(null);
        tileFeatureCombo.getItems().clear();
        tileFeatureCombo.setValue(null);
        updatingSelections = false;
        updateEncounterSelectionState();
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

    public void selectEncounter(Long encounterId) {
        if (encounterId == null) {
            encounterCombo.setValue(null);
            return;
        }
        for (DungeonEncounterSummary encounter : encounterCombo.getItems()) {
            if (encounter.encounterId() == encounterId) {
                encounterCombo.setValue(encounter);
                return;
            }
        }
        encounterCombo.setValue(null);
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

    public ComboBox<DungeonEncounterSummary> encounterComboBox() {
        return encounterCombo;
    }

    public ComboBox<DungeonFeature> activeFeatureComboBox() {
        return activeFeatureCombo;
    }

    public CheckBox linksVisibleCheckBox() {
        return linksVisible;
    }

    public CheckBox endpointsVisibleCheckBox() {
        return endpointsVisible;
    }

    public CheckBox featuresVisibleCheckBox() {
        return featuresVisible;
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

    public Button newFeatureButton() {
        return newFeatureButton;
    }

    public Button deleteFeatureButton() {
        return deleteFeatureButton;
    }

    public Button addTileToFeatureButton() {
        return addTileToFeatureButton;
    }

    public Button removeTileFromFeatureButton() {
        return removeTileFromFeatureButton;
    }

    public void setOnRoomSelected(Consumer<DungeonRoom> onRoomSelected) {
        this.onRoomSelected = onRoomSelected;
    }

    public void setOnAreaSelected(Consumer<DungeonArea> onAreaSelected) {
        this.onAreaSelected = onAreaSelected;
    }

    public void setOnFeatureSelected(Consumer<DungeonFeature> onFeatureSelected) {
        this.onFeatureSelected = onFeatureSelected;
    }

    public void setOnTileContextFeatureSelected(Consumer<DungeonFeature> onTileContextFeatureSelected) {
        this.onTileContextFeatureSelected = onTileContextFeatureSelected;
    }

    public void setOnCancelLink(Runnable onCancelLink) {
        this.onCancelLink = onCancelLink;
    }

    private void refreshFeatureChoices(Long preferredFeatureId) {
        List<DungeonFeature> filtered = new ArrayList<>();
        DungeonFeatureCategory category = getActiveFeatureCategory();
        for (DungeonFeature feature : knownFeatures) {
            if (feature.category() == category) {
                filtered.add(feature);
            }
        }
        updatingSelections = true;
        activeFeatureCombo.getItems().setAll(filtered);
        activeFeatureCombo.setValue(findById(filtered, preferredFeatureId, DungeonFeature::featureId, filtered.isEmpty() ? null : filtered.get(0)));
        updatingSelections = false;
        updateEncounterSelectionState();
    }

    private void updateEncounterSelectionState() {
        boolean enabled = getActiveFeatureCategory() == DungeonFeatureCategory.ENCOUNTER;
        encounterSelectionLabel.setVisible(enabled);
        encounterSelectionLabel.setManaged(enabled);
        encounterCombo.setVisible(enabled);
        encounterCombo.setManaged(enabled);
        encounterCombo.setDisable(!enabled);
        if (!enabled) {
            encounterCombo.setValue(null);
        }
    }

    private static <T> T findById(List<T> items, Long id, java.util.function.Function<T, Long> idGetter, T fallback) {
        if (id != null) {
            for (T item : items) {
                Long candidateId = idGetter.apply(item);
                if (candidateId != null && candidateId.equals(id)) {
                    return item;
                }
            }
        }
        return fallback;
    }

    private VBox card(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("dungeon-panel-title");
        VBox box = new VBox(6, titleLabel);
        box.getStyleClass().add("dungeon-editor-card");
        box.getChildren().addAll(content);
        return box;
    }

    private static HBox actionRow(Button... buttons) {
        HBox row = new HBox(8, buttons);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private static void setGroupVisible(VBox group, boolean visible) {
        group.setVisible(visible);
        group.setManaged(visible);
    }

    private static String toolTitle(DungeonEditorTool tool) {
        return switch (tool) {
            case SELECT -> "Auswahl";
            case PAINT -> "Malen";
            case ERASE -> "Löschen";
            case AREA_ASSIGN -> "Bereich";
            case FEATURE -> "Feature";
            case PASSAGE -> "Wandeditor";
            case ENDPOINT -> "Übergang";
            case LINK -> "Link";
        };
    }

}
