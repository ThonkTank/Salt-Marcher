package features.world.quarantine.dungeonmap.editor.workspace.pane;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.canvas.state.DungeonViewState;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLocation;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;

import java.util.Objects;
import java.util.function.Supplier;

record DungeonSceneSnapshot(
        DungeonLayout layout,
        DungeonLayoutRenderData renderData,
        DungeonSelection selectedTarget,
        DungeonRuntimeLocation activeLocation
) {}

public final class DungeonPaneSceneState {

    private DungeonSceneSnapshot snapshot;
    private Supplier<Long> hoveredCorridorId;

    public void setHoveredCorridorIdSupplier(Supplier<Long> hoveredCorridorId) {
        this.hoveredCorridorId = hoveredCorridorId;
    }

    public void setLayoutState(
            DungeonViewState viewState,
            DungeonLayoutRenderData renderData
    ) {
        if (viewState == null && renderData == null) {
            this.snapshot = null;
            return;
        }
        this.snapshot = new DungeonSceneSnapshot(
                viewState == null ? null : viewState.layout(),
                renderData,
                viewState == null ? null : viewState.selectedTarget(),
                viewState == null ? null : viewState.activeLocation()
        );
    }

    public DungeonLayout layout() {
        return snapshot == null ? null : snapshot.layout();
    }

    public DungeonLayoutRenderData renderData() {
        return snapshot == null ? null : snapshot.renderData();
    }

    public DungeonSelection selectedTarget() {
        return snapshot == null ? null : snapshot.selectedTarget();
    }

    public DungeonRuntimeLocation activeLocation() {
        return snapshot == null ? null : snapshot.activeLocation();
    }

    public boolean layoutPresent() {
        return snapshot != null && snapshot.layout() != null;
    }

    public DungeonRoomCluster clusterById(long clusterId) {
        return snapshot == null ? null : snapshot.layout() == null ? null : snapshot.layout().findCluster(clusterId);
    }

    public boolean isSelected(DungeonRoomCluster cluster) {
        if (snapshot == null) return false;
        return cluster != null
                && cluster.clusterId() != null
                && snapshot.selectedTarget() != null
                && snapshot.selectedTarget().selectsRoomCluster(cluster.clusterId());
    }

    public boolean isSelected(DungeonCorridor corridor) {
        if (snapshot == null) return false;
        return corridor != null
                && corridor.corridorId() != null
                && snapshot.selectedTarget() != null
                && snapshot.selectedTarget().selectsCorridor(corridor.corridorId());
    }

    public boolean isActive(DungeonRoom room) {
        if (snapshot == null) return false;
        return room != null
                && room.roomId() != null
                && snapshot.activeLocation() != null
                && snapshot.activeLocation().matchesRoom(room.roomId());
    }

    public boolean isActive(DungeonCorridor corridor) {
        if (snapshot == null || corridor == null || corridor.corridorId() == null || snapshot.activeLocation() == null) {
            return false;
        }
        if (snapshot.activeLocation() instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent) {
            return snapshot.renderData() != null
                    && Objects.equals(corridorComponent.componentId(), snapshot.renderData().corridorComponentId(corridor.corridorId()));
        }
        return snapshot.activeLocation().matchesCorridor(corridor.corridorId());
    }

    public boolean isActive(DungeonRoomCluster cluster) {
        if (snapshot == null || cluster == null || cluster.clusterId() == null || snapshot.activeLocation() == null) {
            return false;
        }
        return false;
    }

    public boolean isHovered(DungeonCorridor corridor) {
        return corridor != null
                && corridor.corridorId() != null
                && hoveredCorridorId != null
                && Objects.equals(hoveredCorridorId.get(), corridor.corridorId());
    }
}
