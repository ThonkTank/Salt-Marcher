package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
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
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView.BodyPolicy;
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
    private static final String STYLE_SELECTED = "selected";

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
    private boolean syncingMapEditorDraft;
    private boolean syncingMapEditorVisibility;
    private boolean syncingToolPopupVisibility;

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
        contributionModel.mapEditorUiStateProperty().addListener((ignored, before, after) -> showMapEditor(after));
        contributionModel.toolPaletteUiStateProperty().addListener((ignored, before, after) -> showToolPalette(after));
        refreshProjection(contributionModel);
        showViewMode(contributionModel.viewModeLabelProperty().get());
        showTool(contributionModel.selectedToolProperty().get());
        showMapEditor(contributionModel.mapEditorUiStateProperty().get());
        showToolPalette(contributionModel.toolPaletteUiStateProperty().get());
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
        markSelected(roomButton, isRoomTool(selectedTool));
        markSelected(wallButton, isWallTool(selectedTool));
        markSelected(doorButton, isDoorTool(selectedTool));
        markSelected(corridorButton, isCorridorTool(selectedTool));
        markSelected(stairButton, isStairTool(selectedTool));
        markSelected(transitionButton, isTransitionTool(selectedTool));
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
                publish(new DungeonEditorControlsViewInputEvent(
                        new DungeonEditorControlsViewInputEvent.MapSelectionInput(after.mapId()),
                        null,
                        null,
                        null,
                        0,
                        null));
            }
        });
        mapActionButton.setText("Neu");
        mapActionButton.getItems().setAll(editMapItem, deleteMapItem);
        mapActionButton.getStyleClass().addAll("toolbar-action-button", "dungeon-toolbar-menu");
        mapActionButton.setMinWidth(Region.USE_PREF_SIZE);
        mapActionButton.setOnAction(event -> publishMapEditorInput(true, false, false, false, false, false));
        editMapItem.setOnAction(event -> publishMapEditorInput(false, true, false, false, false, false));
        deleteMapItem.setOnAction(event -> publishMapEditorInput(false, false, true, false, false, false));
        describe(mapActionButton, "Neuen Dungeon erstellen; weitere Dungeon-Aktionen im Menü");
        statusLabel.getStyleClass().add("text-muted");
        statusLabel.setWrapText(false);
        statusLabel.setVisible(false);
        statusLabel.setManaged(false);
        statusLabel.setMinWidth(0.0);
        statusLabel.setMaxWidth(160.0);
        previousLevelButton.getStyleClass().add("toolbar-action-button");
        nextLevelButton.getStyleClass().add("toolbar-action-button");
        previousLevelButton.setOnAction(event -> publishProjectionShift(-1));
        nextLevelButton.setOnAction(event -> publishProjectionShift(1));
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
            publish(new DungeonEditorControlsViewInputEvent(
                    null,
                    null,
                    newToggle == graphButton ? VIEW_GRAPH : VIEW_GRID,
                    null,
                    0,
                    null));
        });
    }

    private void configureToolControls() {
        selectButton.setToggleGroup(toolGroup);
        selectButton.setSelected(true);
        selectButton.setOnAction(event -> publishToolSelection(SELECT_TOOL));
        describe(selectButton, "Auswahlwerkzeug aktivieren");
        describe(roomButton, "Raumwerkzeug waehlen");
        describe(wallButton, "Wandwerkzeug waehlen");
        describe(doorButton, "Türwerkzeug wählen");
        describe(corridorButton, "Korridorwerkzeug waehlen");
        describe(stairButton, "Treppenwerkzeug waehlen");
        describe(transitionButton, "Übergangswerkzeug wählen");
        roomButton.setOnAction(event -> publishToolFamilySelection(
                DungeonEditorControlsViewInputEvent.ToolFamily.ROOM,
                ROOM_PAINT_TOOL));
        wallButton.setOnAction(event -> publishToolFamilySelection(
                DungeonEditorControlsViewInputEvent.ToolFamily.WALL,
                WALL_CREATE_TOOL));
        doorButton.setOnAction(event -> publishToolFamilySelection(
                DungeonEditorControlsViewInputEvent.ToolFamily.DOOR,
                DOOR_CREATE_TOOL));
        corridorButton.setOnAction(event -> publishToolFamilySelection(
                DungeonEditorControlsViewInputEvent.ToolFamily.CORRIDOR,
                CORRIDOR_CREATE_TOOL));
        stairButton.setOnAction(event -> publishToolFamilySelection(
                DungeonEditorControlsViewInputEvent.ToolFamily.STAIR,
                STAIR_CREATE_TOOL));
        transitionButton.setOnAction(event -> publishToolFamilySelection(
                DungeonEditorControlsViewInputEvent.ToolFamily.TRANSITION,
                TRANSITION_CREATE_TOOL));
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
        mapEditorActionRow = new HBox(8, cancelMapEditButton, spacer, saveMapButton);
        mapEditorActionRow.setAlignment(Pos.CENTER_LEFT);

        VBox body = new VBox(10, mapNameField, mapEditorError, deleteConfirmRow);
        DialogSurfaceView panel = new DialogSurfaceView();
        panel.setPadding(new Insets(10));
        panel.getStyleClass().addAll("dropdown-window", "dropdown-form");
        panel.setHeader(mapEditorTitle);
        panel.setBody(body, BodyPolicy.FIXED);
        panel.setFooter(mapEditorActionRow);
        mapEditorPopup.setContent(panel);
        mapEditorPopup.addOnHidden(event -> {
            if (!syncingMapEditorVisibility) {
                publishMapEditorInput(false, false, false, true, false, false);
            }
        });
        cancelMapEditButton.setOnAction(event -> publishMapEditorInput(false, false, false, true, false, false));
        cancelDeleteButton.setOnAction(event -> publishMapEditorInput(false, false, false, true, false, false));
        confirmDeleteButton.setOnAction(event -> publishMapEditorInput(false, false, false, false, false, true));
        saveMapButton.setOnAction(event -> publishMapEditorInput(false, false, false, false, true, false));
        mapNameField.setOnAction(event -> publishMapEditorInput(false, false, false, false, true, false));
        mapNameField.textProperty().addListener((ignored, before, after) -> {
            if (!syncingMapEditorDraft) {
                publishMapEditorInput(false, false, false, false, false, false);
            }
        });
        overlayControls.setOnModeChanged(mode -> publishOverlayInput());
        overlayControls.setOnRangeChanged(levelRange -> publishOverlayInput());
        overlayControls.setOnOpacityChanged(opacity -> publishOverlayInput());
        overlayControls.setOnSelectedLevelsChanged(this::publishOverlayInput);
    }

    private void configureToolPopup() {
        HBox panel = new HBox(8, primaryToolOption, secondaryToolOption);
        panel.setPadding(new Insets(10));
        panel.getStyleClass().addAll("dropdown-window", "dropdown-form");
        toolPopup.setContent(panel);
        toolPopup.addOnHidden(event -> {
            if (!syncingToolPopupVisibility) {
                publishToolDismissed();
            }
        });
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

    private void showMapEditor(DungeonEditorContributionModel.MapEditorUiState mapEditorUiState) {
        DungeonEditorContributionModel.MapEditorUiState resolvedState = mapEditorUiState == null
                ? DungeonEditorContributionModel.MapEditorUiState.hidden()
                : mapEditorUiState;
        boolean popupWasShowing = mapEditorPopup.isShowing();
        mapEditorTitle.setText(resolvedState.title());
        syncingMapEditorDraft = true;
        mapNameField.setText(resolvedState.draftName());
        syncingMapEditorDraft = false;
        mapNameField.setVisible(resolvedState.draftFieldVisible());
        mapNameField.setManaged(resolvedState.draftFieldVisible());
        mapEditorActionRow.setVisible(resolvedState.actionRowVisible());
        mapEditorActionRow.setManaged(resolvedState.actionRowVisible());
        saveMapButton.setVisible(resolvedState.submitVisible());
        saveMapButton.setManaged(resolvedState.submitVisible());
        saveMapButton.setText(resolvedState.submitLabel());
        mapEditorError.setText(resolvedState.errorText());
        mapEditorError.setVisible(!resolvedState.errorText().isBlank());
        mapEditorError.setManaged(!resolvedState.errorText().isBlank());
        deleteConfirmRow.setVisible(resolvedState.deleteConfirmationVisible());
        deleteConfirmRow.setManaged(resolvedState.deleteConfirmationVisible());
        if (resolvedState.visible()) {
            if (!popupWasShowing) {
                mapEditorPopup.showBelow(mapActionButton);
                if (resolvedState.draftFieldVisible()) {
                    mapEditorPopup.focusAfterShown(mapNameField);
                    mapNameField.selectAll();
                }
            } else if (resolvedState.draftFieldVisible()) {
                mapEditorPopup.focusAfterShown(mapNameField);
            }
            return;
        }
        if (mapEditorPopup.isShowing()) {
            syncingMapEditorVisibility = true;
            mapEditorPopup.hide();
            syncingMapEditorVisibility = false;
        }
    }

    private void showToolPalette(DungeonEditorContributionModel.ToolPaletteUiState toolPaletteUiState) {
        DungeonEditorContributionModel.ToolPaletteUiState resolvedState = toolPaletteUiState == null
                ? DungeonEditorContributionModel.ToolPaletteUiState.closed()
                : toolPaletteUiState;
        primaryToolOption.setText(resolvedState.primaryToolLabel());
        secondaryToolOption.setText(resolvedState.secondaryToolLabel());
        primaryToolOption.setOnAction(event -> publishToolSelection(resolvedState.primaryToolLabel()));
        secondaryToolOption.setOnAction(event -> publishToolSelection(resolvedState.secondaryToolLabel()));
        if (resolvedState.visible()) {
            Button anchor = anchorFor(resolvedState.family());
            if (anchor != null) {
                if (toolPopup.isShowing()) {
                    syncingToolPopupVisibility = true;
                    toolPopup.hide();
                    syncingToolPopupVisibility = false;
                }
                toolPopup.showBelow(anchor);
                toolPopup.focusAfterShown(primaryToolOption);
            }
            return;
        }
        if (toolPopup.isShowing()) {
            syncingToolPopupVisibility = true;
            toolPopup.hide();
            syncingToolPopupVisibility = false;
        }
    }

    private void publishMapEditorInput(
            boolean openCreateRequested,
            boolean openRenameRequested,
            boolean openDeleteRequested,
            boolean dismissRequested,
            boolean submitRequested,
            boolean confirmDeleteRequested
    ) {
        publish(new DungeonEditorControlsViewInputEvent(
                null,
                new DungeonEditorControlsViewInputEvent.MapEditorInput(
                        openCreateRequested,
                        openRenameRequested,
                        openDeleteRequested,
                        dismissRequested,
                        submitRequested,
                        confirmDeleteRequested,
                        currentDraftText()),
                null,
                null,
                0,
                null));
    }

    private void publishToolFamilySelection(
            DungeonEditorControlsViewInputEvent.ToolFamily family,
            String primaryToolLabel
    ) {
        publish(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                new DungeonEditorControlsViewInputEvent.ToolInput(family, primaryToolLabel, false),
                0,
                null));
    }

    private void publishToolSelection(String selectedToolLabel) {
        publish(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                new DungeonEditorControlsViewInputEvent.ToolInput(null, selectedToolLabel, false),
                0,
                null));
    }

    private void publishToolDismissed() {
        publish(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                new DungeonEditorControlsViewInputEvent.ToolInput(null, null, true),
                0,
                null));
    }

    private void publishProjectionShift(int projectionLevelShift) {
        publish(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                null,
                projectionLevelShift,
                null));
    }

    private void publishOverlayInput() {
        publish(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                null,
                0,
                new DungeonEditorControlsViewInputEvent.OverlayInput(
                        overlayControls.overlayModeKey(),
                        overlayControls.overlayRange(),
                        overlayControls.overlayOpacity(),
                        overlayControls.overlayLevelsText())));
    }

    private void publish(DungeonEditorControlsViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private String currentDraftText() {
        return mapNameField.getText() == null ? "" : mapNameField.getText().strip();
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
        return button;
    }

    private static String normalizeTool(String tool) {
        String selectedTool = tool == null || tool.isBlank() ? SELECT_TOOL : tool;
        return isKnownTool(selectedTool) ? selectedTool : SELECT_TOOL;
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

    private @Nullable Button anchorFor(DungeonEditorContributionModel.ToolFamily family) {
        if (family == null) {
            return null;
        }
        return switch (family) {
            case ROOM -> roomButton;
            case WALL -> wallButton;
            case DOOR -> doorButton;
            case CORRIDOR -> corridorButton;
            case STAIR -> stairButton;
            case TRANSITION -> transitionButton;
            case NONE -> null;
        };
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
            if (!button.getStyleClass().contains(STYLE_SELECTED)) {
                button.getStyleClass().add(STYLE_SELECTED);
            }
        } else {
            button.getStyleClass().remove(STYLE_SELECTED);
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
}
