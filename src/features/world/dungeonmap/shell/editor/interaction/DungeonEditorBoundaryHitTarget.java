package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.persistence.ClusterBoundaryWrite;

import java.util.Objects;

public record DungeonEditorBoundaryHitTarget(
        DungeonEditorTargetRef.BoundaryRef targetRef,
        VertexEdge edge,
        ClusterBoundaryWrite.Type boundaryType,
        long priority
) implements DungeonEditorHitTarget {

    public DungeonEditorBoundaryHitTarget {
        targetRef = Objects.requireNonNull(targetRef, "targetRef");
        edge = Objects.requireNonNull(edge, "edge");
        boundaryType = boundaryType == null ? ClusterBoundaryWrite.Type.WALL : boundaryType;
    }

    @Override
    public String targetKey() {
        return features.world.dungeonmap.model.structures.cluster.RoomCluster.targetKey(targetRef.clusterId());
    }
}
