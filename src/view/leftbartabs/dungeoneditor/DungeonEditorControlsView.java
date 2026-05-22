package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.beans.value.ChangeListener;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.SplitMenuButton;
import javafx.scene.control.TextField;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;

public final class DungeonEditorControlsView extends VBox {

    private static final String PMD_LAW_OF_DEMETER = "PMD.LawOfDemeter";
    private static final String TOOL_BUTTON_STYLE = "tool-btn";
    private static final String STYLE_SELECTED = "selected";

    private Consumer<DungeonEditorControlsViewInputEvent> viewInputEventHandler = ignored -> { };

    public DungeonEditorControlsView() {
        getStyleClass().addAll("surface-root", "dungeon-control-panel", "control-toolbar");
        setFillWidth(true);
    }

    public void onViewInputEvent(Consumer<DungeonEditorControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(DungeonEditorControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        boolean[] rendering = {false};
        DungeonEditorControlsContentModel.ToolControls toolControls = contentModel.toolControls();
        ComboBox<DungeonEditorControlsContentModel.MapItem> mapSelector = mapSelector();
        SplitMenuButton mapActionButton = new SplitMenuButton();
        MenuItem editMapItem = new MenuItem("Dungeon bearbeiten");
        MenuItem deleteMapItem = new MenuItem("Dungeon löschen");
        Label statusLabel = mutedLabel("");
        TextField mapDraftField = new TextField();
        Button cancelMapEditButton = new Button("Abbrechen");
        Button saveMapEditButton = new Button("Speichern");
        Button confirmDeleteButton = new Button("Löschen");
        VBox mapEditor = new VBox(4);
        Label mapEditorTitle = new Label();
        Label mapEditorError = mutedLabel("");

        Label levelLabel = mutedLabel("Ebene z=0");
        Button previousLevelButton = actionButton("-");
        Button nextLevelButton = actionButton("+");
        ToggleButton gridButton = toolToggle(toolControls.gridView());
        ToggleButton graphButton = toolToggle(toolControls.graphView());
        ToggleGroup viewModeGroup = new ToggleGroup();
        Button overlayTrigger = actionButton("Overlay: Aus");
        ComboBox<DungeonEditorControlsContentModel.OverlayModeOption> overlayModeSelector = new ComboBox<>();
        Spinner<Integer> overlayRangeSpinner = new Spinner<>(1, 6, 2);
        Slider overlayOpacitySlider = new Slider(10, 90, 35);
        Label overlayOpacityLabel = mutedLabel("35%");
        TextField selectedLevelsField = new TextField();
        HBox overlayRangeRow = row(new Label("Umfang"), overlayRangeSpinner);
        HBox selectedLevelsRow = row(new Label("Ebenen"), selectedLevelsField);

        ToggleButton selectButton = toolToggle(toolControls.select().label());
        Button roomButton = toolButton(toolControls.room().label());
        Button roomDeleteButton = toolButton(toolControls.roomDelete().label());
        Button wallButton = toolButton(toolControls.wall().label());
        Button wallDeleteButton = toolButton(toolControls.wallDelete().label());
        Button doorButton = toolButton(toolControls.door().label());
        Button doorDeleteButton = toolButton(toolControls.doorDelete().label());
        Button corridorButton = toolButton(toolControls.corridor().label());
        Button corridorDeleteButton = toolButton(toolControls.corridorDelete().label());

        configureMapControls(mapSelector, mapActionButton, editMapItem, deleteMapItem, rendering);
        configureMapEditor(
                mapEditor,
                mapEditorTitle,
                mapDraftField,
                mapEditorError,
                cancelMapEditButton,
                saveMapEditButton,
                confirmDeleteButton);
        configureProjectionControls(
                contentModel,
                previousLevelButton,
                nextLevelButton,
                gridButton,
                graphButton,
                viewModeGroup,
                overlayTrigger,
                overlayModeSelector,
                overlayRangeSpinner,
                overlayOpacitySlider,
                selectedLevelsField,
                rendering,
                toolControls);
        configureToolControls(
                toolControls,
                selectButton,
                roomButton,
                roomDeleteButton,
                wallButton,
                wallDeleteButton,
                doorButton,
                doorDeleteButton,
                corridorButton,
                corridorDeleteButton);

        HBox.setHgrow(mapSelector, Priority.ALWAYS);
        HBox mapRow = row(mapSelector, mapActionButton, statusLabel);
        mapRow.getStyleClass().add("dungeon-control-map-row");
        HBox stepper = group(levelLabel, previousLevelButton, nextLevelButton);
        stepper.getStyleClass().add("dungeon-stepper-group");
        HBox viewModes = group(gridButton, graphButton);
        viewModes.getStyleClass().add("dungeon-segment-group");
        HBox overlayOpacityRow = row(new Label("Staerke"), overlayOpacitySlider, overlayOpacityLabel);
        HBox overlayRow = row(overlayTrigger, overlayModeSelector, overlayOpacityRow, overlayRangeRow, selectedLevelsRow);
        overlayRow.getStyleClass().add("dungeon-overlay-content");
        HBox projectionRow = row(stepper, viewModes);
        projectionRow.getStyleClass().add("dungeon-control-projection-row");
        HBox toolRow = row(
                selectButton,
                roomButton,
                roomDeleteButton,
                wallButton,
                wallDeleteButton,
                doorButton,
                doorDeleteButton,
                corridorButton,
                corridorDeleteButton);
        toolRow.getStyleClass().add("dungeon-control-tool-row");
        getChildren().setAll(mapRow, mapEditor, projectionRow, overlayRow, toolRow);

        wireMapProjection(contentModel, mapSelector, mapActionButton, editMapItem, deleteMapItem, statusLabel, rendering);
        wireMapEditor(contentModel, mapEditor, mapEditorTitle, mapDraftField, mapEditorError,
                cancelMapEditButton, saveMapEditButton, confirmDeleteButton, rendering);
        wireProjection(contentModel, levelLabel, previousLevelButton, nextLevelButton, gridButton, graphButton,
                overlayTrigger, overlayModeSelector, overlayRangeSpinner, overlayOpacitySlider, overlayOpacityLabel,
                selectedLevelsField, overlayRangeRow, selectedLevelsRow, rendering, toolControls);
        wireToolProjection(
                contentModel,
                toolControls,
                selectButton,
                roomButton,
                roomDeleteButton,
                wallButton,
                wallDeleteButton,
                doorButton,
                doorDeleteButton,
                corridorButton,
                corridorDeleteButton);
    }

    private void configureMapControls(
            ComboBox<DungeonEditorControlsContentModel.MapItem> mapSelector,
            SplitMenuButton mapActionButton,
            MenuItem editMapItem,
            MenuItem deleteMapItem,
            boolean[] rendering
    ) {
        mapSelector.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonEditorControlsContentModel.MapItem item) {
                return item == null ? "" : item.mapName();
            }

            @Override
            public DungeonEditorControlsContentModel.@Nullable MapItem fromString(String string) {
                return null;
            }
        });
        mapSelector.setMaxWidth(Double.MAX_VALUE);
        mapSelector.setMinWidth(0.0);
        mapSelector.setPromptText("Dungeon auswählen");
        mapSelector.setAccessibleText("Dungeon auswählen");
        mapSelector.getSelectionModel().selectedItemProperty().addListener((ignored, before, after) -> {
            if (!rendering[0] && after != null) {
                emitMapSelection(after.mapId());
            }
        });

        mapActionButton.setText("Neu");
        mapActionButton.getItems().setAll(editMapItem, deleteMapItem);
        mapActionButton.getStyleClass().addAll("toolbar-action-button", "dungeon-toolbar-menu");
        mapActionButton.setMinWidth(USE_PREF_SIZE);
        mapActionButton.setAccessibleText("Neuen Dungeon erstellen; weitere Dungeon-Aktionen im Menü");
        mapActionButton.setOnAction(event -> emitMapEditorInput(
                rendering, "", true, false, false, false, false, false));
        editMapItem.setOnAction(event -> emitMapEditorInput(
                rendering, "", false, true, false, false, false, false));
        deleteMapItem.setOnAction(event -> emitMapEditorInput(
                rendering, "", false, false, true, false, false, false));
    }

    private static void configureMapEditor(
            VBox mapEditor,
            Label mapEditorTitle,
            TextField mapDraftField,
            Label mapEditorError,
            Button cancelMapEditButton,
            Button saveMapEditButton,
            Button confirmDeleteButton
    ) {
        Label draftLabel = new Label("Name");
        draftLabel.setLabelFor(mapDraftField);
        mapDraftField.setAccessibleText("Dungeon-Name");
        HBox actionRow = row(cancelMapEditButton, saveMapEditButton, confirmDeleteButton);
        mapEditor.getChildren().setAll(mapEditorTitle, draftLabel, mapDraftField, mapEditorError, actionRow);
        mapEditor.getStyleClass().addAll("dropdown-window", "dropdown-form", "dungeon-editor-popup");
        mapEditor.setVisible(false);
        mapEditor.setManaged(false);
    }

    private void configureProjectionControls(
            DungeonEditorControlsContentModel contentModel,
            Button previousLevelButton,
            Button nextLevelButton,
            ToggleButton gridButton,
            ToggleButton graphButton,
            ToggleGroup viewModeGroup,
            Button overlayTrigger,
            ComboBox<DungeonEditorControlsContentModel.OverlayModeOption> overlayModeSelector,
            Spinner<Integer> overlayRangeSpinner,
            Slider overlayOpacitySlider,
            TextField selectedLevelsField,
            boolean[] rendering,
            DungeonEditorControlsContentModel.ToolControls toolControls
    ) {
        previousLevelButton.setAccessibleText("Vorherige Dungeon-Ebene anzeigen");
        nextLevelButton.setAccessibleText("Nächste Dungeon-Ebene anzeigen");
        previousLevelButton.setOnAction(event -> emitProjectionShift(-1));
        nextLevelButton.setOnAction(event -> emitProjectionShift(1));
        gridButton.setToggleGroup(viewModeGroup);
        graphButton.setToggleGroup(viewModeGroup);
        gridButton.setSelected(true);
        viewModeGroup.selectedToggleProperty().addListener((ignored, oldToggle, newToggle) ->
                handleViewModeChanged(oldToggle, newToggle, graphButton, gridButton, toolControls));
        overlayModeSelector.getItems().setAll(contentModel.overlayModeOptions());
        overlayRangeSpinner.setEditable(true);
        overlayOpacitySlider.setShowTickMarks(false);
        overlayOpacitySlider.setShowTickLabels(false);
        selectedLevelsField.setPromptText("-1, 1, 3");
        selectedLevelsField.setPrefColumnCount(10);
        overlayTrigger.setDisable(true);
        ChangeListener<Object> overlayListener = (ignored, before, after) -> emitOverlayInput(
                rendering,
                selectedOverlayModeKey(overlayModeSelector),
                overlayRangeSpinner.getValue() == null ? 0 : overlayRangeSpinner.getValue(),
                overlayOpacitySlider.getValue() / 100.0,
                selectedLevelsField.getText());
        overlayModeSelector.valueProperty().addListener(overlayListener);
        overlayRangeSpinner.valueProperty().addListener(overlayListener);
        overlayOpacitySlider.valueProperty().addListener(overlayListener);
        selectedLevelsField.setOnAction(event -> emitOverlayInput(
                rendering,
                selectedOverlayModeKey(overlayModeSelector),
                overlayRangeSpinner.getValue() == null ? 0 : overlayRangeSpinner.getValue(),
                overlayOpacitySlider.getValue() / 100.0,
                selectedLevelsField.getText()));
    }

    private void configureToolControls(
            DungeonEditorControlsContentModel.ToolControls toolControls,
            ToggleButton selectButton,
            Button roomButton,
            Button roomDeleteButton,
            Button wallButton,
            Button wallDeleteButton,
            Button doorButton,
            Button doorDeleteButton,
            Button corridorButton,
            Button corridorDeleteButton
    ) {
        ToggleGroup toolGroup = new ToggleGroup();
        selectButton.setToggleGroup(toolGroup);
        selectButton.setSelected(true);
        selectButton.setAccessibleText("Auswahlwerkzeug aktivieren");
        roomButton.setAccessibleText("Raumwerkzeug wählen");
        roomDeleteButton.setAccessibleText("Raum löschen wählen");
        wallButton.setAccessibleText("Wandwerkzeug wählen");
        wallDeleteButton.setAccessibleText("Wand löschen wählen");
        doorButton.setAccessibleText("Türwerkzeug wählen");
        doorDeleteButton.setAccessibleText("Tür löschen wählen");
        corridorButton.setAccessibleText("Korridorwerkzeug wählen");
        corridorDeleteButton.setAccessibleText("Korridor löschen wählen");
        selectButton.setOnAction(event -> emitToolSelection(toolControls.select().key()));
        roomButton.setOnAction(event -> emitToolSelection(toolControls.room().key()));
        roomDeleteButton.setOnAction(event -> emitToolSelection(toolControls.roomDelete().key()));
        wallButton.setOnAction(event -> emitToolSelection(toolControls.wall().key()));
        wallDeleteButton.setOnAction(event -> emitToolSelection(toolControls.wallDelete().key()));
        doorButton.setOnAction(event -> emitToolSelection(toolControls.door().key()));
        doorDeleteButton.setOnAction(event -> emitToolSelection(toolControls.doorDelete().key()));
        corridorButton.setOnAction(event -> emitToolSelection(toolControls.corridor().key()));
        corridorDeleteButton.setOnAction(event -> emitToolSelection(toolControls.corridorDelete().key()));
    }

    private void wireMapProjection(
            DungeonEditorControlsContentModel contentModel,
            ComboBox<DungeonEditorControlsContentModel.MapItem> mapSelector,
            SplitMenuButton mapActionButton,
            MenuItem editMapItem,
            MenuItem deleteMapItem,
            Label statusLabel,
            boolean[] rendering
    ) {
        contentModel.mapProjectionProperty().addListener((ignored, before, after) ->
                showMaps(after, mapSelector, mapActionButton, editMapItem, deleteMapItem, statusLabel, rendering));
        showMaps(contentModel.mapProjectionProperty().get(), mapSelector, mapActionButton, editMapItem,
                deleteMapItem, statusLabel, rendering);
    }

    private void wireMapEditor(
            DungeonEditorControlsContentModel contentModel,
            VBox mapEditor,
            Label mapEditorTitle,
            TextField mapDraftField,
            Label mapEditorError,
            Button cancelMapEditButton,
            Button saveMapEditButton,
            Button confirmDeleteButton,
            boolean[] rendering
    ) {
        mapDraftField.textProperty().addListener((ignored, before, after) ->
                emitMapEditorInput(rendering, after, false, false, false, false, false, false));
        cancelMapEditButton.setOnAction(event -> emitMapEditorInput(
                rendering, mapDraftField.getText(), false, false, false, true, false, false));
        saveMapEditButton.setOnAction(event -> emitMapEditorInput(
                rendering, mapDraftField.getText(), false, false, false, false, true, false));
        confirmDeleteButton.setOnAction(event -> emitMapEditorInput(
                rendering, mapDraftField.getText(), false, false, false, false, false, true));
        contentModel.mapEditorProperty().addListener((ignored, before, after) ->
                showMapEditor(after, mapEditor, mapEditorTitle, mapDraftField, mapEditorError,
                        saveMapEditButton, confirmDeleteButton, rendering));
        showMapEditor(contentModel.mapEditorProperty().get(), mapEditor, mapEditorTitle, mapDraftField,
                mapEditorError, saveMapEditButton, confirmDeleteButton, rendering);
    }

    private void wireProjection(
            DungeonEditorControlsContentModel contentModel,
            Label levelLabel,
            Button previousLevelButton,
            Button nextLevelButton,
            ToggleButton gridButton,
            ToggleButton graphButton,
            Button overlayTrigger,
            ComboBox<DungeonEditorControlsContentModel.OverlayModeOption> overlayModeSelector,
            Spinner<Integer> overlayRangeSpinner,
            Slider overlayOpacitySlider,
            Label overlayOpacityLabel,
            TextField selectedLevelsField,
            HBox overlayRangeRow,
            HBox selectedLevelsRow,
            boolean[] rendering,
            DungeonEditorControlsContentModel.ToolControls toolControls
    ) {
        contentModel.projectionProperty().addListener((ignored, before, after) ->
                showProjection(after, levelLabel, previousLevelButton, nextLevelButton, gridButton, graphButton,
                        overlayTrigger, overlayModeSelector, overlayRangeSpinner, overlayOpacitySlider,
                        overlayOpacityLabel, selectedLevelsField, overlayRangeRow, selectedLevelsRow, rendering,
                        toolControls));
        showProjection(contentModel.projectionProperty().get(), levelLabel, previousLevelButton, nextLevelButton,
                gridButton, graphButton, overlayTrigger, overlayModeSelector, overlayRangeSpinner,
                overlayOpacitySlider, overlayOpacityLabel, selectedLevelsField, overlayRangeRow, selectedLevelsRow,
                rendering, toolControls);
    }

    private void wireToolProjection(
            DungeonEditorControlsContentModel contentModel,
            DungeonEditorControlsContentModel.ToolControls toolControls,
            ToggleButton selectButton,
            Button roomButton,
            Button roomDeleteButton,
            Button wallButton,
            Button wallDeleteButton,
            Button doorButton,
            Button doorDeleteButton,
            Button corridorButton,
            Button corridorDeleteButton
    ) {
        contentModel.toolProjectionProperty().addListener((ignored, before, after) ->
                showTool(
                        after,
                        toolControls,
                        selectButton,
                        roomButton,
                        roomDeleteButton,
                        wallButton,
                        wallDeleteButton,
                        doorButton,
                        doorDeleteButton,
                        corridorButton,
                        corridorDeleteButton));
        showTool(
                contentModel.toolProjectionProperty().get(),
                toolControls,
                selectButton,
                roomButton,
                roomDeleteButton,
                wallButton,
                wallDeleteButton,
                doorButton,
                doorDeleteButton,
                corridorButton,
                corridorDeleteButton);
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    private void showMaps(
            DungeonEditorControlsContentModel.MapProjection projection,
            ComboBox<DungeonEditorControlsContentModel.MapItem> mapSelector,
            SplitMenuButton mapActionButton,
            MenuItem editMapItem,
            MenuItem deleteMapItem,
            Label statusLabel,
            boolean[] rendering
    ) {
        DungeonEditorControlsContentModel.MapProjection safeProjection = projection;
        List<DungeonEditorControlsContentModel.MapItem> safeMaps = safeProjection.maps();
        rendering[0] = true;
        mapSelector.getItems().setAll(safeMaps);
        mapSelector.getSelectionModel().select(resolveSelected(safeMaps, safeProjection.selectedKey()));
        rendering[0] = false;
        mapSelector.setDisable(safeProjection.busy() || safeMaps.isEmpty());
        mapActionButton.setDisable(safeProjection.busy());
        boolean selectionMissing = mapSelector.getSelectionModel().getSelectedItem() == null;
        editMapItem.setDisable(safeProjection.busy() || selectionMissing);
        deleteMapItem.setDisable(safeProjection.busy() || selectionMissing);
        statusLabel.setText(safeProjection.statusText());
        statusLabel.setVisible(!safeProjection.statusText().isBlank());
        statusLabel.setManaged(!safeProjection.statusText().isBlank());
    }

    private static void showMapEditor(
            DungeonEditorControlsContentModel.MapEditorUiState mapEditorUiState,
            VBox mapEditor,
            Label mapEditorTitle,
            TextField mapDraftField,
            Label mapEditorError,
            Button saveMapEditButton,
            Button confirmDeleteButton,
            boolean[] rendering
    ) {
        DungeonEditorControlsContentModel.MapEditorUiState resolvedState = mapEditorUiState;
        mapEditor.setVisible(resolvedState.visible());
        mapEditor.setManaged(resolvedState.visible());
        mapEditorTitle.setText(resolvedState.title());
        rendering[0] = true;
        mapDraftField.setText(resolvedState.draftName());
        rendering[0] = false;
        mapDraftField.setVisible(resolvedState.draftFieldVisible());
        mapDraftField.setManaged(resolvedState.draftFieldVisible());
        saveMapEditButton.setVisible(resolvedState.submitVisible());
        saveMapEditButton.setManaged(resolvedState.submitVisible());
        saveMapEditButton.setText(resolvedState.submitLabel());
        confirmDeleteButton.setVisible(resolvedState.deleteConfirmationVisible());
        confirmDeleteButton.setManaged(resolvedState.deleteConfirmationVisible());
        mapEditorError.setText(resolvedState.errorText());
        mapEditorError.setVisible(!resolvedState.errorText().isBlank());
        mapEditorError.setManaged(!resolvedState.errorText().isBlank());
    }

    private void showProjection(
            DungeonEditorControlsContentModel.ProjectionState projection,
            Label levelLabel,
            Button previousLevelButton,
            Button nextLevelButton,
            ToggleButton gridButton,
            ToggleButton graphButton,
            Button overlayTrigger,
            ComboBox<DungeonEditorControlsContentModel.OverlayModeOption> overlayModeSelector,
            Spinner<Integer> overlayRangeSpinner,
            Slider overlayOpacitySlider,
            Label overlayOpacityLabel,
            TextField selectedLevelsField,
            HBox overlayRangeRow,
            HBox selectedLevelsRow,
            boolean[] rendering,
            DungeonEditorControlsContentModel.ToolControls toolControls
    ) {
        DungeonEditorControlsContentModel.ProjectionState safeProjection = projection;
        levelLabel.setText("Ebene z=" + safeProjection.activeLevel());
        previousLevelButton.setDisable(safeProjection.busy() || !safeProjection.navigationEnabled());
        nextLevelButton.setDisable(safeProjection.busy() || !safeProjection.navigationEnabled());
        rendering[0] = true;
        String graphViewLabel = toolControls.graphView();
        graphButton.setSelected(graphViewLabel.equals(safeProjection.viewMode()));
        gridButton.setSelected(!graphViewLabel.equals(safeProjection.viewMode()));
        showOverlay(safeProjection, overlayTrigger, overlayModeSelector, overlayRangeSpinner, overlayOpacitySlider,
                overlayOpacityLabel, selectedLevelsField, overlayRangeRow, selectedLevelsRow);
        rendering[0] = false;
    }

    private static void showOverlay(
            DungeonEditorControlsContentModel.ProjectionState projection,
            Button overlayTrigger,
            ComboBox<DungeonEditorControlsContentModel.OverlayModeOption> overlayModeSelector,
            Spinner<Integer> overlayRangeSpinner,
            Slider overlayOpacitySlider,
            Label overlayOpacityLabel,
            TextField selectedLevelsField,
            HBox overlayRangeRow,
            HBox selectedLevelsRow
    ) {
        DungeonEditorControlsContentModel.OverlayPanelState panelState = projection.overlayPanelState();
        overlayTrigger.setText(panelState.triggerText());
        selectOverlayMode(overlayModeSelector, panelState.modeKey());
        if (overlayRangeSpinner.getValueFactory() != null) {
            overlayRangeSpinner.getValueFactory().setValue(panelState.levelRange());
        }
        overlayOpacitySlider.setValue(panelState.opacityPercent());
        overlayOpacityLabel.setText(Math.round(panelState.opacityPercent()) + "%");
        selectedLevelsField.setText(panelState.selectedLevelsText());
        overlayModeSelector.setDisable(panelState.controlsDisabled());
        overlayOpacitySlider.setDisable(panelState.controlsDisabled());
        overlayRangeRow.setVisible(panelState.rangeVisible());
        overlayRangeRow.setManaged(panelState.rangeVisible());
        selectedLevelsRow.setVisible(panelState.selectedVisible());
        selectedLevelsRow.setManaged(panelState.selectedVisible());
        overlayRangeSpinner.setDisable(panelState.controlsDisabled() || !panelState.rangeVisible());
        selectedLevelsField.setDisable(panelState.controlsDisabled() || !panelState.selectedVisible());
    }

    private static void showTool(
            DungeonEditorControlsContentModel.ToolProjection projection,
            DungeonEditorControlsContentModel.ToolControls toolControls,
            ToggleButton selectButton,
            Button roomButton,
            Button roomDeleteButton,
            Button wallButton,
            Button wallDeleteButton,
            Button doorButton,
            Button doorDeleteButton,
            Button corridorButton,
            Button corridorDeleteButton
    ) {
        String defaultToolLabel = toolControls.defaultTool();
        String selectedTool = projection == null ? defaultToolLabel : projection.selectedTool();
        selectButton.setSelected(defaultToolLabel.equals(selectedTool));
        markSelected(roomButton, selectedTool, toolControls.room().selectedLabel());
        markSelected(roomDeleteButton, selectedTool, toolControls.roomDelete().selectedLabel());
        markSelected(wallButton, selectedTool, toolControls.wall().selectedLabel());
        markSelected(wallDeleteButton, selectedTool, toolControls.wallDelete().selectedLabel());
        markSelected(doorButton, selectedTool, toolControls.door().selectedLabel());
        markSelected(doorDeleteButton, selectedTool, toolControls.doorDelete().selectedLabel());
        markSelected(corridorButton, selectedTool, toolControls.corridor().selectedLabel());
        markSelected(corridorDeleteButton, selectedTool, toolControls.corridorDelete().selectedLabel());
    }

    private void handleViewModeChanged(
            Toggle oldToggle,
            Toggle newToggle,
            ToggleButton graphButton,
            ToggleButton gridButton,
            DungeonEditorControlsContentModel.ToolControls toolControls
    ) {
        if (newToggle == null) {
            if (oldToggle != null) {
                oldToggle.setSelected(true);
            }
            return;
        }
        emitViewMode(graphButton.equals(newToggle)
                ? toolControls.graphView()
                : toolControls.gridView());
        gridButton.setSelected(!graphButton.equals(newToggle));
    }

    private void emitMapSelection(long selectedMapIdValue) {
        viewInputEventHandler.accept(new DungeonEditorControlsViewInputEvent(
                new DungeonEditorControlsViewInputEvent.MapSnapshot(
                        selectedMapIdValue, "", false, false, false, false, false, false, false),
                new DungeonEditorControlsViewInputEvent.ToolSnapshot("", "", false),
                new DungeonEditorControlsViewInputEvent.ProjectionSnapshot("", 0),
                new DungeonEditorControlsViewInputEvent.OverlaySnapshot("", 0, 0.0, "")));
    }

    private void emitMapEditorInput(
            boolean[] rendering,
            String draftText,
            boolean openCreate,
            boolean openRename,
            boolean openDelete,
            boolean dismiss,
            boolean submit,
            boolean confirmDelete
    ) {
        if (rendering[0]) {
            return;
        }
        viewInputEventHandler.accept(new DungeonEditorControlsViewInputEvent(
                new DungeonEditorControlsViewInputEvent.MapSnapshot(
                        0L, draftText, true, openCreate, openRename, openDelete, dismiss, submit, confirmDelete),
                new DungeonEditorControlsViewInputEvent.ToolSnapshot("", "", false),
                new DungeonEditorControlsViewInputEvent.ProjectionSnapshot("", 0),
                new DungeonEditorControlsViewInputEvent.OverlaySnapshot("", 0, 0.0, "")));
    }

    private void emitViewMode(String viewModeKey) {
        viewInputEventHandler.accept(new DungeonEditorControlsViewInputEvent(
                new DungeonEditorControlsViewInputEvent.MapSnapshot(0L, "", false, false, false, false, false, false, false),
                new DungeonEditorControlsViewInputEvent.ToolSnapshot("", "", false),
                new DungeonEditorControlsViewInputEvent.ProjectionSnapshot(viewModeKey, 0),
                new DungeonEditorControlsViewInputEvent.OverlaySnapshot("", 0, 0.0, "")));
    }

    private void emitProjectionShift(int projectionLevelShift) {
        viewInputEventHandler.accept(new DungeonEditorControlsViewInputEvent(
                new DungeonEditorControlsViewInputEvent.MapSnapshot(0L, "", false, false, false, false, false, false, false),
                new DungeonEditorControlsViewInputEvent.ToolSnapshot("", "", false),
                new DungeonEditorControlsViewInputEvent.ProjectionSnapshot("", projectionLevelShift),
                new DungeonEditorControlsViewInputEvent.OverlaySnapshot("", 0, 0.0, "")));
    }

    private void emitToolSelection(String selectedToolKey) {
        viewInputEventHandler.accept(new DungeonEditorControlsViewInputEvent(
                new DungeonEditorControlsViewInputEvent.MapSnapshot(0L, "", false, false, false, false, false, false, false),
                new DungeonEditorControlsViewInputEvent.ToolSnapshot("", selectedToolKey, false),
                new DungeonEditorControlsViewInputEvent.ProjectionSnapshot("", 0),
                new DungeonEditorControlsViewInputEvent.OverlaySnapshot("", 0, 0.0, "")));
    }

    private void emitOverlayInput(
            boolean[] rendering,
            String modeKey,
            int levelRange,
            double opacity,
            String selectedLevelsText
    ) {
        if (rendering[0]) {
            return;
        }
        viewInputEventHandler.accept(new DungeonEditorControlsViewInputEvent(
                new DungeonEditorControlsViewInputEvent.MapSnapshot(0L, "", false, false, false, false, false, false, false),
                new DungeonEditorControlsViewInputEvent.ToolSnapshot("", "", false),
                new DungeonEditorControlsViewInputEvent.ProjectionSnapshot("", 0),
                new DungeonEditorControlsViewInputEvent.OverlaySnapshot(modeKey, levelRange, opacity, selectedLevelsText)));
    }

    private static ComboBox<DungeonEditorControlsContentModel.MapItem> mapSelector() {
        return new ComboBox<>();
    }

    private static HBox row(javafx.scene.Node... nodes) {
        HBox row = new HBox(6, nodes);
        row.getStyleClass().add("dungeon-control-row");
        row.setAlignment(Pos.CENTER_LEFT);
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
    }

    private static HBox group(javafx.scene.Node... nodes) {
        HBox group = new HBox(0, nodes);
        group.getStyleClass().add("dungeon-control-group");
        group.setAlignment(Pos.CENTER_LEFT);
        group.setMaxWidth(USE_PREF_SIZE);
        return group;
    }

    private static Button actionButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("toolbar-action-button");
        button.setMinWidth(USE_PREF_SIZE);
        return button;
    }

    private static ToggleButton toolToggle(String text) {
        ToggleButton button = new ToggleButton(text);
        button.getStyleClass().add(TOOL_BUTTON_STYLE);
        button.setMinWidth(USE_PREF_SIZE);
        return button;
    }

    private static Button toolButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add(TOOL_BUTTON_STYLE);
        button.setMinWidth(USE_PREF_SIZE);
        return button;
    }

    private static Label mutedLabel(String text) {
        Label label = new Label(text == null ? "" : text);
        label.getStyleClass().add("text-muted");
        return label;
    }

    private static DungeonEditorControlsContentModel.@Nullable MapItem resolveSelected(
            List<DungeonEditorControlsContentModel.MapItem> maps,
            String selectedKey
    ) {
        for (DungeonEditorControlsContentModel.MapItem item : maps) {
            if (Objects.equals(item.key(), selectedKey)) {
                return item;
            }
        }
        return null;
    }

    private static void selectOverlayMode(
            ComboBox<DungeonEditorControlsContentModel.OverlayModeOption> modeSelector,
            String modeKey
    ) {
        for (DungeonEditorControlsContentModel.OverlayModeOption option : modeSelector.getItems()) {
            if (option.key().equals(modeKey)) {
                modeSelector.setValue(option);
                return;
            }
        }
        if (!modeSelector.getItems().isEmpty()) {
            modeSelector.setValue(modeSelector.getItems().get(0));
        }
    }

    private static String selectedOverlayModeKey(
            ComboBox<DungeonEditorControlsContentModel.OverlayModeOption> modeSelector
    ) {
        DungeonEditorControlsContentModel.OverlayModeOption option = modeSelector.getValue();
        return option == null ? "" : option.key();
    }

    private static void markSelected(Button button, String selectedTool, String label) {
        boolean selected = label.equals(selectedTool);
        if (selected && !button.getStyleClass().contains(STYLE_SELECTED)) {
            button.getStyleClass().add(STYLE_SELECTED);
        }
        if (!selected) {
            button.getStyleClass().remove(STYLE_SELECTED);
        }
        button.setAccessibleText(button.getText() + (selected ? " aktiv" : " inaktiv"));
    }
}
