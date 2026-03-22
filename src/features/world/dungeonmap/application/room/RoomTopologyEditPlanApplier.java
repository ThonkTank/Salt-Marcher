package features.world.dungeonmap.application.room;

import features.world.dungeonmap.application.corridor.DungeonCorridorRewriteCoordinator;
import features.world.dungeonmap.application.corridor.DungeonCorridorPersistenceService;
import features.world.dungeonmap.application.corridor.DungeonCorridorRoomRewriteService;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInput;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInputProjector;
import features.world.dungeonmap.model.structures.corridor.CorridorRewriteContext;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;
import features.world.dungeonmap.persistence.ClusterGeometryWrite;
import features.world.dungeonmap.persistence.DungeonRoomGeometryWriteMapper;
import features.world.dungeonmap.persistence.DungeonRoomWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class RoomTopologyEditPlanApplier {

    private final DungeonRoomWriteRepository roomWriteRepository;
    private final DungeonRoomGeometryWriteMapper geometryWriteMapper;
    private final DungeonCorridorPersistenceService corridorPersistenceService;
    private final DungeonCorridorRoomRewriteService corridorRoomRewriteService;
    private final DungeonCorridorRewriteCoordinator corridorRewriteCoordinator;

    public RoomTopologyEditPlanApplier(
            DungeonRoomWriteRepository roomWriteRepository,
            DungeonRoomGeometryWriteMapper geometryWriteMapper,
            DungeonCorridorPersistenceService corridorPersistenceService,
            DungeonCorridorRoomRewriteService corridorRoomRewriteService,
            DungeonCorridorRewriteCoordinator corridorRewriteCoordinator
    ) {
        this.roomWriteRepository = Objects.requireNonNull(roomWriteRepository, "roomWriteRepository");
        this.geometryWriteMapper = Objects.requireNonNull(geometryWriteMapper, "geometryWriteMapper");
        this.corridorPersistenceService = Objects.requireNonNull(corridorPersistenceService, "corridorPersistenceService");
        this.corridorRoomRewriteService = Objects.requireNonNull(corridorRoomRewriteService, "corridorRoomRewriteService");
        this.corridorRewriteCoordinator = Objects.requireNonNull(corridorRewriteCoordinator, "corridorRewriteCoordinator");
    }

    public void apply(Connection conn, DungeonLayout layout, RoomTopologyEditPlan plan) throws SQLException {
        if (plan instanceof CreateClusterRoomEditPlan createPlan) {
            applyCreate(conn, createPlan);
            return;
        }
        if (plan instanceof UpdateClusterRoomEditPlan updatePlan) {
            applyUpdate(conn, updatePlan);
            corridorPersistenceService.persistCorridors(conn, rewrittenCorridorsForUpdate(layout, updatePlan));
            return;
        }
        if (plan instanceof DeleteClusterRoomEditPlan deletePlan) {
            roomWriteRepository.deleteCluster(conn, deletePlan.clusterId());
            corridorPersistenceService.persistCorridors(conn, rewrittenCorridorsForDelete(layout, deletePlan));
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
        List<Room> insertedRooms = new ArrayList<>();
        Map<Long, Point2i> replacementCenters = new LinkedHashMap<>();
        roomWriteRepository.deleteCluster(conn, plan.sourceClusterId());
        for (SplitClusterFragmentPlan fragment : plan.fragments()) {
            ClusterGeometryWrite geometry = geometryWriteMapper.toClusterGeometry(fragment.clusterShape());
            long clusterId = roomWriteRepository.insertCluster(conn, plan.mapId(), geometry);
            long roomId = roomWriteRepository.insertRoom(conn, plan.mapId(), clusterId, fragment.roomName(), fragment.roomAnchor());
            replacementCenters.put(clusterId, fragment.clusterShape().centerCell());
            insertedRooms.add(Room.create(roomId, plan.mapId(), clusterId, fragment.roomName(), new Floor(fragment.clusterShape())));
        }
        if (plan.sourceRoomId() != null) {
            // The applier orchestrates persistence-time rewrite flow; corridor-local membership choice remains on Corridor.
            Map<Long, Corridor> corridorsById = corridorRoomRewriteService.applyRoomRewrite(
                    plan.layout(),
                    plan.layout().corridorsById(),
                    splitRewrite(plan.sourceClusterId(), plan.sourceRoomId(), insertedRooms));
            CorridorRewriteContext rewriteContext = plan.layout().corridorRewriteContext(
                    CorridorPlanningInputProjector.projectOverlay(
                            plan.layout(),
                            roomsById(insertedRooms),
                            replacementCenters,
                            Set.of(plan.sourceRoomId()),
                            Set.of(plan.sourceClusterId())),
                    plan.layout().corridorIdsAffectedBy(Set.of(plan.sourceRoomId()), Set.of(plan.sourceClusterId())),
                    Set.of(plan.sourceClusterId()));
            corridorPersistenceService.persistCorridors(conn, corridorRewriteCoordinator.rewriteCorridors(corridorsById, rewriteContext));
        }
    }

    private Map<Long, Corridor> rewrittenCorridorsForUpdate(DungeonLayout layout, UpdateClusterRoomEditPlan plan) {
        Room room = layout.findRoom(plan.roomId());
        if (room == null) {
            return layout.corridorsById();
        }
        Point2i updatedCenter = plan.clusterShape() == null ? layout.findCluster(plan.clusterId()).center() : plan.clusterShape().centerCell();
        Room updatedRoom = Room.resolved(
                room.roomId(),
                room.mapId(),
                room.clusterId(),
                room.name(),
                new Floor(plan.clusterShape()),
                room.walls(),
                room.doors());
        // The applier only projects the rewritten world snapshot; Corridor decides what reanchor/replan means locally.
        CorridorRewriteContext rewriteContext = layout.corridorRewriteContext(
                CorridorPlanningInputProjector.projectOverlay(
                        layout,
                        Map.of(updatedRoom.roomId(), updatedRoom),
                        Map.of(plan.clusterId(), updatedCenter),
                        Set.of(),
                        Set.of()),
                layout.corridorIdsAffectedBy(Set.of(room.roomId()), Set.of(plan.clusterId())),
                Set.of());
        return corridorRewriteCoordinator.rewriteCorridors(layout.corridorsById(), rewriteContext);
    }

    private Map<Long, Corridor> rewrittenCorridorsForDelete(DungeonLayout layout, DeleteClusterRoomEditPlan plan) {
        Set<Long> deletedRoomIds = layout.findCluster(plan.clusterId()) == null ? Set.of() : layout.findCluster(plan.clusterId()).roomIds();
        ClusterRewrite rewrite = new ClusterRewrite(
                plan.clusterId(),
                null,
                null,
                List.of(),
                List.of(),
                deletedRoomIds,
                Map.of(),
                Set.of(),
                Set.of(plan.clusterId()),
                Map.of());
        // The applier chooses affected scope and ordering, but does not decide corridor-local delete behavior.
        Map<Long, Corridor> corridorsById = corridorRoomRewriteService.applyRoomRewrite(layout, layout.corridorsById(), rewrite);
        CorridorRewriteContext rewriteContext = layout.corridorRewriteContext(
                CorridorPlanningInputProjector.projectOverlay(
                        layout,
                        Map.of(),
                        Map.of(),
                        deletedRoomIds,
                        Set.of(plan.clusterId())),
                layout.corridorIdsAffectedBy(deletedRoomIds, Set.of(plan.clusterId())),
                Set.of(plan.clusterId()));
        return corridorRewriteCoordinator.rewriteCorridors(corridorsById, rewriteContext);
    }

    private static ClusterRewrite splitRewrite(long sourceClusterId, long sourceRoomId, List<Room> fragments) {
        return new ClusterRewrite(
                sourceClusterId,
                null,
                null,
                List.of(),
                List.of(),
                Set.of(),
                Map.of(),
                Set.of(),
                Set.of(sourceClusterId),
                Map.of(sourceRoomId, fragments));
    }

    private static Map<Long, Room> roomsById(List<Room> rooms) {
        Map<Long, Room> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room != null && room.roomId() != null) {
                result.put(room.roomId(), room);
            }
        }
        return Map.copyOf(result);
    }
}
