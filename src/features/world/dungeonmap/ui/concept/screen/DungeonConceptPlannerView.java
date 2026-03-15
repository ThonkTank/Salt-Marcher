package features.world.dungeonmap.ui.concept.screen;

import features.world.dungeonmap.service.DungeonConceptCommandService;
import features.world.dungeonmap.service.DungeonConceptQueryService;
import features.world.dungeonmap.service.DungeonMapCommandService;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.ui.concept.canvas.DungeonConceptPane;
import features.world.dungeonmap.ui.concept.chrome.DungeonConceptStatePane;
import features.world.dungeonmap.ui.concept.state.DungeonConceptEditorState;
import features.world.dungeonmap.ui.concept.workflow.DungeonConceptController;
import features.world.dungeonmap.ui.editor.chrome.map.DungeonMapControlsPane;
import javafx.scene.Node;
import javafx.scene.control.ScrollPane;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

public final class DungeonConceptPlannerView implements AppView {

    private final DungeonMapControlsPane controls = new DungeonMapControlsPane();
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
        return controls;
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
        statePane.setOnConnectionAddRequested(controller::addLevelConnection);
        statePane.setOnConnectionRemoveRequested(controller::removeLevelConnection);

        pane.setOnNodeSelected(controller::handleNodeSelected);
        pane.setOnBackgroundSelected(controller::clearSelection);
        pane.setOnLayoutSettled(controller::persistNodePositions);
    }

    private ScrollPane createStateScrollPane() {
        ScrollPane scrollPane = new ScrollPane(statePane);
        scrollPane.getStyleClass().add("dungeon-editor-sidebar-scroll");
        scrollPane.setFitToWidth(true);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        return scrollPane;
    }
}
