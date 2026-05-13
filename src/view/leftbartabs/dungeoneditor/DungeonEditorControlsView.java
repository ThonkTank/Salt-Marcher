package src.view.leftbartabs.dungeoneditor;

import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelViewInputEvent;

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
    static final String TOOL_BUTTON_STYLE = "tool-btn";

    private Consumer<DungeonEditorControlsViewInputEvent> viewInputEventHandler = ignored -> { };
    private final DungeonEditorControlsEvents events = new DungeonEditorControlsEvents(event -> viewInputEventHandler.accept(event));
    private final DungeonEditorMapControlsView mapControls = new DungeonEditorMapControlsView(this, events);
    private final DungeonEditorProjectionControlsView projectionControls = new DungeonEditorProjectionControlsView(this, events);
    private final DungeonEditorToolControlsView toolControls = new DungeonEditorToolControlsView(this, events);

    public DungeonEditorControlsView() {
        super("");
        DungeonEditorControlsFxAccess.addStyle(this, "control-toolbar");
        super.onViewInputEvent(this::handleDungeonControlInput);
        setFillWidth(true);
        getChildren().setAll(mapControls.row(), projectionControls.row(), toolControls.row());
    }

    public void onViewInputEvent(Consumer<DungeonEditorControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(DungeonEditorControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        mapControls.bind(contentModel.mapControlsContentModel());
        projectionControls.bind(contentModel.projectionControlsContentModel());
        toolControls.bind(contentModel.toolControlsContentModel());
    }

    private void handleDungeonControlInput(DungeonControlPanelViewInputEvent event) {
        if (event == null || event.overlay() == null) {
            return;
        }
        events.overlayInput(event.overlay());
    }

    HBox controlsRow(Node... nodes) {
        return compactControlRow(nodes);
    }

    HBox controlsGroup(Node... nodes) {
        return compactControlGroup(nodes);
    }

    void describeNode(Node node, String description) {
        describe(node, description);
    }

    Region rowSpacer() {
        return spacer();
    }

    Label newSectionLabel(String text) {
        return sectionLabel(text);
    }

}
