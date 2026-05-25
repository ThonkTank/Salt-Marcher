package src.view.leftbartabs.dungeoneditor;

import java.util.Iterator;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableValue;
import javafx.geometry.Pos;
import javafx.scene.Node;
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
import javafx.scene.layout.Pane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;

public final class DungeonEditorControlsView extends VBox {

    private Consumer<DungeonEditorControlsViewInputEvent> viewInputEventHandler = ignored -> { };

    public DungeonEditorControlsView() {
        styled(this, "surface-root", "dungeon-control-panel", "control-toolbar");
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
        MapControls mapControls = new MapControls(rendering);
        MapEditorSection mapEditorSection = new MapEditorSection(rendering);
        ProjectionSection projectionSection = new ProjectionSection(contentModel, toolControls, rendering);
        ToolSection toolSection = new ToolSection(toolControls);

        replaceChildren(
                this,
                mapControls,
                mapEditorSection,
                projectionSection,
                projectionSection.overlayRow(),
                toolSection);

        mapControls.bind(contentModel);
        mapEditorSection.bind(contentModel);
        projectionSection.bind(contentModel);
        toolSection.bind(contentModel, toolControls);
    }

    private final class MapControls extends HBox {

        private final boolean[] rendering;
        private final ComboBox<Object> mapSelector = new ComboBox<>();
        private final SplitMenuButton mapActionButton =
                styled(new SplitMenuButton(), "toolbar-action-button", "dungeon-toolbar-menu");
        private final MenuItem editMapItem = new MenuItem("Dungeon bearbeiten");
        private final MenuItem deleteMapItem = new MenuItem("Dungeon löschen");
        private final Label statusLabel = mutedLabel("");

        private MapControls(boolean[] rendering) {
            this.rendering = rendering;
            styled(this, controlRowStyle(), "dungeon-control-map-row");
            setAlignment(Pos.CENTER_LEFT);
            setMaxWidth(Double.MAX_VALUE);
            replaceChildren(this, mapSelector, mapActionButton, statusLabel);
            configureMapSelector();
            configureMapActions();
            setHgrow(mapSelector, Priority.ALWAYS);
        }

        private void bind(DungeonEditorControlsContentModel contentModel) {
            contentModel.mapProjectionProperty().addListener((ignored, before, after) -> show(after));
            show(contentModel.mapProjectionProperty().get());
        }

        private void configureMapSelector() {
            mapSelector.setConverter(new MapItemStringConverter());
            mapSelector.setMaxWidth(Double.MAX_VALUE);
            mapSelector.setMinWidth(0.0);
            mapSelector.setPromptText("Dungeon auswählen");
            mapSelector.setAccessibleText("Dungeon auswählen");
            selectedItemProperty(mapSelector).addListener((ignored, before, after) -> {
                DungeonEditorControlsContentModel.MapItem selectedItem = asMapItem(after);
                if (!rendering[0] && selectedItem != null) {
                    emitMapSelection(selectedItem.mapId());
                }
            });
        }

        private void configureMapActions() {
            mapActionButton.setText("Neu");
            replaceMenuItems(mapActionButton, editMapItem, deleteMapItem);
            mapActionButton.setMinWidth(USE_PREF_SIZE);
            mapActionButton.setAccessibleText("Neuen Dungeon erstellen; weitere Dungeon-Aktionen im Menü");
            mapActionButton.setOnAction(event -> emitMapEditorInput(
                    rendering, "", true, false, false, false, false, false));
            editMapItem.setOnAction(event -> emitMapEditorInput(
                    rendering, "", false, true, false, false, false, false));
            deleteMapItem.setOnAction(event -> emitMapEditorInput(
                    rendering, "", false, false, true, false, false, false));
        }

        private void show(DungeonEditorControlsContentModel.MapProjection projection) {
            DungeonEditorControlsContentModel.MapProjection safeProjection = projection;
            List<DungeonEditorControlsContentModel.MapItem> safeMaps = safeProjection.maps();
            rendering[0] = true;
            replaceComboItems(mapSelector, safeMaps);
            selectMapItem(mapSelector, resolveSelected(safeMaps, safeProjection.selectedKey()));
            rendering[0] = false;
            mapSelector.setDisable(safeProjection.busy() || safeMaps.isEmpty());
            mapActionButton.setDisable(safeProjection.busy());
            boolean selectionMissing = selectedComboItem(mapSelector) == null;
            editMapItem.setDisable(safeProjection.busy() || selectionMissing);
            deleteMapItem.setDisable(safeProjection.busy() || selectionMissing);
            setTextVisibility(statusLabel, safeProjection.statusText(), !safeProjection.statusText().isBlank());
        }
    }

