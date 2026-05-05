package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.SplitMenuButton;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView.BodyPolicy;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

public final class DungeonEditorControlsView extends DungeonControlPanelView {

    static final String VIEW_GRID = "Grid";
    static final String VIEW_GRAPH = "Graph";
    static final String SELECT_TOOL = "Auswahl";
    static final String ROOM_PAINT_TOOL = "Raum malen";
    static final String ROOM_DELETE_TOOL = "Raum löschen";
    static final String WALL_CREATE_TOOL = "Wand setzen";
    static final String WALL_DELETE_TOOL = "Wand löschen";
    static final String DOOR_CREATE_TOOL = "Tür setzen";
    static final String DOOR_DELETE_TOOL = "Tür löschen";
    static final String CORRIDOR_CREATE_TOOL = "Korridor erstellen";
    static final String CORRIDOR_DELETE_TOOL = "Korridor löschen";
    static final String STAIR_CREATE_TOOL = "Treppe erstellen";
    static final String STAIR_DELETE_TOOL = "Treppe löschen";
    static final String TRANSITION_CREATE_TOOL = "Übergang erstellen";
    static final String TRANSITION_DELETE_TOOL = "Übergang löschen";

    private static final String ROOM_FAMILY = "Raum";
    private static final String WALL_FAMILY = "Wand";
    private static final String DOOR_FAMILY = "Tür";
    private static final String CORRIDOR_FAMILY = "Korridor";
    private static final String STAIR_FAMILY = "Treppe";
    private static final String TRANSITION_FAMILY = "Übergang";

    private final ComboBox<MapItem> mapSelector = new ComboBox<>();
    private final SplitMenuButton mapActionButton = new SplitMenuButton();
    private final MenuItem editMapItem = new MenuItem("Dungeon bearbeiten");
    private final MenuItem deleteMapItem = new MenuItem("Dungeon löschen");
    private final Label statusLabel = new Label();
    private final Label levelLabel = new Label("Ebene z=0");
    private final Button previousLevelButton = new Button("-");
    private final Button nextLevelButton = new Button("+");
    private final ToggleButton gridButton = toolToggle(VIEW_GRID);
    private final ToggleButton graphButton = toolToggle(VIEW_GRAPH);
    private final ToggleButton selectButton = toolToggle(SELECT_TOOL);
    private final Button roomButton = toolButton(ROOM_FAMILY);
    private final Button wallButton = toolButton(WALL_FAMILY);
    private final Button doorButton = toolButton(DOOR_FAMILY);
    private final Button corridorButton = toolButton(CORRIDOR_FAMILY);
    private final Button stairButton = toolButton(STAIR_FAMILY);
    private final Button transitionButton = toolButton(TRANSITION_FAMILY);
    private final OverlayControlsPanel overlayControls = new OverlayControlsPanel(this::sectionLabel);
    private final ToggleGroup viewModeGroup = new ToggleGroup();
    private final ToggleGroup toolGroup = new ToggleGroup();
    private final AnchoredPopupView mapEditorPopup = new AnchoredPopupView();
    private final Label mapEditorTitle = new Label();
    private final TextField mapNameField = new TextField();
    private final Label mapEditorError = new Label();
    private final Button cancelMapEditButton = new Button("Abbrechen");
    private final Button saveMapButton = new Button("Speichern");
    private HBox deleteConfirmRow;
    private HBox mapEditorActionRow;
    private final AnchoredPopupView toolPopup = new AnchoredPopupView();
    private final Button primaryToolOption = toolButton("");
    private final Button secondaryToolOption = toolButton("");
    private Consumer<DungeonEditorControlsViewInputEvent> viewInputEventHandler = ignored -> {};
    private boolean syncingMaps;
    private boolean syncingViewMode;
    private boolean createMode;
    private boolean deleteMode;
    private long editingMapIdValue;

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonEditorControlsView() {
        super("");
        getStyleClass().add("control-toolbar");
        setFillWidth(true);
        configureMapControls();
        configureViewModeControls();
        configureToolControls();
        configureMapEditorPopup();
        configureToolPopup();
        getChildren().setAll(dungeonRow(), projectionRow(), toolRow());
    }

