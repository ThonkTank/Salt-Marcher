package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.connection.LocalConnection;
import features.world.dungeonmap.model.structures.corridor.Corridor;

import java.util.Objects;

public record DungeonEditorConnectionHitTarget(
        Connection connection,
        VertexEdge edge,
        long priority
) implements DungeonEditorHitTarget {

    public DungeonEditorConnectionHitTarget {
        connection = Objects.requireNonNull(connection, "connection");
        edge = Objects.requireNonNull(edge, "edge");
    }

    @Override
    public String targetKey() {
        if (connection.kind() == ConnectionKind.LOCAL && connection instanceof LocalConnection localConnection) {
            return RoomCluster.targetKey(localConnection.clusterId());
        }
        if (connection.kind() == ConnectionKind.CORRIDOR && connection instanceof CorridorConnection corridorConnection) {
            return Corridor.targetKey(corridorConnection.corridorId());
        }
        return "";
    }

    @Override
    public Long clusterId() {
        if (connection instanceof LocalConnection localConnection) {
            return localConnection.clusterId();
        }
        return null;
    }

    public boolean editableAsLocalConnection() {
        return connection instanceof LocalConnection;
    }

    public LocalConnection localConnection() {
        return connection instanceof LocalConnection localConnection ? localConnection : null;
    }
}