    private final class MapEditorSection extends VBox {

        private final boolean[] rendering;
        private final Label title = new Label();
        private final TextField draftField = new TextField();
        private final Label errorLabel = mutedLabel("");
        private final Button cancelButton = new Button("Abbrechen");
        private final Button saveButton = new Button("Speichern");
        private final Button confirmDeleteButton = new Button("Löschen");

        private MapEditorSection(boolean[] rendering) {
            this.rendering = rendering;
            styled(this, "dropdown-window", "dropdown-form", "dungeon-editor-popup");
            Label draftLabel = new Label("Name");
            draftLabel.setLabelFor(draftField);
            draftField.setAccessibleText("Dungeon-Name");
            replaceChildren(this, title, draftLabel, draftField, errorLabel, row(cancelButton, saveButton, confirmDeleteButton));
            setNodeVisibility(this, false);
        }

        private void bind(DungeonEditorControlsContentModel contentModel) {
            draftField.textProperty().addListener((ignored, before, after) ->
                    emitMapEditorInput(rendering, after, false, false, false, false, false, false));
            cancelButton.setOnAction(event -> emitMapEditorInput(
                    rendering, draftField.getText(), false, false, false, true, false, false));
            saveButton.setOnAction(event -> emitMapEditorInput(
                    rendering, draftField.getText(), false, false, false, false, true, false));
            confirmDeleteButton.setOnAction(event -> emitMapEditorInput(
                    rendering, draftField.getText(), false, false, false, false, false, true));
            contentModel.mapEditorProperty().addListener((ignored, before, after) -> show(after));
            show(contentModel.mapEditorProperty().get());
        }

        private void show(DungeonEditorControlsContentModel.MapEditorUiState state) {
            DungeonEditorControlsContentModel.MapEditorUiState resolvedState = state;
            setNodeVisibility(this, resolvedState.visible());
            title.setText(resolvedState.title());
            rendering[0] = true;
            draftField.setText(resolvedState.draftName());
            rendering[0] = false;
            setNodeVisibility(draftField, resolvedState.draftFieldVisible());
            setNodeVisibility(saveButton, resolvedState.submitVisible());
            saveButton.setText(resolvedState.submitLabel());
            setNodeVisibility(confirmDeleteButton, resolvedState.deleteConfirmationVisible());
            setTextVisibility(errorLabel, resolvedState.errorText(), !resolvedState.errorText().isBlank());
        }
    }

    private final class ProjectionSection extends HBox {

        private final boolean[] rendering;
        private final Label levelLabel = mutedLabel("Ebene z=0");
        private final Button previousLevelButton = actionButton("-");
        private final Button nextLevelButton = actionButton("+");
        private final ToggleButton gridButton;
        private final ToggleButton graphButton;
        private final Button overlayTrigger = actionButton("Overlay: Aus");
        private final ComboBox<Object> overlayModeSelector = new ComboBox<>();
        private final Spinner<Integer> overlayRangeSpinner = new Spinner<>(1, 6, 2);
        private final Slider overlayOpacitySlider = new Slider(10, 90, 35);
        private final Label overlayOpacityLabel = mutedLabel("35%");
        private final TextField selectedLevelsField = new TextField();
        private final HBox overlayRangeRow = row(new Label("Umfang"), overlayRangeSpinner);
        private final HBox selectedLevelsRow = row(new Label("Ebenen"), selectedLevelsField);
        private final HBox overlayRow;