    public void onViewInputEvent(Consumer<DungeonEditorControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    public void bind(DungeonEditorContributionModel contributionModel) {
        if (contributionModel == null) {
            return;
        }
        contributionModel.mapEntriesProperty().addListener((ignored, before, after) -> refreshProjection(contributionModel));
        contributionModel.selectedMapKeyProperty().addListener((ignored, before, after) -> refreshProjection(contributionModel));
        contributionModel.busyProperty().addListener((ignored, before, after) -> refreshProjection(contributionModel));
        contributionModel.statusProperty().addListener((ignored, before, after) -> refreshProjection(contributionModel));
        contributionModel.reachableLevelsProperty().addListener((ignored, before, after) -> refreshProjection(contributionModel));
        contributionModel.projectionLevelProperty().addListener((ignored, before, after) -> refreshProjection(contributionModel));
        contributionModel.overlayProjectionProperty().addListener((ignored, before, after) ->
                showOverlaySettings(toOverlaySettings(after), contributionModel.busyProperty().get()));
        contributionModel.viewModeLabelProperty().addListener((ignored, before, after) -> showViewMode(after));
        contributionModel.selectedToolProperty().addListener((ignored, before, after) -> showTool(after));
        refreshProjection(contributionModel);
        showViewMode(contributionModel.viewModeLabelProperty().get());
        showTool(contributionModel.selectedToolProperty().get());
    }

    public void showMaps(List<MapItem> maps, String selectedKey, boolean busy, String statusText) {
        syncingMaps = true;
        List<MapItem> safeMaps = maps == null ? List.of() : List.copyOf(maps);
        mapSelector.getItems().setAll(safeMaps);
        MapItem selected = safeMaps.stream()
                .filter(item -> Objects.equals(item.key(), selectedKey))
                .findFirst()
                .orElse(null);
        if (selected == null && !safeMaps.isEmpty()) {
            selected = safeMaps.getFirst();
        }
        mapSelector.getSelectionModel().select(selected);
        mapSelector.setDisable(busy || safeMaps.isEmpty());
        mapActionButton.setDisable(busy);
        editMapItem.setDisable(busy || selected == null);
        deleteMapItem.setDisable(busy || selected == null);
        String resolvedStatus = statusText == null ? "" : statusText;
        statusLabel.setText(resolvedStatus);
        statusLabel.setVisible(!resolvedStatus.isBlank());
        statusLabel.setManaged(!resolvedStatus.isBlank());
        syncingMaps = false;
    }

    public void showLevel(int level) {
        levelLabel.setText("Ebene z=" + level);
    }

    public void showLevels(List<Integer> levels, int activeLevel, boolean busy, boolean navigationEnabled) {
        showLevel(activeLevel);
        previousLevelButton.setDisable(busy || !navigationEnabled);
        nextLevelButton.setDisable(busy || !navigationEnabled);
    }

    public void showOverlaySettings(OverlayControlsPanel.Settings settings, boolean disabled) {
        overlayControls.showSettings(settings, disabled);
    }

    public void showViewMode(String viewMode) {
        syncingViewMode = true;
        graphButton.setSelected(VIEW_GRAPH.equals(viewMode));
        gridButton.setSelected(!VIEW_GRAPH.equals(viewMode));
        syncingViewMode = false;
    }

    public void showTool(String tool) {
        String selectedTool = normalizeTool(tool);
        selectButton.setSelected(SELECT_TOOL.equals(selectedTool));
        roomButton.setUserData(isRoomTool(selectedTool) ? selectedTool : ROOM_PAINT_TOOL);
        wallButton.setUserData(isWallTool(selectedTool) ? selectedTool : WALL_CREATE_TOOL);
        doorButton.setUserData(isDoorTool(selectedTool) ? selectedTool : DOOR_CREATE_TOOL);
        corridorButton.setUserData(isCorridorTool(selectedTool) ? selectedTool : CORRIDOR_CREATE_TOOL);
        stairButton.setUserData(isStairTool(selectedTool) ? selectedTool : STAIR_CREATE_TOOL);
        transitionButton.setUserData(isTransitionTool(selectedTool) ? selectedTool : TRANSITION_CREATE_TOOL);
        markSelected(roomButton, isRoomTool(selectedTool));
        markSelected(wallButton, isWallTool(selectedTool));
        markSelected(doorButton, isDoorTool(selectedTool));
        markSelected(corridorButton, isCorridorTool(selectedTool));
        markSelected(stairButton, isStairTool(selectedTool));
        markSelected(transitionButton, isTransitionTool(selectedTool));
    }

    public void hideMapEditor() {
        mapEditorPopup.hide();
    }

    private void configureMapControls() {
        mapSelector.setConverter(new StringConverter<>() {
            @Override
            public String toString(MapItem item) {
                return item == null ? "" : item.mapName();
            }

            @Override
            public @Nullable MapItem fromString(String string) {
                return null;
            }
        });
        mapSelector.setMaxWidth(Double.MAX_VALUE);
        mapSelector.setMinWidth(0.0);
        mapSelector.getSelectionModel().selectedItemProperty().addListener((ignored, before, after) -> {
            editMapItem.setDisable(after == null);
            deleteMapItem.setDisable(after == null);
            if (!syncingMaps && after != null) {
                publishSnapshot(true, false, false, false, after.mapId(), currentMapName(),
                        false, currentViewModeKey(), false, currentTool(), 0, false,
                        overlayControls.overlayModeKey(), overlayControls.overlayRange(),
                        overlayControls.overlayOpacity(), overlayControls.overlayLevelsText());
            }
        });
        mapActionButton.setText("Neu");
        mapActionButton.getItems().setAll(editMapItem, deleteMapItem);
        mapActionButton.getStyleClass().addAll("toolbar-action-button", "dungeon-toolbar-menu");
        mapActionButton.setMinWidth(Region.USE_PREF_SIZE);
        mapActionButton.setOnAction(event -> showCreatePopup(mapActionButton));
        editMapItem.setOnAction(event -> showEditPopup(mapActionButton));
        deleteMapItem.setOnAction(event -> showDeletePopup(mapActionButton));
        describe(mapActionButton, "Neuen Dungeon erstellen; weitere Dungeon-Aktionen im Menü");
        statusLabel.getStyleClass().add("text-muted");
        statusLabel.setWrapText(false);
        statusLabel.setVisible(false);
        statusLabel.setManaged(false);
        statusLabel.setMinWidth(0.0);
        statusLabel.setMaxWidth(160.0);
        previousLevelButton.getStyleClass().add("toolbar-action-button");
        nextLevelButton.getStyleClass().add("toolbar-action-button");
        previousLevelButton.setOnAction(event -> publishSnapshot(false, false, false, false, currentMapIdValue(), currentMapName(),
                false, currentViewModeKey(), false, currentTool(), -1, false,
                overlayControls.overlayModeKey(), overlayControls.overlayRange(),
                overlayControls.overlayOpacity(), overlayControls.overlayLevelsText()));
        nextLevelButton.setOnAction(event -> publishSnapshot(false, false, false, false, currentMapIdValue(), currentMapName(),
                false, currentViewModeKey(), false, currentTool(), 1, false,
                overlayControls.overlayModeKey(), overlayControls.overlayRange(),
                overlayControls.overlayOpacity(), overlayControls.overlayLevelsText()));
        levelLabel.getStyleClass().add("text-muted");
        describe(previousLevelButton, "Vorherige Dungeon-Ebene anzeigen");
        describe(nextLevelButton, "Nächste Dungeon-Ebene anzeigen");
    }

    private void configureViewModeControls() {
        gridButton.setToggleGroup(viewModeGroup);
        graphButton.setToggleGroup(viewModeGroup);
        gridButton.setSelected(true);
        viewModeGroup.selectedToggleProperty().addListener((ignored, oldToggle, newToggle) -> {
            if (syncingViewMode) {
                return;
            }
            if (newToggle == null) {
                if (oldToggle != null) {
                    oldToggle.setSelected(true);
                }
                return;
            }
            publishSnapshot(
                    false,
                    false,
                    false,
                    false,
                    currentMapIdValue(),
                    currentMapName(),
                    true,
                    newToggle == graphButton ? VIEW_GRAPH : VIEW_GRID,
                    false,
                    currentTool(),
                    0,
                    false,
                    overlayControls.overlayModeKey(),
                    overlayControls.overlayRange(),
                    overlayControls.overlayOpacity(),
                    overlayControls.overlayLevelsText());
        });
    }

    private void configureToolControls() {
        selectButton.setToggleGroup(toolGroup);
        selectButton.setSelected(true);
        selectButton.setOnAction(event -> selectTool(SELECT_TOOL));
        describe(selectButton, "Auswahlwerkzeug aktivieren");
        describe(roomButton, "Raumwerkzeug waehlen");
        describe(wallButton, "Wandwerkzeug waehlen");
        describe(doorButton, "Türwerkzeug wählen");
        describe(corridorButton, "Korridorwerkzeug waehlen");
        describe(stairButton, "Treppenwerkzeug waehlen");
        describe(transitionButton, "Übergangswerkzeug wählen");
        roomButton.setOnAction(event -> activateToolFamily(roomButton, ROOM_PAINT_TOOL, ROOM_DELETE_TOOL));
        wallButton.setOnAction(event -> activateToolFamily(wallButton, WALL_CREATE_TOOL, WALL_DELETE_TOOL));
        doorButton.setOnAction(event -> activateToolFamily(doorButton, DOOR_CREATE_TOOL, DOOR_DELETE_TOOL));
        corridorButton.setOnAction(event -> activateToolFamily(corridorButton, CORRIDOR_CREATE_TOOL, CORRIDOR_DELETE_TOOL));
        stairButton.setOnAction(event -> activateToolFamily(stairButton, STAIR_CREATE_TOOL, STAIR_DELETE_TOOL));
        transitionButton.setOnAction(event -> activateToolFamily(
                transitionButton,
                TRANSITION_CREATE_TOOL,
                TRANSITION_DELETE_TOOL));
    }

    private void configureMapEditorPopup() {
        mapEditorTitle.getStyleClass().add("panel-title");
        mapEditorError.getStyleClass().add("text-warning");
        mapEditorError.setWrapText(true);
        mapEditorError.setManaged(false);
        mapEditorError.setVisible(false);

        Button cancelDeleteButton = new Button("Abbrechen");
        Button confirmDeleteButton = new Button("Löschen");
        Label deleteLabel = new Label("Dungeon löschen?");
        deleteLabel.getStyleClass().add("text-warning");
        Region deleteSpacer = new Region();
        HBox.setHgrow(deleteSpacer, Priority.ALWAYS);
        deleteConfirmRow = new HBox(8, deleteLabel, deleteSpacer, cancelDeleteButton, confirmDeleteButton);
        deleteConfirmRow.setVisible(false);
        deleteConfirmRow.setManaged(false);

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox actionRow = new HBox(8, cancelMapEditButton, spacer, saveMapButton);
        actionRow.setAlignment(Pos.CENTER_LEFT);
        mapEditorActionRow = actionRow;

        VBox body = new VBox(10, mapNameField, mapEditorError, deleteConfirmRow);
        DialogSurfaceView panel = new DialogSurfaceView();
        panel.setPadding(new Insets(10));
        panel.getStyleClass().addAll("dropdown-window", "dropdown-form");
        panel.setHeader(mapEditorTitle);
        panel.setBody(body, BodyPolicy.FIXED);
        panel.setFooter(actionRow);
        mapEditorPopup.setContent(panel);
        cancelMapEditButton.setOnAction(event -> mapEditorPopup.hide());
        cancelDeleteButton.setOnAction(event -> {
            if (deleteMode) {
                mapEditorPopup.hide();
            } else {
                showDeleteConfirmation(false);
            }
        });
        confirmDeleteButton.setOnAction(event -> {
            publishSnapshot(false, false, false, true, editingMapIdValue, currentMapName(),
                    false, currentViewModeKey(), false, currentTool(), 0, false,
                    overlayControls.overlayModeKey(), overlayControls.overlayRange(),
                    overlayControls.overlayOpacity(), overlayControls.overlayLevelsText());
            mapEditorPopup.hide();
        });
        saveMapButton.setOnAction(event -> submitMapEditor());
        mapNameField.setOnAction(event -> submitMapEditor());
        overlayControls.setOnModeChanged(mode -> publishSnapshot(false, false, false, false, currentMapIdValue(), currentMapName(),
                false, currentViewModeKey(), false, currentTool(), 0, true,
                overlayControls.overlayModeKey(), overlayControls.overlayRange(),
                overlayControls.overlayOpacity(), overlayControls.overlayLevelsText()));
        overlayControls.setOnRangeChanged(levelRange -> publishSnapshot(false, false, false, false, currentMapIdValue(), currentMapName(),
                false, currentViewModeKey(), false, currentTool(), 0, true,
                overlayControls.overlayModeKey(), overlayControls.overlayRange(),
                overlayControls.overlayOpacity(), overlayControls.overlayLevelsText()));
        overlayControls.setOnOpacityChanged(opacity -> publishSnapshot(false, false, false, false, currentMapIdValue(), currentMapName(),
                false, currentViewModeKey(), false, currentTool(), 0, true,
                overlayControls.overlayModeKey(), overlayControls.overlayRange(),
                overlayControls.overlayOpacity(), overlayControls.overlayLevelsText()));
        overlayControls.setOnSelectedLevelsChanged(() -> publishSnapshot(false, false, false, false, currentMapIdValue(), currentMapName(),
                false, currentViewModeKey(), false, currentTool(), 0, true,
                overlayControls.overlayModeKey(), overlayControls.overlayRange(),
                overlayControls.overlayOpacity(), overlayControls.overlayLevelsText()));
    }

    private void configureToolPopup() {
        HBox panel = new HBox(8, primaryToolOption, secondaryToolOption);
        panel.setPadding(new Insets(10));
        panel.getStyleClass().addAll("dropdown-window", "dropdown-form");
        toolPopup.setContent(panel);
    }

    private HBox dungeonRow() {
        HBox.setHgrow(mapSelector, Priority.ALWAYS);
        HBox row = compactControlRow(mapSelector, mapActionButton, statusLabel);
        row.getStyleClass().add("dungeon-control-map-row");
        return row;
    }

    private HBox projectionRow() {
        HBox row = compactControlRow(
                levelStepper(),
                overlayControls.trigger(),
                viewModeSegment());
        row.getStyleClass().add("dungeon-control-projection-row");
        return row;
    }

    private HBox toolRow() {
        HBox row = compactControlRow(selectButton, roomButton, wallButton, doorButton,
                corridorButton, stairButton, transitionButton);
        row.getStyleClass().add("dungeon-control-tool-row");
        return row;
    }

    private HBox levelStepper() {
        HBox stepper = compactControlGroup(levelLabel, previousLevelButton, nextLevelButton);
        stepper.getStyleClass().add("dungeon-stepper-group");
        return stepper;
    }

    private HBox viewModeSegment() {
        HBox segment = compactControlGroup(gridButton, graphButton);
        segment.getStyleClass().add("dungeon-segment-group");
        return segment;
    }

    private void showCreatePopup(Node anchor) {
        createMode = true;
        deleteMode = false;
        editingMapIdValue = 0L;
        mapEditorTitle.setText("Neuen Dungeon anlegen");
        mapNameField.setVisible(true);
        mapNameField.setManaged(true);
        mapNameField.setDisable(false);
        mapNameField.setText("Dungeon");
        mapEditorActionRow.setVisible(true);
        mapEditorActionRow.setManaged(true);
        saveMapButton.setVisible(true);
        saveMapButton.setManaged(true);
        saveMapButton.setText("Erstellen");
        showDeleteConfirmation(false);
        showMapEditor(anchor);
    }

    private void showEditPopup(Node anchor) {
        MapItem selected = mapSelector.getSelectionModel().getSelectedItem();
        if (selected == null) {
            return;
        }
        createMode = false;
        deleteMode = false;
        editingMapIdValue = selected.mapId();
        mapEditorTitle.setText("Dungeon bearbeiten");
        mapNameField.setVisible(true);
        mapNameField.setManaged(true);
        mapNameField.setDisable(false);
        mapNameField.setText(selected.mapName());
        mapEditorActionRow.setVisible(true);
        mapEditorActionRow.setManaged(true);
        saveMapButton.setVisible(true);
        saveMapButton.setManaged(true);
        saveMapButton.setText("Speichern");
        showDeleteConfirmation(false);
        showMapEditor(anchor);
    }

    private void showDeletePopup(Node anchor) {
        MapItem selected = mapSelector.getSelectionModel().getSelectedItem();
        if (selected == null) {
            return;
        }
        createMode = false;
        deleteMode = true;
        editingMapIdValue = selected.mapId();
        mapEditorTitle.setText("Dungeon löschen: " + selected.mapName());
        mapNameField.setVisible(false);
        mapNameField.setManaged(false);
        mapEditorActionRow.setVisible(false);
        mapEditorActionRow.setManaged(false);
        saveMapButton.setVisible(false);
        saveMapButton.setManaged(false);
        showDeleteConfirmation(true);
        showMapEditor(anchor);
    }

    private void showMapEditor(Node anchor) {
        mapEditorError.setText("");
        mapEditorError.setVisible(false);
        mapEditorError.setManaged(false);
        mapEditorPopup.showBelow(anchor);
        if (mapNameField.isVisible()) {
            mapEditorPopup.focusAfterShown(mapNameField);
            mapNameField.selectAll();
        }
    }

    private void submitMapEditor() {
        String mapName = mapNameField.getText() == null ? "" : mapNameField.getText().strip();
        if (mapName.isBlank()) {
            mapEditorError.setText("Name fehlt.");
            mapEditorError.setVisible(true);
            mapEditorError.setManaged(true);
            mapNameField.requestFocus();
            return;
        }
        if (createMode) {
            publishSnapshot(false, true, false, false, 0L, mapName,
                    false, currentViewModeKey(), false, currentTool(), 0, false,
                    overlayControls.overlayModeKey(), overlayControls.overlayRange(),
                    overlayControls.overlayOpacity(), overlayControls.overlayLevelsText());
        } else {
            publishSnapshot(false, false, true, false, editingMapIdValue, mapName,
                    false, currentViewModeKey(), false, currentTool(), 0, false,
                    overlayControls.overlayModeKey(), overlayControls.overlayRange(),
                    overlayControls.overlayOpacity(), overlayControls.overlayLevelsText());
        }
        mapEditorPopup.hide();
    }

    private void showDeleteConfirmation(boolean visible) {
        deleteConfirmRow.setVisible(visible);
        deleteConfirmRow.setManaged(visible);
    }

    private void activateToolFamily(Button anchor, String primaryTool, String secondaryTool) {
        selectTool(primaryTool);
        primaryToolOption.setText(primaryTool);
        secondaryToolOption.setText(secondaryTool);
        primaryToolOption.setOnAction(event -> {
            anchor.setUserData(primaryTool);
            selectTool(primaryTool);
            toolPopup.hide();
        });
        secondaryToolOption.setOnAction(event -> {
            anchor.setUserData(secondaryTool);
            selectTool(secondaryTool);
            toolPopup.hide();
        });
        toolPopup.showBelow(anchor);
        toolPopup.focusAfterShown(primaryToolOption);
    }

    private void selectTool(String tool) {
        String selectedTool = normalizeTool(tool);
        showTool(selectedTool);
        publishSnapshot(
                false,
                false,
                false,
                false,
                currentMapIdValue(),
                currentMapName(),
                false,
                currentViewModeKey(),
                true,
                selectedTool,
                0,
                false,
                overlayControls.overlayModeKey(),
                overlayControls.overlayRange(),
                overlayControls.overlayOpacity(),
                overlayControls.overlayLevelsText());
    }

    private void publish(DungeonEditorControlsViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private void publishSnapshot(
            boolean mapSelectionChanged,
            boolean createMapRequested,
            boolean renameMapRequested,
            boolean deleteMapRequested,
            long mapIdValue,
            String mapName,
            boolean viewModeChanged,
            String viewModeKey,
            boolean toolChanged,
            String tool,
            int projectionLevelShift,
            boolean overlayChanged,
            String overlayModeKey,
            int overlayRange,
            double overlayOpacity,
            String overlayLevelsText
    ) {
        publish(new DungeonEditorControlsViewInputEvent(
                mapSelectionChanged,
                createMapRequested,
                renameMapRequested,
                deleteMapRequested,
                mapIdValue,
                mapName,
                viewModeChanged,
                toViewMode(viewModeKey),
                toolChanged,
                toTool(tool),
                projectionLevelShift,
                overlayChanged,
                overlayModeKey,
                overlayRange,
                overlayOpacity,
                overlayLevelsText));
    }

    private long currentMapIdValue() {
        MapItem selected = mapSelector.getSelectionModel().getSelectedItem();
        return selected == null ? 0L : selected.mapId();
    }

    private String currentMapName() {
        if (mapNameField.isVisible()) {
            return mapNameField.getText() == null ? "" : mapNameField.getText().strip();
        }
        MapItem selected = mapSelector.getSelectionModel().getSelectedItem();
        return selected == null ? "" : selected.mapName();
    }

    private String currentViewModeKey() {
        return graphButton.isSelected() ? VIEW_GRAPH : VIEW_GRID;
    }

    private String currentTool() {
        if (selectButton.isSelected()) {
            return SELECT_TOOL;
        }
        if (roomButton.getStyleClass().contains("selected")) {
            return currentButtonTool(roomButton, ROOM_PAINT_TOOL);
        }
        if (wallButton.getStyleClass().contains("selected")) {
            return currentButtonTool(wallButton, WALL_CREATE_TOOL);
        }
        if (doorButton.getStyleClass().contains("selected")) {
            return currentButtonTool(doorButton, DOOR_CREATE_TOOL);
        }
        if (corridorButton.getStyleClass().contains("selected")) {
            return currentButtonTool(corridorButton, CORRIDOR_CREATE_TOOL);
        }
        if (stairButton.getStyleClass().contains("selected")) {
            return currentButtonTool(stairButton, STAIR_CREATE_TOOL);
        }
        if (transitionButton.getStyleClass().contains("selected")) {
            return currentButtonTool(transitionButton, TRANSITION_CREATE_TOOL);
        }
        return SELECT_TOOL;
    }

    private static String currentButtonTool(Button button, String fallbackTool) {
        Object userData = button.getUserData();
        return userData instanceof String tool ? normalizeTool(tool) : fallbackTool;
    }

    private static ToggleButton toolToggle(String text) {
        ToggleButton button = new ToggleButton(text);
        button.getStyleClass().add("tool-btn");
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }

    private static Button toolButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("tool-btn");
        button.setMinWidth(Region.USE_PREF_SIZE);
        button.setUserData(text);
        return button;
    }

    private static String normalizeTool(String tool) {
        String selectedTool = tool == null || tool.isBlank() ? SELECT_TOOL : tool;
        return isKnownTool(selectedTool) ? selectedTool : SELECT_TOOL;
    }

    private static DungeonEditorControlsViewInputEvent.ViewMode toViewMode(String viewModeKey) {
        return VIEW_GRAPH.equalsIgnoreCase(viewModeKey)
                ? DungeonEditorControlsViewInputEvent.ViewMode.GRAPH
                : DungeonEditorControlsViewInputEvent.ViewMode.GRID;
    }

    private static DungeonEditorControlsViewInputEvent.Tool toTool(String tool) {
        return switch (normalizeTool(tool)) {
            case ROOM_PAINT_TOOL -> DungeonEditorControlsViewInputEvent.Tool.ROOM_PAINT;
            case ROOM_DELETE_TOOL -> DungeonEditorControlsViewInputEvent.Tool.ROOM_DELETE;
            case WALL_CREATE_TOOL -> DungeonEditorControlsViewInputEvent.Tool.WALL_CREATE;
            case WALL_DELETE_TOOL -> DungeonEditorControlsViewInputEvent.Tool.WALL_DELETE;
            case DOOR_CREATE_TOOL -> DungeonEditorControlsViewInputEvent.Tool.DOOR_CREATE;
            case DOOR_DELETE_TOOL -> DungeonEditorControlsViewInputEvent.Tool.DOOR_DELETE;
            case CORRIDOR_CREATE_TOOL -> DungeonEditorControlsViewInputEvent.Tool.CORRIDOR_CREATE;
            case CORRIDOR_DELETE_TOOL -> DungeonEditorControlsViewInputEvent.Tool.CORRIDOR_DELETE;
            case STAIR_CREATE_TOOL -> DungeonEditorControlsViewInputEvent.Tool.STAIR_CREATE;
            case STAIR_DELETE_TOOL -> DungeonEditorControlsViewInputEvent.Tool.STAIR_DELETE;
            case TRANSITION_CREATE_TOOL -> DungeonEditorControlsViewInputEvent.Tool.TRANSITION_CREATE;
            case TRANSITION_DELETE_TOOL -> DungeonEditorControlsViewInputEvent.Tool.TRANSITION_DELETE;
            default -> DungeonEditorControlsViewInputEvent.Tool.SELECT;
        };
    }

    private void refreshProjection(DungeonEditorContributionModel contributionModel) {
        boolean hasMap = contributionModel.selectedMapKeyProperty().get() != null
                && !contributionModel.selectedMapKeyProperty().get().isBlank();
        boolean busy = contributionModel.busyProperty().get();
        showMaps(
                contributionModel.mapEntriesProperty().get().stream()
                        .map(DungeonEditorControlsView::toMapItem)
                        .toList(),
                contributionModel.selectedMapKeyProperty().get(),
                busy,
                contributionModel.statusProperty().get());
        showLevels(
                contributionModel.reachableLevelsProperty().get(),
                contributionModel.projectionLevelProperty().get(),
                busy,
                hasMap);
        showOverlaySettings(toOverlaySettings(contributionModel.overlayProjectionProperty().get()), busy);
    }

    private static MapItem toMapItem(DungeonEditorContributionModel.MapListEntry selection) {
        return new MapItem(
                selection.key(),
                selection.mapIdValue(),
                selection.mapName(),
                selection.revision());
    }

    private static OverlayControlsPanel.Settings toOverlaySettings(
            DungeonEditorContributionModel.OverlayProjection settings
    ) {
        return new OverlayControlsPanel.Settings(
                toOverlayMode(settings.modeKey()),
                settings.levelRange(),
                settings.opacity(),
                settings.selectedLevels());
    }

    private static OverlayControlsPanel.Mode toOverlayMode(String overlayMode) {
        if ("NEARBY".equalsIgnoreCase(overlayMode)) {
            return OverlayControlsPanel.Mode.NEARBY;
        }
        if ("SELECTED".equalsIgnoreCase(overlayMode)) {
            return OverlayControlsPanel.Mode.SELECTED;
        }
        return OverlayControlsPanel.Mode.OFF;
    }

    private static boolean isKnownTool(String tool) {
        return SELECT_TOOL.equals(tool)
                || ROOM_PAINT_TOOL.equals(tool)
                || ROOM_DELETE_TOOL.equals(tool)
                || WALL_CREATE_TOOL.equals(tool)
                || WALL_DELETE_TOOL.equals(tool)
                || DOOR_CREATE_TOOL.equals(tool)
                || DOOR_DELETE_TOOL.equals(tool)
                || CORRIDOR_CREATE_TOOL.equals(tool)
                || CORRIDOR_DELETE_TOOL.equals(tool)
                || STAIR_CREATE_TOOL.equals(tool)
                || STAIR_DELETE_TOOL.equals(tool)
                || TRANSITION_CREATE_TOOL.equals(tool)
                || TRANSITION_DELETE_TOOL.equals(tool);
    }

    private static void markSelected(Button button, boolean selected) {
        if (selected) {
            if (!button.getStyleClass().contains("selected")) {
                button.getStyleClass().add("selected");
            }
        } else {
            button.getStyleClass().remove("selected");
        }
    }

    private static boolean isRoomTool(String tool) {
        return ROOM_PAINT_TOOL.equals(tool) || ROOM_DELETE_TOOL.equals(tool);
    }

    private static boolean isWallTool(String tool) {
        return WALL_CREATE_TOOL.equals(tool) || WALL_DELETE_TOOL.equals(tool);
    }

    private static boolean isDoorTool(String tool) {
        return DOOR_CREATE_TOOL.equals(tool) || DOOR_DELETE_TOOL.equals(tool);
    }

    private static boolean isCorridorTool(String tool) {
        return CORRIDOR_CREATE_TOOL.equals(tool) || CORRIDOR_DELETE_TOOL.equals(tool);
    }

    private static boolean isStairTool(String tool) {
        return STAIR_CREATE_TOOL.equals(tool) || STAIR_DELETE_TOOL.equals(tool);
    }

    private static boolean isTransitionTool(String tool) {
        return TRANSITION_CREATE_TOOL.equals(tool) || TRANSITION_DELETE_TOOL.equals(tool);
    }

    public record MapItem(
            String key,
            long mapId,
            String mapName,
            long revision
    ) {
        public MapItem {
            key = key == null ? "" : key;
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
            revision = Math.max(0L, revision);
        }
    }

    public record MapNameRequest(String key, String mapName) {
        public MapNameRequest {
            key = key == null ? "" : key;
            mapName = mapName == null ? "" : mapName.strip();
        }
    }
}
