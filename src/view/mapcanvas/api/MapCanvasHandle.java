package src.view.mapcanvas.api;

import src.view.mapcanvas.View.MapWorkspaceView;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.IntConsumer;
import java.util.function.Supplier;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import src.view.mapcanvas.api.MapCanvasCell;
import src.view.mapcanvas.api.MapCanvasViewport;
import src.view.mapcanvas.api.MapCanvasRenderModel;

public final class MapCanvasHandle {

    private final MapWorkspaceView view;
    private final Supplier<Node> node;

    private MapCanvasHandle(MapWorkspaceView view) {
        this.view = Objects.requireNonNull(view, "view");
        this.node = () -> this.view;
    }

    public static MapCanvasHandle create() {
        return new MapCanvasHandle(new MapWorkspaceView());
    }

    static MapCanvasHandle create(MapWorkspaceView view) {
        return new MapCanvasHandle(view);
    }

    public Node node() {
        return Objects.requireNonNull(node.get(), "node");
    }

    public void show(MapCanvasRenderModel renderModel) {
        view.show(renderModel);
    }

    public void setLayerContent(MapCanvasLayer layer, Collection<? extends Node> nodes) {
        view.setLayerContent(layer, nodes);
    }

    public void setLayerContent(MapCanvasLayer layer, Node... nodes) {
        view.setLayerContent(layer, nodes == null ? List.of() : List.of(nodes));
    }

    public void setLayers(MapCanvasLayers layers) {
        MapCanvasLayers resolved = layers == null ? MapCanvasLayers.empty() : layers;
        setLayerContent(MapCanvasLayer.BELOW_GRID, resolved.belowGrid());
        setLayerContent(MapCanvasLayer.BELOW_CONTENT, resolved.belowContent());
        setLayerContent(MapCanvasLayer.ABOVE_CONTENT, resolved.aboveContent());
        setLayerContent(MapCanvasLayer.SELECTION_OVERLAY, resolved.selectionOverlay());
        setLayerContent(MapCanvasLayer.ACTOR_OVERLAY, resolved.actorOverlay());
        setLayerContent(MapCanvasLayer.TOOL_OVERLAY, resolved.toolOverlay());
        setLayerContent(MapCanvasLayer.HUD_OVERLAY, resolved.hudOverlay());
    }

    public void setCallbacks(MapCanvasCallbacks callbacks) {
        MapCanvasCallbacks resolved = callbacks == null ? MapCanvasCallbacks.none() : callbacks;
        setCellSelectionListener(resolved.cellSelectionListener());
        setViewportListener(resolved.viewportListener());
        setFloorStepListener(resolved.floorStepListener());
    }

    public MapCanvasViewport currentViewport() {
        return view.currentViewport();
    }

    public void setCellSelectionListener(Consumer<MapCanvasCell> listener) {
        view.setCellSelectionListener(listener);
    }

    public void setViewportListener(Consumer<MapCanvasViewport> listener) {
        view.setViewportListener(listener);
    }

    public void setFloorStepListener(IntConsumer listener) {
        view.setFloorStepListener(listener);
    }

    public void setSelectedTarget(@Nullable String ownerKind, long ownerId, @Nullable String partKind) {
        view.setSelectedTarget(ownerKind, ownerId, partKind);
    }

}