        private ProjectionSection(
                DungeonEditorControlsContentModel contentModel,
                DungeonEditorControlsContentModel.ToolControls toolControls,
                boolean[] rendering
        ) {
            this.rendering = rendering;
            gridButton = toolToggle(toolControls.gridView());
            graphButton = toolToggle(toolControls.graphView());
            styled(this, controlRowStyle(), "dungeon-control-projection-row");
            setAlignment(Pos.CENTER_LEFT);
            setMaxWidth(Double.MAX_VALUE);
            replaceChildren(
                    this,
                    styled(group(levelLabel, previousLevelButton, nextLevelButton), "dungeon-stepper-group"),
                    styled(group(gridButton, graphButton), "dungeon-segment-group"));
            overlayRow = styled(
                    row(
                            overlayTrigger,
                            overlayModeSelector,
                            row(new Label("Staerke"), overlayOpacitySlider, overlayOpacityLabel),
                            overlayRangeRow,
                            selectedLevelsRow),
                    "dungeon-overlay-content");
            configureProjectionControls(toolControls);
            configureOverlayControls(contentModel);
        }

        private HBox overlayRow() {
            return overlayRow;
        }

        private void bind(DungeonEditorControlsContentModel contentModel) {
            contentModel.projectionProperty().addListener((ignored, before, after) -> show(after));
            show(contentModel.projectionProperty().get());
        }

        private void configureProjectionControls(DungeonEditorControlsContentModel.ToolControls toolControls) {
            ToggleGroup viewModeGroup = new ToggleGroup();
            previousLevelButton.setAccessibleText("Vorherige Dungeon-Ebene anzeigen");
            nextLevelButton.setAccessibleText("Nächste Dungeon-Ebene anzeigen");
            previousLevelButton.setOnAction(event -> emitProjectionShift(-1));
            nextLevelButton.setOnAction(event -> emitProjectionShift(1));
            gridButton.setToggleGroup(viewModeGroup);
            graphButton.setToggleGroup(viewModeGroup);
            gridButton.setSelected(true);
            viewModeGroup.selectedToggleProperty().addListener((ignored, oldToggle, newToggle) ->
                    handleViewModeChanged(rendering, oldToggle, newToggle, graphButton, gridButton, toolControls));
        }

        private void show(DungeonEditorControlsContentModel.ProjectionState projection) {
            DungeonEditorControlsContentModel.ProjectionState safeProjection = projection;
            levelLabel.setText("Ebene z=" + safeProjection.activeLevel());
            previousLevelButton.setDisable(safeProjection.busy() || !safeProjection.navigationEnabled());
            nextLevelButton.setDisable(safeProjection.busy() || !safeProjection.navigationEnabled());
            rendering[0] = true;
            graphButton.setSelected(safeProjection.graphViewSelected());
            gridButton.setSelected(!safeProjection.graphViewSelected());
            showOverlay(safeProjection.overlayPanelState());
            rendering[0] = false;
        }

        private void configureOverlayControls(DungeonEditorControlsContentModel contentModel) {
            replaceComboItems(overlayModeSelector, contentModel.overlayModeOptions());
            overlayRangeSpinner.setEditable(true);
            overlayOpacitySlider.setShowTickMarks(false);
            overlayOpacitySlider.setShowTickLabels(false);
            selectedLevelsField.setPromptText("-1, 1, 3");
            selectedLevelsField.setPrefColumnCount(10);
            overlayTrigger.setDisable(true);
            ChangeListener<Object> overlayListener = (ignored, before, after) -> emitCurrentOverlay();
            overlayModeSelector.valueProperty().addListener(overlayListener);
            overlayRangeSpinner.valueProperty().addListener(overlayListener);
            overlayOpacitySlider.valueProperty().addListener(overlayListener);
            selectedLevelsField.setOnAction(event -> emitCurrentOverlay());
        }

        private void showOverlay(DungeonEditorControlsContentModel.OverlayPanelState panelState) {
            overlayTrigger.setText(panelState.triggerText());
            selectOverlayMode(overlayModeSelector, panelState.modeKey());
            setSpinnerValue(overlayRangeSpinner, panelState.levelRange());
            overlayOpacitySlider.setValue(panelState.opacityPercent());
            overlayOpacityLabel.setText(panelState.opacityText());
            selectedLevelsField.setText(panelState.selectedLevelsText());
            overlayModeSelector.setDisable(panelState.controlsDisabled());
            overlayOpacitySlider.setDisable(panelState.controlsDisabled());
            setNodeVisibility(overlayRangeRow, panelState.rangeVisible());
            setNodeVisibility(selectedLevelsRow, panelState.selectedVisible());
            overlayRangeSpinner.setDisable(panelState.controlsDisabled() || !panelState.rangeVisible());
            selectedLevelsField.setDisable(panelState.controlsDisabled() || !panelState.selectedVisible());
        }

