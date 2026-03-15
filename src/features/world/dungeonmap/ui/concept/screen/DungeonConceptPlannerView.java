package features.world.dungeonmap.ui.concept.screen;

import features.world.dungeonmap.service.DungeonConceptCommandService;
import features.world.dungeonmap.service.DungeonConceptQueryService;
import features.world.dungeonmap.service.DungeonMapCommandService;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.ui.concept.canvas.DungeonConceptPane;
import features.world.dungeonmap.ui.concept.chrome.DungeonConceptStatePane;
import features.world.dungeonmap.ui.concept.state.DungeonConceptEditorState;
import features.world.dungeonmap.ui.concept.state.DungeonConceptTool;
import features.world.dungeonmap.ui.concept.workflow.DungeonConceptController;
import features.world.dungeonmap.ui.shared.map.DungeonEditorToolbar;
import features.world.dungeonmap.ui.shared.map.DungeonMapControlsPane;
import javafx.scene.Node;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

public final class DungeonConceptPlannerView implements AppView {

    // Concept and raster mode intentionally point at the same dungeon selection controls.
    private final DungeonMapControlsPane controls = new DungeonMapControlsPane();
    private final DungeonEditorToolbar toolbar = new DungeonEditorToolbar(controls);
    private final DungeonConceptPane pane = new DungeonConceptPane();
    private final DungeonConceptStatePane statePane = new DungeonConceptStatePane();
    private final ScrollPane stateScrollPane = createStateScrollPane();
    private final DungeonConceptEditorState state = new DungeonConceptEditorState();
    private final DungeonConceptController controller;

    public DungeonConceptPlannerView(
            DetailsNavigator detailsNavigator,
            DungeonMapQueryService mapQueries,
            DungeonMapCommandService mapCommands,
            DungeonConceptQueryService conceptQueries,
            DungeonConceptCommandService conceptCommands
    ) {
        controller = new DungeonConceptController(
                state,
                controls,
                pane,
                statePane,
                mapQueries,
                mapCommands,
                conceptQueries,
                conceptCommands,
                detailsNavigator);
        buildToolRow();
        bind();
    }

    @Override
    public Node getMainContent() {
        return pane;
    }

    @Override
    public String getTitle() {
        return "Dungeoneditor";
    }

    @Override
    public String getIconText() {
        return "\u25a6";
    }

    @Override
    public Node getControlsContent() {
        return toolbar;
    }

    @Override
    public Node getStateContent() {
        return stateScrollPane;
    }

    @Override
    public void onShow() {
        controller.onShow();
    }

    public Long currentMapId() {
        return controller.currentMapId();
    }

    public void setPreferredMapId(Long mapId) {
        controller.setPreferredMapId(mapId);
        controls.selectMap(mapId);
    }

    private void bind() {
        controls.setOnMapSelected(controller::handleMapSelected);
        controls.setOnNewMapRequested(controller::showNewMapDropdown);
        controls.setOnEditMapRequested(controller::showEditMapDropdown);

        statePane.setOnLevelCountChanged(controller::handleLevelCountChanged);
        statePane.setOnPartySizeChanged(controller::handlePartySizeChanged);
        statePane.setOnActiveLevelSelected(controller::handleActiveLevelSelected);
        statePane.setOnLevelPlanChanged(controller::handleLevelPlanChanged);
        statePane.setOnConnectionCreateRequested(controller::createLevelConnection);
        statePane.setOnConnectionDeleteRequested(controller::deleteLevelConnection);

        pane.setOnNodeSelected(controller::handleNodeSelected);
        pane.setOnNodeDeleteRequested(controller::handleNodeDeleteRequested);
        pane.setOnBackgroundSelected(controller::clearSelection);
        pane.setOnLayoutSettled(controller::persistNodePositions);
        pane.setOnConnectionRequested(controller::handleGraphConnectionRequested);
        pane.setOnEdgeDeleteRequested(controller::handleGraphEdgeDeleteRequested);
        pane.setOnEdgeSplitRequested(controller::handleGraphEdgeSplitRequested);
        pane.setOnRoomCreateRequested(controller::handleCreateRoomNodeRequested);
    }

    private ScrollPane createStateScrollPane() {
        ScrollPane scrollPane = new ScrollPane(statePane);
        scrollPane.getStyleClass().add("dungeon-editor-sidebar-scroll");
        scrollPane.setFitToWidth(true);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        return scrollPane;
    }

    private void buildToolRow() {
        DungeonEditorToolbar.FlowGroup toolGroup = toolbar.createFlowGroup("Werkzeuge");
        ToggleGroup group = new ToggleGroup();
        for (DungeonConceptTool tool : DungeonConceptTool.values()) {
            ToggleButton button = new ToggleButton(tool.label());
            button.getStyleClass().add("tool-btn");
            button.setToggleGroup(group);
            button.setSelected(tool == DungeonConceptTool.SELECT);
            button.setOnAction(event -> {
                if (button.isSelected()) {
                    controller.handleActiveToolChanged(tool);
                }
            });
            toolGroup.flow().getChildren().add(button);
        }
        toolbar.setToolbarGroups(toolGroup.container());
        controller.handleActiveToolChanged(DungeonConceptTool.SELECT);
    }
}
