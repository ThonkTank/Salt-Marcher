package src.view.dungeonmap.api;

import javafx.scene.Node;
import javafx.scene.layout.Pane;
import src.view.dungeonmap.View.DungeonControlsPanel;
import src.view.mapcanvas.api.MapCanvasCallbacks;
import src.view.mapcanvas.api.MapCanvasFactory;
import src.view.mapcanvas.api.MapCanvasHandle;
import src.view.mapcanvas.api.MapCanvasRenderModel;
import src.view.mapcanvas.api.MapCanvasScene;

public final class DungeonMapFactory {

    private DungeonMapFactory() {
    }

    public static DungeonMapHandle createEditor(DungeonSelectionPublisher selectionPublisher) {
        return createEditor(
                selectionPublisher,
                DungeonControlsExtensions.empty(),
                DungeonMapCanvasExtensions.empty());
    }

    public static DungeonMapHandle createEditor(
            DungeonSelectionPublisher selectionPublisher,
            DungeonControlsExtensions controlsExtensions,
            DungeonMapCanvasExtensions canvasExtensions
    ) {
        DungeonEditorRuntimeNodes nodes = DungeonEditorRuntimeNodes.create(
                selectionPublisher,
                controlsExtensions,
                canvasExtensions);
        return new DungeonMapHandle(nodes.controls(), nodes.workspace(), nodes.state(), null);
    }

    public static DungeonMapHandle createTravel(DungeonSelectionPublisher selectionPublisher) {
        return createTravel(
                selectionPublisher,
                DungeonControlsExtensions.empty(),
                DungeonMapCanvasExtensions.empty());
    }

    public static DungeonMapHandle createTravel(
            DungeonSelectionPublisher selectionPublisher,
            DungeonControlsExtensions controlsExtensions,
            DungeonMapCanvasExtensions canvasExtensions
    ) {
        DungeonTravelRuntimeSession session = DungeonTravelRuntimeSession.create(
                selectionPublisher,
                controlsExtensions,
                canvasExtensions);
        return new DungeonMapHandle(session.controls(), session.workspace(), session.state(), null);
    }

    public static DungeonMapHandle create(
            DungeonMapViewModelContract viewModel,
            DungeonMapCanvasExtensions canvasExtensions,
            DungeonControlsExtensions controlsExtensions,
            DungeonMapMode mode
    ) {
        DungeonControlsExtensions controls = controlsExtensions == null
                ? DungeonControlsExtensions.empty()
                : controlsExtensions;
        DungeonMapCanvasExtensions canvas = canvasExtensions == null
                ? DungeonMapCanvasExtensions.empty()
                : canvasExtensions;
        DungeonControlsPanel panel = new DungeonControlsPanel(
                mode == DungeonMapMode.TRAVEL ? DungeonControlsPanel.Mode.TRAVEL : DungeonControlsPanel.Mode.EDITOR,
                viewModel,
                () -> new DungeonViewportViewModel(0.0, 0.0, 960.0, 640.0, 1.0),
                null);
        setIfPresent(panel::setMapRowActions, controls.mapRowActions().get());
        setIfPresent(panel::setModeControls, controls.modeControls().get());
        setIfPresent(panel::setSecondaryActions, controls.secondaryActions().get());
        setIfPresent(panel::setFooterContent, controls.footerContent().get());

        MapCanvasHandle canvasHandle = MapCanvasFactory.create(
                emptyRenderModel(mode),
                MapCanvasCallbacks.none(),
                canvas.layers());
        return new DungeonMapHandle(panel, canvasHandle.node(), new Pane(), canvasHandle);
    }

    private static void setIfPresent(NodeSlot slot, Node node) {
        if (node != null) {
            slot.set(node);
        }
    }

    private static MapCanvasRenderModel emptyRenderModel(DungeonMapMode mode) {
        return new MapCanvasRenderModel(
                mode == DungeonMapMode.TRAVEL ? "Dungeon Travel" : "Dungeon Editor",
                "",
                mode == null ? "" : mode.name(),
                "",
                "",
                false,
                "",
                MapCanvasScene.empty());
    }

    @FunctionalInterface
    private interface NodeSlot {
        void set(Node node);
    }
}
