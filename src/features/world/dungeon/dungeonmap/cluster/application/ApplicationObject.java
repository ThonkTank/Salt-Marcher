package features.world.dungeon.dungeonmap.cluster.application;

import java.sql.Connection;
import java.sql.SQLException;

/**
 * Public root owner object for cluster mutation workflows.
 */
public final class ApplicationObject {

    private final features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService workflows;

    public ApplicationObject(
            features.world.dungeon.dungeonmap.application.DungeonMapApplicationService mapApplicationService,
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository,
            features.world.dungeon.dungeonmap.cluster.repository.DungeonClusterRepository clusterRepository,
            features.world.dungeon.dungeonmap.DungeonMapObject mapObject
    ) {
        this.workflows = new features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService(
                mapApplicationService,
                mapRepository,
                clusterRepository,
                mapObject);
    }

    public void rewriteSurface(ClusterSurfaceRewriteRequest request) throws SQLException {
        workflows.rewriteSurface(new features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterSurfaceRewriteRequest(
                request.mapId(),
                request.levelZ(),
                request.cells(),
                switch (request.mode()) {
                    case PAINT -> features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterSurfaceRewriteMode.PAINT;
                    case DELETE -> features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterSurfaceRewriteMode.DELETE;
                }));
    }

    public void editFloor(ClusterFloorEditRequest request) throws SQLException {
        workflows.editFloor(new features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterFloorEditRequest(
                request.mapId(),
                request.levelZ(),
                request.cells(),
                switch (request.mode()) {
                    case ADD -> features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterFloorEditMode.ADD;
                    case REMOVE -> features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterFloorEditMode.REMOVE;
                }));
    }

    public void editBoundary(ClusterBoundaryEditRequest request) throws SQLException {
        workflows.editBoundary(new features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterBoundaryEditRequest(
                request.mapId(),
                request.clusterId(),
                request.levelZ(),
                request.segments(),
                switch (request.target()) {
                    case WALL -> features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterBoundaryTarget.WALL;
                    case INTERIOR_DOOR -> features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterBoundaryTarget.INTERIOR_DOOR;
                    case EXTERIOR_DOOR -> features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterBoundaryTarget.EXTERIOR_DOOR;
                },
                switch (request.mode()) {
                    case CREATE -> features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterBoundaryEditMode.CREATE;
                    case DELETE -> features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterBoundaryEditMode.DELETE;
                }));
    }

    public void moveCluster(ClusterMoveRequest request) throws SQLException {
        workflows.moveCluster(new features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterMoveRequest(
                request.mapId(),
                request.clusterId(),
                request.translation()));
    }

    public void moveDoor(ClusterDoorMoveRequest request) throws SQLException {
        workflows.moveDoor(new features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterDoorMoveRequest(
                request.mapId(),
                request.clusterId(),
                request.levelZ(),
                request.sourceBoundarySegment(),
                request.targetBoundarySegment()));
    }

    public void bootstrapDefaultCluster(Connection conn, ClusterBootstrapRequest request) throws SQLException {
        workflows.bootstrapDefaultCluster(
                conn,
                new features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService.ClusterBootstrapRequest(
                        request.mapId(),
                        request.levelZ(),
                        request.cells(),
                        request.roomName()));
    }

    public record ClusterSurfaceRewriteRequest(
            long mapId,
            int levelZ,
            features.world.dungeon.geometry.GridArea cells,
            ClusterSurfaceRewriteMode mode
    ) {
    }

    public record ClusterFloorEditRequest(
            long mapId,
            int levelZ,
            features.world.dungeon.geometry.GridArea cells,
            ClusterFloorEditMode mode
    ) {
    }

    public record ClusterBoundaryEditRequest(
            long mapId,
            long clusterId,
            int levelZ,
            features.world.dungeon.geometry.GridBoundary segments,
            ClusterBoundaryTarget target,
            ClusterBoundaryEditMode mode
    ) {
    }

    public record ClusterMoveRequest(
            long mapId,
            long clusterId,
            features.world.dungeon.geometry.GridTranslation translation
    ) {
    }

    public record ClusterDoorMoveRequest(
            long mapId,
            long clusterId,
            int levelZ,
            features.world.dungeon.geometry.GridSegment sourceBoundarySegment,
            features.world.dungeon.geometry.GridSegment targetBoundarySegment
    ) {
    }

    public record ClusterBootstrapRequest(
            long mapId,
            int levelZ,
            features.world.dungeon.geometry.GridArea cells,
            String roomName
    ) {
        public ClusterBootstrapRequest(long mapId) {
            this(mapId, 0, features.world.dungeon.geometry.GridPoint.cell(0, 0, 0).cellFootprint(), "Raum 1");
        }
    }

    public enum ClusterSurfaceRewriteMode {
        PAINT,
        DELETE
    }

    public enum ClusterFloorEditMode {
        ADD,
        REMOVE
    }

    public enum ClusterBoundaryTarget {
        WALL,
        INTERIOR_DOOR,
        EXTERIOR_DOOR
    }

    public enum ClusterBoundaryEditMode {
        CREATE,
        DELETE
    }
}
