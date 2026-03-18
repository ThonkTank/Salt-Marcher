package features.world.dungeonmap.editor.workspace.ui.base;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.view.model.DungeonViewState;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.corridors.model.DungeonCorridorTopologyPlanner;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.view.model.DungeonRuntimeLocation;
import features.world.dungeonmap.view.model.DungeonSelection;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;

import java.util.Objects;

public final class DungeonPaneSceneState {

    private DungeonLayout layout;
    private DungeonLayoutRenderData renderData;
    private DungeonSelection selectedTarget;
    private DungeonRuntimeLocation activeLocation;
    private DungeonCorridorTopologyPlanner.LayoutContext corridorLayoutContext;

    public void setLayoutState(
            DungeonViewState viewState,
            DungeonLayoutRenderData renderData
    ) {
        this.layout = viewState == null ? null : viewState.layout();
        this.renderData = renderData;
        this.selectedTarget = viewState == null ? null : viewState.selectedTarget();
        this.activeLocation = viewState == null ? null : viewState.activeLocation();
        this.corridorLayoutContext = renderData == null ? null : renderData.layoutContext();
    }

    public DungeonLayout layout() {
        return layout;
    }

    public DungeonLayoutRenderData renderData() {
        return renderData;
    }

    public DungeonSelection selectedTarget() {
        return selectedTarget;
    }

    public DungeonRuntimeLocation activeLocation() {
        return activeLocation;
    }

    public DungeonCorridorTopologyPlanner.LayoutContext corridorLayoutContext() {
        return corridorLayoutContext;
    }

    public boolean layoutPresent() {
        return layout != null;
    }

    public DungeonRoomCluster clusterById(long clusterId) {
        return layout == null ? null : layout.clusterById(clusterId);
    }

    public boolean isSelected(DungeonRoomCluster cluster) {
        return cluster != null
                && cluster.clusterId() != null
                && selectedTarget != null
                && selectedTarget.selectsRoomCluster(cluster.clusterId());
    }

    public boolean isSelected(DungeonCorridor corridor) {
        return corridor != null
                && corridor.corridorId() != null
                && selectedTarget != null
                && selectedTarget.selectsCorridor(corridor.corridorId());
    }

    public boolean isActive(DungeonRoom room) {
        return room != null
                && room.roomId() != null
                && activeLocation != null
                && activeLocation.matchesRoom(room.roomId());
    }

    public boolean isActive(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null || activeLocation == null) {
            return false;
        }
        if (activeLocation instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent) {
            return renderData != null
                    && Objects.equals(corridorComponent.componentId(), renderData.corridorComponentId(corridor.corridorId()));
        }
        return activeLocation.matchesCorridor(corridor.corridorId());
    }

    public boolean isActive(DungeonRoomCluster cluster) {
        if (cluster == null || cluster.clusterId() == null || activeLocation == null) {
            return false;
        }
        return false;
    }
}