        private void emitCurrentOverlay() {
            emitOverlayInput(
                    rendering,
                    selectedOverlayModeKey(overlayModeSelector),
                    spinnerValue(overlayRangeSpinner),
                    overlayOpacitySlider.getValue() / 100.0,
                    selectedLevelsField.getText());
        }
    }

    private final class ToolSection extends HBox {

        private final ToggleButton selectButton;
        private final Button roomButton;
        private final Button roomDeleteButton;
        private final Button wallButton;
        private final Button wallDeleteButton;
        private final Button doorButton;
        private final Button doorDeleteButton;
        private final Button corridorButton;
        private final Button corridorDeleteButton;

        private ToolSection(DungeonEditorControlsContentModel.ToolControls toolControls) {
            selectButton = toolToggle(toolControls.select().label());
            roomButton = toolButton(toolControls.room().label());
            roomDeleteButton = toolButton(toolControls.roomDelete().label());
            wallButton = toolButton(toolControls.wall().label());
            wallDeleteButton = toolButton(toolControls.wallDelete().label());
            doorButton = toolButton(toolControls.door().label());
            doorDeleteButton = toolButton(toolControls.doorDelete().label());
            corridorButton = toolButton(toolControls.corridor().label());
            corridorDeleteButton = toolButton(toolControls.corridorDelete().label());
            styled(this, controlRowStyle(), "dungeon-control-tool-row");
            setAlignment(Pos.CENTER_LEFT);
            setMaxWidth(Double.MAX_VALUE);
            replaceChildren(
                    this,
                    selectButton,
                    roomButton,
                    roomDeleteButton,
                    wallButton,
                    wallDeleteButton,
                    doorButton,
                    doorDeleteButton,
                    corridorButton,
                    corridorDeleteButton);
            configureToolControls(toolControls);
        }

        private void bind(
                DungeonEditorControlsContentModel contentModel,
                DungeonEditorControlsContentModel.ToolControls toolControls
        ) {
            contentModel.toolProjectionProperty().addListener((ignored, before, after) -> show(after, toolControls));
            show(contentModel.toolProjectionProperty().get(), toolControls);
        }

