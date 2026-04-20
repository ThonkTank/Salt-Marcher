package src.view.leftbartabs.dungeoneditor;

import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel;

public final class DungeonEditorControlsView extends VBox {

    private static final String SELECT_TOOL = "Auswahl";
    private static final String ROOM_TOOL = "Raum";
    private static final String WALL_TOOL = "Wand";
    private static final String DOOR_TOOL = "Tuer";
    private static final String CORRIDOR_TOOL = "Korridor";
    private static final String STAIR_TOOL = "Treppe";
    private static final String TRANSITION_TOOL = "Uebergang";

    private final ComboBox<String> mapSelector = new ComboBox<>();
    private final Button createButton = new Button("Neuen Dungeon");
    private final Button editButton = new Button("Dungeon bearbeiten");
    private final Label statusLabel = new Label();
    private final Label levelLabel = new Label("Ebene z=0");
    private final Button previousLevelButton = new Button("Ebene -");
    private final Button nextLevelButton = new Button("Ebene +");
    private final ToggleButton gridButton = toolToggle(DungeonMapDisplayModel.ViewMode.GRID.label());
    private final ToggleButton graphButton = toolToggle(DungeonMapDisplayModel.ViewMode.GRAPH.label());
    private final ToggleButton selectButton = toolToggle(SELECT_TOOL);
    private final Button roomButton = toolButton(ROOM_TOOL);
    private final Button wallButton = toolButton(WALL_TOOL);
    private final Button doorButton = toolButton(DOOR_TOOL);
    private final Button corridorButton = toolButton(CORRIDOR_TOOL);
    private final Button stairButton = toolButton(STAIR_TOOL);
    private final Button transitionButton = toolButton(TRANSITION_TOOL);
    private final Button overlayButton = new Button();
    private final Popup overlayPopup = new Popup();
    private final ToggleGroup viewModeGroup = new ToggleGroup();
    private final ToggleGroup toolGroup = new ToggleGroup();
    private Consumer<DungeonMapDisplayModel.ViewMode> onViewModeChanged = ignored -> {};
    private Consumer<String> onToolChanged = ignored -> {};
    private Consumer<DungeonMapDisplayModel.OverlayMode> onOverlayModeChanged = ignored -> {};

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonEditorControlsView() {
        getStyleClass().addAll("surface-root", "dungeon-editor-toolbar");
        setSpacing(10);
        setPadding(new Insets(12));
        setFillWidth(true);
        configureMapControls();
        configureViewModeControls();
        configureToolControls();
        configureOverlayPopup();
        getChildren().addAll(mapSection(), toolSection());
    }

