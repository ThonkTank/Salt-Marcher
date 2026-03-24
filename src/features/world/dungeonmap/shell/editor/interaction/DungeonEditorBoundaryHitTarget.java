package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;

import java.util.Objects;

public record DungeonEditorBoundaryHitTarget(
        DungeonEditorBoundaryRef targetRef,
        VertexEdge edge,
        InternalBoundaryType boundaryType,
        long priority
) implements DungeonEditorHitTarget {

    public DungeonEditorBoundaryHitTarget {
        targetRef = Objects.requireNonNull(targetRef, "targetRef");
        edge = Objects.requireNonNull(edge, "edge");
        boundaryType = boundaryType == null ? InternalBoundaryType.WALL : boundaryType;
    }

    @Override
    public String targetKey() {
        return RoomCluster.targetKey(targetRef.clusterId());
    }

    @Override
    public Long clusterId() {
        return targetRef.clusterId();
    }
}
