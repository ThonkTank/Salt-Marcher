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
import javafx.scene.control.Menu;
import javafx.scene.control.MenuButton;
import javafx.scene.control.MenuItem;
import javafx.scene.control.RadioMenuItem;
import javafx.scene.control.SeparatorMenuItem;
import javafx.scene.control.SplitMenuButton;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;
import src.view.slotcontent.controls.dungeoncontrol.DungeonLevelOverlayControlsView;

public final class DungeonEditorControlsView extends DungeonControlPanelView {

    static final String VIEW_GRID = "Grid";
    static final String VIEW_GRAPH = "Graph";
    static final String SELECT_TOOL = "Auswahl";
    static final String ROOM_PAINT_TOOL = "Raum malen";
    static final String ROOM_DELETE_TOOL = "Raum loeschen";
    static final String WALL_CREATE_TOOL = "Wand setzen";
    static final String WALL_DELETE_TOOL = "Wand loeschen";
    static final String DOOR_CREATE_TOOL = "Tuer setzen";
    static final String DOOR_DELETE_TOOL = "Tuer loeschen";
    static final String CORRIDOR_CREATE_TOOL = "Korridor erstellen";
    static final String CORRIDOR_DELETE_TOOL = "Korridor loeschen";
    static final String STAIR_CREATE_TOOL = "Treppe erstellen";
    static final String STAIR_DELETE_TOOL = "Treppe loeschen";
    static final String TRANSITION_CREATE_TOOL = "Uebergang erstellen";
    static final String TRANSITION_DELETE_TOOL = "Uebergang loeschen";

    private static final String ROOM_FAMILY = "Raum";
    private static final String WALL_FAMILY = "Wand";
    private static final String DOOR_FAMILY = "Tuer";
    private static final String CORRIDOR_FAMILY = "Korridor";
    private static final String STAIR_FAMILY = "Treppe";
    private static final String TRANSITION_FAMILY = "Uebergang";

    private final ComboBox<MapItem> mapSelector = new ComboBox<>();
    private final SplitMenuButton mapActionButton = new SplitMenuButton();
    private final MenuItem editMapItem = new MenuItem("Dungeon bearbeiten");
    private final MenuItem deleteMapItem = new MenuItem("Dungeon loeschen");
    private final Label statusLabel = new Label();
    private final Label levelLabel = new Label("Ebene z=0");
    private final Button previousLevelButton = new Button("-");
    private final Button nextLevelButton = new Button("+");
    private final ToggleButton gridButton = toolToggle(VIEW_GRID);
    private final ToggleButton graphButton = toolToggle(VIEW_GRAPH);
    private final ToggleButton selectButton = toolToggle(SELECT_TOOL);
    private final MenuButton toolMenuButton = new MenuButton("Werkzeug: " + SELECT_TOOL);
    private final RadioMenuItem roomPaintItem = toolMenuItem(ROOM_PAINT_TOOL);
    private final RadioMenuItem roomDeleteItem = toolMenuItem(ROOM_DELETE_TOOL);
    private final RadioMenuItem wallCreateItem = toolMenuItem(WALL_CREATE_TOOL);
    private final RadioMenuItem wallDeleteItem = toolMenuItem(WALL_DELETE_TOOL);
    private final RadioMenuItem doorCreateItem = toolMenuItem(DOOR_CREATE_TOOL);
    private final RadioMenuItem doorDeleteItem = toolMenuItem(DOOR_DELETE_TOOL);
    private final RadioMenuItem corridorCreateItem = toolMenuItem(CORRIDOR_CREATE_TOOL);
    private final RadioMenuItem corridorDeleteItem = toolMenuItem(CORRIDOR_DELETE_TOOL);
    private final RadioMenuItem stairCreateItem = toolMenuItem(STAIR_CREATE_TOOL);
    private final RadioMenuItem stairDeleteItem = toolMenuItem(STAIR_DELETE_TOOL);
    private final RadioMenuItem transitionCreateItem = toolMenuItem(TRANSITION_CREATE_TOOL);
    private final RadioMenuItem transitionDeleteItem = toolMenuItem(TRANSITION_DELETE_TOOL);
    private final DungeonLevelOverlayControlsView overlayControls =
            new DungeonLevelOverlayControlsView(this::sectionLabel);
    private final ToggleGroup viewModeGroup = new ToggleGroup();
    private final ToggleGroup toolGroup = new ToggleGroup();
    private final Popup mapEditorPopup = new Popup();
    private final Label mapEditorTitle = new Label();
    private final TextField mapNameField = new TextField();
    private final Label mapEditorError = new Label();
    private final Button cancelMapEditButton = new Button("Abbrechen");
    private final Button saveMapButton = new Button("Speichern");
    private HBox deleteConfirmRow;
    private HBox mapEditorActionRow;
    private Consumer<String> onMapSelected = ignored -> {};
    private Consumer<String> onCreateMap = ignored -> {};
    private Consumer<MapNameRequest> onRenameMap = ignored -> {};
    private Consumer<String> onDeleteMap = ignored -> {};
    private Consumer<String> onViewModeChanged = ignored -> {};
    private Consumer<String> onToolChanged = ignored -> {};
    private boolean syncingMaps;
    private boolean syncingViewMode;
    private boolean createMode;
    private boolean deleteMode;
    private String editingMapKey = "";

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonEditorControlsView() {
        super("");
        getStyleClass().add("dungeon-editor-toolbar");
        setFillWidth(true);
        configureMapControls();
        configureViewModeControls();
        configureToolControls();
        configureMapEditorPopup();
        getChildren().setAll(dungeonRow(), projectionRow(), toolRow());
    }