    public void onRefresh(Runnable action) {
        createButton.setOnAction(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    public void onViewModeChanged(Consumer<DungeonMapDisplayModel.ViewMode> action) {
        onViewModeChanged = action == null ? ignored -> {} : action;
    }

    public void onToolChanged(Consumer<String> action) {
        onToolChanged = action == null ? ignored -> {} : action;
    }

    public void onPreviousLevel(Runnable action) {
        previousLevelButton.setOnAction(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    public void onNextLevel(Runnable action) {
        nextLevelButton.setOnAction(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    public void onOverlayModeChanged(Consumer<DungeonMapDisplayModel.OverlayMode> action) {
        onOverlayModeChanged = action == null ? ignored -> {} : action;
    }

    public void showLevel(int level) {
        levelLabel.setText("Ebene z=" + level);
    }

    public void showStatus(String statusText) {
        statusLabel.setText(statusText == null ? "" : statusText);
    }

    public void showViewMode(DungeonMapDisplayModel.ViewMode viewMode) {
        if (viewMode == DungeonMapDisplayModel.ViewMode.GRAPH) {
            graphButton.setSelected(true);
        } else {
            gridButton.setSelected(true);
        }
    }

    public void showTool(String tool) {
        String selectedTool = tool == null || tool.isBlank() ? SELECT_TOOL : tool;
        selectButton.setSelected(SELECT_TOOL.equals(selectedTool));
        markSelected(roomButton, ROOM_TOOL.equals(selectedTool));
        markSelected(wallButton, WALL_TOOL.equals(selectedTool));
        markSelected(doorButton, DOOR_TOOL.equals(selectedTool));
        markSelected(corridorButton, CORRIDOR_TOOL.equals(selectedTool));
        markSelected(stairButton, STAIR_TOOL.equals(selectedTool));
        markSelected(transitionButton, TRANSITION_TOOL.equals(selectedTool));
    }

    public void showOverlayMode(DungeonMapDisplayModel.OverlayMode overlayMode) {
        DungeonMapDisplayModel.OverlayMode resolved =
                overlayMode == null ? DungeonMapDisplayModel.OverlayMode.OFF : overlayMode;
        overlayButton.setText(resolved.label());
    }

    private void configureMapControls() {
        mapSelector.getItems().setAll("Gefrorene Krypta", "Verlassener Schacht", "Mondgrab");
        mapSelector.getSelectionModel().selectFirst();
        mapSelector.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(mapSelector, Priority.ALWAYS);
        statusLabel.getStyleClass().add("text-muted");
        statusLabel.setWrapText(true);
        previousLevelButton.getStyleClass().add("toolbar-action-button");
        nextLevelButton.getStyleClass().add("toolbar-action-button");
        overlayButton.getStyleClass().addAll("toolbar-action-button", "dungeon-overlay-trigger");
        overlayButton.setOnAction(event -> toggleOverlayPopup(overlayButton));
    }

    private void configureViewModeControls() {
        gridButton.setToggleGroup(viewModeGroup);
        graphButton.setToggleGroup(viewModeGroup);
        gridButton.setSelected(true);
        viewModeGroup.selectedToggleProperty().addListener((ignored, oldToggle, newToggle) -> {
            if (newToggle == null) {
                if (oldToggle != null) {
                    oldToggle.setSelected(true);
                }
                return;
            }
            onViewModeChanged.accept(newToggle == graphButton
                    ? DungeonMapDisplayModel.ViewMode.GRAPH
                    : DungeonMapDisplayModel.ViewMode.GRID);
        });
    }

    private void configureToolControls() {
        selectButton.setToggleGroup(toolGroup);
        selectButton.setSelected(true);
        selectButton.setOnAction(event -> selectTool(SELECT_TOOL));
        roomButton.setOnAction(event -> selectTool(ROOM_TOOL));
        wallButton.setOnAction(event -> selectTool(WALL_TOOL));
        doorButton.setOnAction(event -> selectTool(DOOR_TOOL));
        corridorButton.setOnAction(event -> selectTool(CORRIDOR_TOOL));
        stairButton.setOnAction(event -> selectTool(STAIR_TOOL));
        transitionButton.setOnAction(event -> selectTool(TRANSITION_TOOL));
    }

    private void configureOverlayPopup() {
        VBox content = new VBox(6);
        content.setPadding(new Insets(8));
        content.getStyleClass().addAll("filter-dropdown", "dungeon-overlay-dropdown");
        content.getChildren().addAll(
                overlayOption("Aus", DungeonMapDisplayModel.OverlayMode.OFF),
                overlayOption("Nachbarn", DungeonMapDisplayModel.OverlayMode.NEARBY),
                overlayOption("Auswahl", DungeonMapDisplayModel.OverlayMode.SELECTED));
        overlayPopup.getContent().setAll(content);
        overlayPopup.setAutoHide(true);
        overlayPopup.addEventFilter(KeyEvent.KEY_PRESSED, event -> {
            if (event.getCode() == KeyCode.ESCAPE) {
                overlayPopup.hide();
                event.consume();
            }
        });
    }

    private VBox mapSection() {
        HBox mapRow = new HBox(8, mapSelector, createButton, editButton, gridButton, graphButton);
        mapRow.setAlignment(Pos.CENTER_LEFT);
        HBox levelRow = new HBox(8, levelLabel, previousLevelButton, nextLevelButton, spacer(), overlayButton);
        levelRow.setAlignment(Pos.CENTER_LEFT);
        VBox group = new VBox(6, sectionLabel("Dungeon"), mapRow, statusLabel, levelRow);
        group.getStyleClass().add("editor-toolbar-group");
        return group;
    }

    private VBox toolSection() {
        HBox row = new HBox(6, selectButton, roomButton, wallButton, doorButton, corridorButton, stairButton, transitionButton);
        row.setAlignment(Pos.CENTER_LEFT);
        VBox group = new VBox(6, sectionLabel("Werkzeug"), row);
        group.getStyleClass().add("editor-toolbar-group");
        return group;
    }

    private Button overlayOption(String label, DungeonMapDisplayModel.OverlayMode mode) {
        Button button = new Button(label);
        button.getStyleClass().add("tool-btn");
        button.setMaxWidth(Double.MAX_VALUE);
        button.setOnAction(event -> {
            onOverlayModeChanged.accept(mode);
            overlayPopup.hide();
        });
        return button;
    }

    private void selectTool(String tool) {
        showTool(tool);
        onToolChanged.accept(tool);
    }

    private void toggleOverlayPopup(Node anchor) {
        if (overlayPopup.isShowing()) {
            overlayPopup.hide();
            return;
        }
        var bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        if (bounds != null) {
            overlayPopup.show(anchor, bounds.getMinX(), bounds.getMaxY() + 2.0);
        }
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
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

    private static Region spacer() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        return spacer;
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
}
