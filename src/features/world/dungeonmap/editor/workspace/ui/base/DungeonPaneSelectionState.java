package features.world.dungeonmap.editor.workspace.ui.base;

import features.world.dungeonmap.view.model.DungeonViewState;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.view.model.DungeonRuntimeLocation;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;

import java.util.Objects;
import java.util.function.Supplier;

public final class DungeonPaneSelectionState {

    private DungeonViewState viewState;
    private DungeonLayoutRenderData renderData;
    private final Supplier<Long> hoveredCorridorId;

    public DungeonPaneSelectionState(Supplier<Long> hoveredCorridorId) {
        this.hoveredCorridorId = hoveredCorridorId;
    }

    public void setLayoutState(DungeonViewState viewState, DungeonLayoutRenderData renderData) {
        this.viewState = viewState;
        this.renderData = renderData;
    }

    public boolean isActive(DungeonRoom room) {
        DungeonRuntimeLocation activeLocation = viewState == null ? null : viewState.activeLocation();
        return room != null
                && room.roomId() != null
                && activeLocation != null
                && activeLocation.matchesRoom(room.roomId());
    }

    public boolean isSelected(DungeonRoomCluster cluster) {
        var selectedTarget = viewState == null ? null : viewState.selectedTarget();
        return cluster != null
                && cluster.clusterId() != null
                && selectedTarget != null
                && selectedTarget.selectsRoomCluster(cluster.clusterId());
    }

    public boolean isActive(DungeonRoomCluster cluster) {
        return false;
    }

    public boolean isSelected(DungeonCorridor corridor) {
        var selectedTarget = viewState == null ? null : viewState.selectedTarget();
        return corridor != null
                && corridor.corridorId() != null
                && selectedTarget != null
                && selectedTarget.selectsCorridor(corridor.corridorId());
    }

    public boolean isHovered(DungeonCorridor corridor) {
        return corridor != null
                && corridor.corridorId() != null
                && Objects.equals(hoveredCorridorId.get(), corridor.corridorId());
    }

    public boolean isActive(DungeonCorridor corridor) {
        DungeonRuntimeLocation activeLocation = viewState == null ? null : viewState.activeLocation();
        if (corridor == null || corridor.corridorId() == null || activeLocation == null) {
            return false;
        }
        if (activeLocation instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent) {
            return renderData != null
                    && Objects.equals(corridorComponent.componentId(), renderData.corridorComponentId(corridor.corridorId()));
        }
        return activeLocation.matchesCorridor(corridor.corridorId());
    }
}