    public void setOnMapSelected(Consumer<String> action) {
        onMapSelected = action == null ? ignored -> {} : action;
    }

    public void setOnCreateMap(Consumer<String> action) {
        onCreateMap = action == null ? ignored -> {} : action;
    }

    public void setOnRenameMap(Consumer<MapNameRequest> action) {
        onRenameMap = action == null ? ignored -> {} : action;
    }

    public void setOnDeleteMap(Consumer<String> action) {
        onDeleteMap = action == null ? ignored -> {} : action;
    }

    public void onViewModeChanged(Consumer<String> action) {
        onViewModeChanged = action == null ? ignored -> {} : action;
    }

    public void onToolChanged(Consumer<String> action) {
        onToolChanged = action == null ? ignored -> {} : action;
    }

    public void onPreviousLevel(Runnable action) {
        bindAction(previousLevelButton, action);
    }

    public void onNextLevel(Runnable action) {
        bindAction(nextLevelButton, action);
    }

    public DungeonLevelOverlayControlsView levelOverlayControls() {
        return overlayControls;
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

    public void showOverlaySettings(DungeonLevelOverlayControlsView.Settings settings, boolean disabled) {
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
        roomPaintItem.setSelected(ROOM_PAINT_TOOL.equals(selectedTool));
        roomDeleteItem.setSelected(ROOM_DELETE_TOOL.equals(selectedTool));
        wallCreateItem.setSelected(WALL_CREATE_TOOL.equals(selectedTool));
        wallDeleteItem.setSelected(WALL_DELETE_TOOL.equals(selectedTool));
        doorCreateItem.setSelected(DOOR_CREATE_TOOL.equals(selectedTool));
        doorDeleteItem.setSelected(DOOR_DELETE_TOOL.equals(selectedTool));
        corridorCreateItem.setSelected(CORRIDOR_CREATE_TOOL.equals(selectedTool));
        corridorDeleteItem.setSelected(CORRIDOR_DELETE_TOOL.equals(selectedTool));
        stairCreateItem.setSelected(STAIR_CREATE_TOOL.equals(selectedTool));
        stairDeleteItem.setSelected(STAIR_DELETE_TOOL.equals(selectedTool));
        transitionCreateItem.setSelected(TRANSITION_CREATE_TOOL.equals(selectedTool));
        transitionDeleteItem.setSelected(TRANSITION_DELETE_TOOL.equals(selectedTool));
        toolMenuButton.setText("Werkzeug: " + toolSummary(selectedTool));
        toolMenuButton.setAccessibleText("Aktives Werkzeug: " + selectedTool);
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
                onMapSelected.accept(after.key());
            }
        });
        mapActionButton.setText("Neu");
        mapActionButton.getItems().setAll(editMapItem, deleteMapItem);
        mapActionButton.getStyleClass().addAll("toolbar-action-button", "dungeon-toolbar-menu");
        mapActionButton.setMinWidth(Region.USE_PREF_SIZE);
        mapActionButton.setOnAction(event -> showCreatePopup(mapActionButton));
        editMapItem.setOnAction(event -> showEditPopup(mapActionButton));
        deleteMapItem.setOnAction(event -> showDeletePopup(mapActionButton));
        describe(mapActionButton, "Neuen Dungeon erstellen; weitere Dungeon-Aktionen im Menue");
        statusLabel.getStyleClass().add("text-muted");
        statusLabel.setWrapText(false);
        statusLabel.setVisible(false);
        statusLabel.setManaged(false);
        statusLabel.setMinWidth(0.0);
        statusLabel.setMaxWidth(160.0);
        previousLevelButton.getStyleClass().add("toolbar-action-button");
        nextLevelButton.getStyleClass().add("toolbar-action-button");
        levelLabel.getStyleClass().add("text-muted");
        describe(previousLevelButton, "Vorherige Dungeon-Ebene anzeigen");
        describe(nextLevelButton, "Naechste Dungeon-Ebene anzeigen");
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
            onViewModeChanged.accept(newToggle == graphButton ? VIEW_GRAPH : VIEW_GRID);
        });
    }

    private void configureToolControls() {
        selectButton.setToggleGroup(toolGroup);
        selectButton.setSelected(true);
        selectButton.setOnAction(event -> selectTool(SELECT_TOOL));
        toolMenuButton.getStyleClass().addAll("tool-btn", "dungeon-tool-menu-button");
        toolMenuButton.setMinWidth(Region.USE_PREF_SIZE);
        describe(selectButton, "Auswahlwerkzeug aktivieren");
        describe(toolMenuButton, "Editor-Werkzeug aus gruppiertem Menue waehlen");
        bindToolItem(roomPaintItem, ROOM_PAINT_TOOL);
        bindToolItem(roomDeleteItem, ROOM_DELETE_TOOL);
        bindToolItem(wallCreateItem, WALL_CREATE_TOOL);
        bindToolItem(wallDeleteItem, WALL_DELETE_TOOL);
        bindToolItem(doorCreateItem, DOOR_CREATE_TOOL);
        bindToolItem(doorDeleteItem, DOOR_DELETE_TOOL);
        bindToolItem(corridorCreateItem, CORRIDOR_CREATE_TOOL);
        bindToolItem(corridorDeleteItem, CORRIDOR_DELETE_TOOL);
        bindToolItem(stairCreateItem, STAIR_CREATE_TOOL);
        bindToolItem(stairDeleteItem, STAIR_DELETE_TOOL);
        bindToolItem(transitionCreateItem, TRANSITION_CREATE_TOOL);
        bindToolItem(transitionDeleteItem, TRANSITION_DELETE_TOOL);
        toolMenuButton.getItems().setAll(
                toolFamilyMenu(ROOM_FAMILY, roomPaintItem, roomDeleteItem),
                toolFamilyMenu(WALL_FAMILY, wallCreateItem, wallDeleteItem),
                toolFamilyMenu(DOOR_FAMILY, doorCreateItem, doorDeleteItem),
                new SeparatorMenuItem(),
                toolFamilyMenu(CORRIDOR_FAMILY, corridorCreateItem, corridorDeleteItem),
                toolFamilyMenu(STAIR_FAMILY, stairCreateItem, stairDeleteItem),
                toolFamilyMenu(TRANSITION_FAMILY, transitionCreateItem, transitionDeleteItem));
    }

    private void configureMapEditorPopup() {
        mapEditorTitle.getStyleClass().add("dropdown-title");
        mapEditorError.getStyleClass().add("text-warning");
        mapEditorError.setWrapText(true);
        mapEditorError.setManaged(false);
        mapEditorError.setVisible(false);

        Button cancelDeleteButton = new Button("Abbrechen");
        Button confirmDeleteButton = new Button("Loeschen");
        Label deleteLabel = new Label("Dungeon loeschen?");
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

        VBox panel = new VBox(10, mapEditorTitle, mapNameField, mapEditorError, deleteConfirmRow, actionRow);
        panel.setPadding(new Insets(10));
        panel.getStyleClass().addAll("dropdown-window", "dropdown-form");
        mapEditorPopup.getContent().setAll(panel);
        mapEditorPopup.setAutoHide(true);
        mapEditorPopup.addEventFilter(KeyEvent.KEY_PRESSED, event -> {
            if (event.getCode() == KeyCode.ESCAPE) {
                mapEditorPopup.hide();
                event.consume();
            }
        });
        cancelMapEditButton.setOnAction(event -> mapEditorPopup.hide());
        cancelDeleteButton.setOnAction(event -> {
            if (deleteMode) {
                mapEditorPopup.hide();
            } else {
                showDeleteConfirmation(false);
            }
        });
        confirmDeleteButton.setOnAction(event -> {
            onDeleteMap.accept(editingMapKey);
            mapEditorPopup.hide();
        });
        saveMapButton.setOnAction(event -> submitMapEditor());
        mapNameField.setOnAction(event -> submitMapEditor());
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
        HBox row = compactControlRow(selectButton, toolMenuButton);
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
        editingMapKey = "";
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
        editingMapKey = selected.key();
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
        editingMapKey = selected.key();
        mapEditorTitle.setText("Dungeon loeschen: " + selected.mapName());
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
        var bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        if (bounds != null) {
            mapEditorPopup.show(anchor, bounds.getMinX(), bounds.getMaxY() + 2.0);
            if (mapNameField.isVisible()) {
                mapNameField.requestFocus();
                mapNameField.selectAll();
            }
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
            onCreateMap.accept(mapName);
        } else {
            onRenameMap.accept(new MapNameRequest(editingMapKey, mapName));
        }
        mapEditorPopup.hide();
    }

    private void showDeleteConfirmation(boolean visible) {
        deleteConfirmRow.setVisible(visible);
        deleteConfirmRow.setManaged(visible);
    }

    private void selectTool(String tool) {
        String selectedTool = normalizeTool(tool);
        showTool(selectedTool);
        onToolChanged.accept(selectedTool);
    }

    private void bindToolItem(RadioMenuItem item, String tool) {
        item.setToggleGroup(toolGroup);
        item.setOnAction(event -> selectTool(tool));
    }

    private static Menu toolFamilyMenu(String label, RadioMenuItem primary, RadioMenuItem secondary) {
        Menu menu = new Menu(label);
        menu.getItems().setAll(primary, secondary);
        return menu;
    }

    private static ToggleButton toolToggle(String text) {
        ToggleButton button = new ToggleButton(text);
        button.getStyleClass().add("tool-btn");
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }

    private static RadioMenuItem toolMenuItem(String text) {
        return new RadioMenuItem(text);
    }

    private static String normalizeTool(String tool) {
        String selectedTool = tool == null || tool.isBlank() ? SELECT_TOOL : tool;
        return isKnownTool(selectedTool) ? selectedTool : SELECT_TOOL;
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

    private static String toolSummary(String tool) {
        return SELECT_TOOL.equals(tool) ? SELECT_TOOL : tool;
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
