package features.world.dungeonmap.application.room;

import features.world.dungeonmap.persistence.ClusterGeometryWrite;
import features.world.dungeonmap.persistence.DungeonRoomGeometryWriteMapper;
import features.world.dungeonmap.persistence.DungeonRoomWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class RoomTopologyEditPlanApplier {

    private final DungeonRoomWriteRepository roomWriteRepository;
    private final DungeonRoomGeometryWriteMapper geometryWriteMapper;

    public RoomTopologyEditPlanApplier(
            DungeonRoomWriteRepository roomWriteRepository,
            DungeonRoomGeometryWriteMapper geometryWriteMapper
    ) {
        this.roomWriteRepository = Objects.requireNonNull(roomWriteRepository, "roomWriteRepository");
        this.geometryWriteMapper = Objects.requireNonNull(geometryWriteMapper, "geometryWriteMapper");
    }

    public void apply(Connection conn, RoomTopologyEditPlan plan) throws SQLException {
        if (plan instanceof CreateClusterRoomEditPlan createPlan) {
            applyCreate(conn, createPlan);
            return;
        }
        if (plan instanceof UpdateClusterRoomEditPlan updatePlan) {
            applyUpdate(conn, updatePlan);
            return;
        }
        if (plan instanceof DeleteClusterRoomEditPlan deletePlan) {
            roomWriteRepository.deleteCluster(conn, deletePlan.clusterId());
            return;
        }
        if (plan instanceof SplitClusterRoomEditPlan splitPlan) {
            applySplit(conn, splitPlan);
        }
    }

    private void applyCreate(Connection conn, CreateClusterRoomEditPlan plan) throws SQLException {
        ClusterGeometryWrite geometry = geometryWriteMapper.toClusterGeometry(plan.clusterShape());
        long clusterId = roomWriteRepository.insertCluster(conn, plan.mapId(), geometry);
        roomWriteRepository.insertRoom(conn, plan.mapId(), clusterId, plan.roomName(), plan.roomAnchor());
    }

    private void applyUpdate(Connection conn, UpdateClusterRoomEditPlan plan) throws SQLException {
        ClusterGeometryWrite geometry = geometryWriteMapper.toClusterGeometry(plan.clusterShape());
        roomWriteRepository.updateClusterGeometry(conn, plan.clusterId(), geometry);
        roomWriteRepository.updateRoomPosition(conn, plan.roomId(), plan.roomAnchor());
    }

    private void applySplit(Connection conn, SplitClusterRoomEditPlan plan) throws SQLException {
        roomWriteRepository.deleteCluster(conn, plan.sourceClusterId());
        for (SplitClusterFragmentPlan fragment : plan.fragments()) {
            ClusterGeometryWrite geometry = geometryWriteMapper.toClusterGeometry(fragment.clusterShape());
            long clusterId = roomWriteRepository.insertCluster(conn, plan.mapId(), geometry);
            roomWriteRepository.insertRoom(conn, plan.mapId(), clusterId, fragment.roomName(), fragment.roomAnchor());
        }
    }
}
