package src.view.mapshared.View;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.IntConsumer;
import java.util.function.Supplier;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import src.view.mapshared.ViewModel.MapCellViewModel;
import src.view.mapshared.ViewModel.MapViewport;
import src.view.mapshared.ViewModel.MapWorkspaceRenderModel;

public final class MapWorkspaceSession {

    private final MapWorkspaceView view;
    private final Supplier<Node> node;

    private MapWorkspaceSession(MapWorkspaceView view) {
        this.view = Objects.requireNonNull(view, "view");
        this.node = () -> this.view;
    }

    public static MapWorkspaceSession create() {
        return new MapWorkspaceSession(new MapWorkspaceView());
    }

    public Node node() {
        return Objects.requireNonNull(node.get(), "node");
    }

    public void show(MapWorkspaceRenderModel renderModel) {
        view.show(renderModel);
    }

    public MapViewport currentViewport() {
        return view.currentViewport();
    }

    public void setCellSelectionListener(Consumer<MapCellViewModel> listener) {
        view.setCellSelectionListener(listener);
    }

    public void setViewportListener(Consumer<MapViewport> listener) {
        view.setViewportListener(listener);
    }

    public void setFloorStepListener(IntConsumer listener) {
        view.setFloorStepListener(listener);
    }

    public void setSelectedTarget(@Nullable String ownerKind, long ownerId, @Nullable String partKind) {
        view.setSelectedTarget(ownerKind, ownerId, partKind);
    }

}
