package features.world.dungeonmap.editor.workspace.ui;

import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonViewMode;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.workspace.ui.base.AbstractDungeonPane;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneInteractionSink;
import features.world.dungeonmap.editor.workspace.ui.graph.DungeonGraphPane;
import features.world.dungeonmap.editor.workspace.ui.grid.DungeonGridPane;
import features.world.dungeonmap.view.model.DungeonViewState;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;

import java.util.List;
import java.util.function.Consumer;

final class DungeonEditorPaneGroup {

    private final DungeonGridPane gridPane;
    private final DungeonGraphPane graphPane;

    DungeonEditorPaneGroup(DungeonGridPane gridPane, DungeonGraphPane graphPane) {
        this.gridPane = gridPane;
        this.graphPane = graphPane;
    }

    public void forEach(Consumer<AbstractDungeonPane> action) {
        panes().forEach(action);
    }

    public void setEditable(boolean editable) {
        gridPane.setEditable(editable);
        graphPane.setEditable(editable);
    }

    public void showLayout(
            DungeonViewState viewState,
            DungeonLayoutRenderData renderData
    ) {
        forEach(pane -> pane.showLayout(viewState, renderData, false));
    }

    public void updateSelection(DungeonViewState viewState, DungeonViewMode viewMode) {
        gridPane.updateSelection(viewState, viewMode == DungeonViewMode.GRID);
        graphPane.updateSelection(viewState, viewMode == DungeonViewMode.GRAPH);
    }

    public void setVisibleViewMode(DungeonViewMode viewMode) {
        boolean showGrid = viewMode == DungeonViewMode.GRID;
        setVisible(gridPane, showGrid);
        setVisible(graphPane, !showGrid);
        active(viewMode).toFront();
    }

    public void refreshViewport(DungeonViewMode viewMode) {
        active(viewMode).refreshViewport();
    }

    public void setEditorTool(DungeonEditorTool editorTool) {
        DungeonEditorTool nextTool = editorTool == null ? DungeonEditorTool.SELECT : editorTool;
        forEach(pane -> pane.setEditorTool(nextTool));
    }

    public void bindInteractionSinks(DungeonPaneInteractionSink gridSink, DungeonPaneInteractionSink graphSink) {
        gridPane.bindInteractionSink(gridSink);
        graphPane.bindInteractionSink(graphSink);
    }

    public void setSelectedCorridorDoorHandle(CorridorDoorHandle handle) {
        gridPane.setSelectedCorridorDoorHandle(handle);
        graphPane.setSelectedCorridorDoorHandle(handle);
    }

    public CorridorDoorHandle selectedCorridorDoorHandle() {
        return gridPane.selectedCorridorDoorHandle();
    }

    public AbstractDungeonPane active(DungeonViewMode viewMode) {
        return viewMode == DungeonViewMode.GRID ? gridPane : graphPane;
    }

    public void updateActiveSelection(
            DungeonViewMode viewMode,
            DungeonViewState viewState
    ) {
        if (viewMode == DungeonViewMode.GRID) {
            gridPane.updateSelection(viewState, true);
            return;
        }
        graphPane.updateSelection(viewState, true);
    }

    private List<AbstractDungeonPane> panes() {
        return List.of(gridPane, graphPane);
    }

    private static void setVisible(AbstractDungeonPane pane, boolean visible) {
        pane.setVisible(visible);
        pane.setManaged(visible);
    }
}
