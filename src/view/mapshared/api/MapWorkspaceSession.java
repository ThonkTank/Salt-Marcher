package src.view.mapshared.api;

import java.util.function.Consumer;
import java.util.function.IntConsumer;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import src.view.mapshared.View.MapWorkspaceView;

public final class MapWorkspaceSession {

    private final MapWorkspaceView view;

    private MapWorkspaceSession(MapWorkspaceView view) {
        this.view = view;
    }

    public static MapWorkspaceSession create() {
        return new MapWorkspaceSession(new MapWorkspaceView());
    }

    public Node node() {
        return view;
    }

    public void show(MapWorkspaceRenderModel renderModel) {
        view.show(toViewModel(renderModel));
    }

    public MapViewport currentViewport() {
        return toApi(view.currentViewport());
    }

    public void setCellSelectionListener(Consumer<MapCellViewModel> listener) {
        view.setCellSelectionListener(cell -> listener.accept(new MapCellViewModel(
                cell.q(),
                cell.r(),
                cell.label(),
                cell.room(),
                cell.corridor(),
                cell.blocked(),
                cell.interactive(),
                cell.current(),
                cell.ownerKind(),
                cell.ownerId(),
                cell.partKind())));
    }

    public void setViewportListener(Consumer<MapViewport> listener) {
        view.setViewportListener(viewport -> listener.accept(toApi(viewport)));
    }

    public void setFloorStepListener(IntConsumer listener) {
        view.setFloorStepListener(listener);
    }

    public void setSelectedTarget(@Nullable String ownerKind, long ownerId, @Nullable String partKind) {
        view.setSelectedTarget(ownerKind, ownerId, partKind);
    }

    private static src.view.mapshared.ViewModel.MapWorkspaceRenderModel toViewModel(MapWorkspaceRenderModel model) {
        MapWorkspaceRenderModel resolved = model == null
                ? new MapWorkspaceRenderModel("Dungeon Map", "", "", "", "", false, "", MapWorkspaceSceneViewData.empty())
                : model;
        return new src.view.mapshared.ViewModel.MapWorkspaceRenderModel(
                resolved.title(),
                resolved.subtitle(),
                resolved.modeLabel(),
                resolved.statusLabel(),
                resolved.summaryLabel(),
                resolved.mapLoaded(),
                resolved.overlayMessage(),
                toViewModel(resolved.scene()));
    }

    private static src.view.mapshared.ViewModel.MapWorkspaceSceneViewData toViewModel(MapWorkspaceSceneViewData scene) {
        MapWorkspaceSceneViewData resolved = scene == null ? MapWorkspaceSceneViewData.empty() : scene;
        return new src.view.mapshared.ViewModel.MapWorkspaceSceneViewData(
                resolved.topology(),
                resolved.cells().stream().map(MapWorkspaceSession::toViewModel).toList(),
                resolved.edges().stream().map(MapWorkspaceSession::toViewModel).toList());
    }

    private static src.view.mapshared.ViewModel.MapCellViewModel toViewModel(MapCellViewModel cell) {
        return new src.view.mapshared.ViewModel.MapCellViewModel(
                cell.q(),
                cell.r(),
                cell.label(),
                cell.room(),
                cell.corridor(),
                cell.blocked(),
                cell.interactive(),
                cell.current(),
                cell.ownerKind(),
                cell.ownerId(),
                cell.partKind());
    }

    private static src.view.mapshared.ViewModel.MapEdgeViewModel toViewModel(MapEdgeViewModel edge) {
        return new src.view.mapshared.ViewModel.MapEdgeViewModel(
                edge.fromQ(),
                edge.fromR(),
                edge.toQ(),
                edge.toR(),
                edge.kind(),
                edge.label(),
                edge.interactive(),
                edge.ownerKind(),
                edge.ownerId(),
                edge.partKind());
    }

    private static MapViewport toApi(src.view.mapshared.ViewModel.MapViewport viewport) {
        return new MapViewport(
                viewport.centerX(),
                viewport.centerY(),
                viewport.canvasWidth(),
                viewport.canvasHeight(),
                viewport.zoom());
    }

}
