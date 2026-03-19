package features.world.quarantine.dungeonmap.editor.workspace;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.workspace.pane.AbstractDungeonPane;
import features.world.quarantine.dungeonmap.editor.workspace.graph.DungeonGraphPane;
import features.world.quarantine.dungeonmap.editor.workspace.grid.DungeonGridPane;
import features.world.quarantine.dungeonmap.canvas.state.DungeonViewState;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;

import java.util.List;
import java.util.function.Consumer;

final class DungeonEditorPaneGroup {

    private final DungeonGridPane gridPane;
    private DungeonGraphPane graphPane;
    private DungeonViewMode visibleViewMode = DungeonViewMode.GRID;
    private DungeonViewState currentViewState;
    private DungeonLayoutRenderData currentRenderData;
    private CorridorDoorHandle selectedCorridorDoorHandle;
    private DungeonEditorTool editorTool = DungeonEditorTool.SELECT;
    private boolean editable = true;
    private boolean gridDirty = true;
    private boolean graphDirty = true;

    DungeonEditorPaneGroup(DungeonGridPane gridPane) {
        this.gridPane = gridPane;
    }

    public void attachGraphPane(DungeonGraphPane graphPane) {
        this.graphPane = graphPane;
        this.graphDirty = true;
    }

    public void forEach(Consumer<AbstractDungeonPane> action) {
        panes().forEach(action);
    }

    public void setEditable(boolean editable) {
        this.editable = editable;
        active().setEditable(editable);
        markHiddenPaneDirty();
    }

    public void showLayout(
            DungeonViewState viewState,
            DungeonLayoutRenderData renderData
    ) {
        this.currentViewState = viewState;
        this.currentRenderData = renderData;
        syncLayout(active(), false);
        markSynced(active());
        markHiddenPaneDirty();
    }

    public void updateSelection(DungeonViewState viewState, DungeonViewMode viewMode) {
        this.currentViewState = viewState;
        this.visibleViewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        active().updateSelection(viewState, true);
        markSynced(active());
        markHiddenPaneDirty();
    }

    public void setVisibleViewMode(DungeonViewMode viewMode) {
        visibleViewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        syncIfDirty(active());
        boolean showGrid = visibleViewMode == DungeonViewMode.GRID;
        setVisible(gridPane, showGrid);
        if (graphPane != null) {
            setVisible(graphPane, !showGrid);
        }
        active().toFront();
    }

    public void refreshActiveViewport() {
        active().refreshViewport();
    }

    public void setEditorTool(DungeonEditorTool editorTool) {
        this.editorTool = editorTool == null ? DungeonEditorTool.SELECT : editorTool;
        active().setEditorTool(this.editorTool);
        markSynced(active());
        markHiddenPaneDirty();
    }

    public void setSelectedCorridorDoorHandle(CorridorDoorHandle handle) {
        this.selectedCorridorDoorHandle = handle;
        active().setSelectedCorridorDoorHandle(handle);
        markSynced(active());
        markHiddenPaneDirty();
    }

    public CorridorDoorHandle selectedCorridorDoorHandle() {
        return active().selectedCorridorDoorHandle();
    }

    public AbstractDungeonPane active(DungeonViewMode viewMode) {
        return viewMode == DungeonViewMode.GRAPH && graphPane != null ? graphPane : gridPane;
    }

    private AbstractDungeonPane active() {
        return active(visibleViewMode);
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
        return graphPane == null ? List.of(gridPane) : List.of(gridPane, graphPane);
    }

    private void syncIfDirty(AbstractDungeonPane pane) {
        if (!isDirty(pane)) {
            return;
        }
        pane.setEditable(editable);
        syncLayout(pane, false);
        pane.setEditorTool(editorTool);
        pane.setSelectedCorridorDoorHandle(selectedCorridorDoorHandle);
        markSynced(pane);
    }

    private void syncLayout(AbstractDungeonPane pane, boolean renderNow) {
        pane.showLayout(currentViewState, currentRenderData, renderNow);
    }

    private void markHiddenPaneDirty() {
        if (graphPane == null) {
            gridDirty = true;
            return;
        }
        if (active() == gridPane) {
            graphDirty = true;
            return;
        }
        gridDirty = true;
    }

    private boolean isDirty(AbstractDungeonPane pane) {
        return pane == gridPane || graphPane == null ? gridDirty : graphDirty;
    }

    private void markSynced(AbstractDungeonPane pane) {
        if (pane == gridPane || graphPane == null) {
            gridDirty = false;
            return;
        }
        graphDirty = false;
    }

    private static void setVisible(AbstractDungeonPane pane, boolean visible) {
        if (pane == null) {
            return;
        }
        pane.setVisible(visible);
        pane.setManaged(visible);
    }
}