        private void configureToolControls(DungeonEditorControlsContentModel.ToolControls toolControls) {
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

        private void show(
                DungeonEditorControlsContentModel.ToolProjection projection,
                DungeonEditorControlsContentModel.ToolControls toolControls
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
    }

    private void handleViewModeChanged(
            boolean[] rendering,
            Toggle oldToggle,
            Toggle newToggle,
            ToggleButton graphButton,
            ToggleButton gridButton,
            DungeonEditorControlsContentModel.ToolControls toolControls
    ) {
        if (rendering[0]) {
            return;
        }
        if (newToggle == null) {
            if (oldToggle != null) {
                oldToggle.setSelected(true);
            }
            return;
        }
        if (newToggle.equals(graphButton)) {
            emitViewMode(toolControls.graphView());
            return;
        }
        gridButton.setSelected(true);
        emitViewMode(toolControls.gridView());
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

    private static HBox row(Node... nodes) {
        HBox row = new HBox(6, nodes);
        styled(row, controlRowStyle());
        row.setAlignment(Pos.CENTER_LEFT);
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
    }

    private static String controlRowStyle() {
        return "dungeon-control-row";
    }

    private static HBox group(Node... nodes) {
        HBox group = new HBox(0, nodes);
        styled(group, "dungeon-control-group");
        group.setAlignment(Pos.CENTER_LEFT);
        group.setMaxWidth(USE_PREF_SIZE);
        return group;
    }

    private static Button actionButton(String text) {
        Button button = styled(new Button(text), "toolbar-action-button");
        button.setMinWidth(USE_PREF_SIZE);
        return button;
    }

    private static ToggleButton toolToggle(String text) {
        ToggleButton button = styled(new ToggleButton(text), "tool-btn");
        button.setMinWidth(USE_PREF_SIZE);
        return button;
    }

    private static Button toolButton(String text) {
        Button button = styled(new Button(text), "tool-btn");
        button.setMinWidth(USE_PREF_SIZE);
        return button;
    }

    private static Label mutedLabel(String text) {
        return styled(new Label(text == null ? "" : text), "text-muted");
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
            ComboBox<Object> modeSelector,
            String modeKey
    ) {
        for (Object item : comboItems(modeSelector)) {
            DungeonEditorControlsContentModel.OverlayModeOption option = asOverlayModeOption(item);
            if (option.key().equals(modeKey)) {
                modeSelector.setValue(option);
                return;
            }
        }
        DungeonEditorControlsContentModel.OverlayModeOption firstOption =
                asOverlayModeOption(firstComboItem(modeSelector));
        if (firstOption != null) {
            modeSelector.setValue(firstOption);
        }
    }

    private static String selectedOverlayModeKey(
            ComboBox<Object> modeSelector
    ) {
        DungeonEditorControlsContentModel.OverlayModeOption option = asOverlayModeOption(comboValue(modeSelector));
        return option == null ? "" : option.key();
    }

    private static void markSelected(Button button, String selectedTool, String label) {
        boolean selected = label.equals(selectedTool);
        setStyleClassPresence(button, "selected", selected);
        button.setAccessibleText(button.getText() + (selected ? " aktiv" : " inaktiv"));
    }

    private static void setTextVisibility(Label label, String text, boolean visible) {
        label.setText(text);
        setNodeVisibility(label, visible);
    }

    private static void setNodeVisibility(Node node, boolean visible) {
        node.setVisible(visible);
        node.setManaged(visible);
    }

    private static <T extends Node> T styled(T node, String... styleClasses) {
        node.getStyleClass().addAll(styleClasses);
        return node;
    }

    private static void setStyleClassPresence(Node node, String styleClass, boolean present) {
        if (present && !node.getStyleClass().contains(styleClass)) {
            node.getStyleClass().add(styleClass);
        }
        if (!present) {
            node.getStyleClass().remove(styleClass);
        }
    }

    private static void replaceChildren(Pane pane, Node... nodes) {
        pane.getChildren().setAll(nodes);
    }

    private static void replaceMenuItems(SplitMenuButton button, MenuItem... menuItems) {
        button.getItems().setAll(menuItems);
    }

    private static <T> void replaceComboItems(ComboBox<T> comboBox, List<? extends T> items) {
        comboBox.getItems().setAll(items);
    }

    private static <T> List<T> comboItems(ComboBox<T> comboBox) {
        return comboBox.getItems();
    }

    private static <T> @Nullable T firstComboItem(ComboBox<T> comboBox) {
        Iterator<T> items = comboItems(comboBox).iterator();
        return items.hasNext() ? items.next() : null;
    }

    private static <T> void selectMapItem(ComboBox<T> comboBox, @Nullable T selectedItem) {
        comboBox.getSelectionModel().select(selectedItem);
    }

    private static <T> @Nullable T selectedComboItem(ComboBox<T> comboBox) {
        return comboBox.getSelectionModel().getSelectedItem();
    }

    private static <T> ObservableValue<T> selectedItemProperty(ComboBox<T> comboBox) {
        return comboBox.getSelectionModel().selectedItemProperty();
    }

    private static void setSpinnerValue(Spinner<Integer> spinner, int value) {
        if (spinner.getValueFactory() != null) {
            spinner.getValueFactory().setValue(value);
        }
    }

    private static <T> @Nullable T comboValue(ComboBox<T> comboBox) {
        return comboBox.getValue();
    }

    private static int spinnerValue(Spinner<Integer> spinner) {
        Integer value = spinner.getValue();
        return value == null ? 0 : value;
    }

    private static DungeonEditorControlsContentModel.@Nullable MapItem asMapItem(@Nullable Object value) {
        return value instanceof DungeonEditorControlsContentModel.MapItem mapItem ? mapItem : null;
    }

    private static DungeonEditorControlsContentModel.@Nullable OverlayModeOption asOverlayModeOption(
            @Nullable Object value
    ) {
        return value instanceof DungeonEditorControlsContentModel.OverlayModeOption option ? option : null;
    }

    private static final class MapItemStringConverter
            extends StringConverter<Object> {

        @Override
        public String toString(Object item) {
            DungeonEditorControlsContentModel.MapItem mapItem = asMapItem(item);
            return mapItem == null ? "" : mapItem.mapName();
        }

        @Override
        public @Nullable Object fromString(String string) {
            return null;
        }
    }
}
