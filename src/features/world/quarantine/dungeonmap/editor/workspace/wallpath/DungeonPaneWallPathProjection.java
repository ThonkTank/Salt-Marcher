package features.world.quarantine.dungeonmap.editor.workspace.wallpath;

import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterVertexRef;

import java.util.List;

public interface DungeonPaneWallPathProjection {

    DungeonPaneWallPathProjection UNSUPPORTED = new DungeonPaneWallPathProjection() {
        @Override
        public List<DungeonClusterVertexRef> findClusterVerticesNear(double screenX, double screenY) {
            return List.of();
        }

        @Override
        public DungeonClusterVertexRef findClusterVertexNear(long clusterId, double screenX, double screenY) {
            return null;
        }
    };

    List<DungeonClusterVertexRef> findClusterVerticesNear(double screenX, double screenY);

    DungeonClusterVertexRef findClusterVertexNear(long clusterId, double screenX, double screenY);
}
