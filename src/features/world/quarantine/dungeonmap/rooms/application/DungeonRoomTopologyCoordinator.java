package features.world.quarantine.dungeonmap.rooms.application;
import features.world.quarantine.dungeonmap.rooms.application.spi.ClusterAnchor;
import features.world.quarantine.dungeonmap.rooms.application.spi.CorridorBindingReanchorer;
import features.world.quarantine.dungeonmap.rooms.application.spi.CorridorRoomReconciler;
import features.world.quarantine.dungeonmap.layout.application.DungeonTopologyEditResultLoader;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomGeometry;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomNaming;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.rooms.model.RoomShape;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import features.world.quarantine.dungeonmap.rooms.persistence.DungeonRoomPersistenceRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonRoomTopologyCoordinator {

    private final CorridorBindingReanchorer corridorBindingReanchorer;
    private final DungeonClusterRoomReconciler clusterRoomReconciler;

    public DungeonRoomTopologyCoordinator(
            CorridorBindingReanchorer corridorBindingReanchorer,
            CorridorRoomReconciler corridorRoomReconciler
    ) {
        this.corridorBindingReanchorer = Objects.requireNonNull(corridorBindingReanchorer, "corridorBindingReanchorer");
        this.clusterRoomReconciler = new DungeonClusterRoomReconciler(
                Objects.requireNonNull(corridorRoomReconciler, "corridorRoomReconciler"));
    }

    public DungeonLayoutEditResult moveCluster(Connection conn, long mapId, long clusterId, Point2i center) throws SQLException {
        DungeonLayout layout = requireLayout(conn, mapId);
        DungeonRoomCluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            throw new IllegalArgumentException("Unbekannter Cluster: " + clusterId);
        }
        Point2i delta = center.subtract(cluster.center());
        Set<Point2i> movedClusterCells = Point2i.translateAll(layout.clusterCells(cluster.clusterId()), delta);
        boolean overlapsExistingCluster = layout.clusters().stream()
                .filter(candidate -> !Objects.equals(candidate.clusterId(), cluster.clusterId()))
                .anyMatch(candidate -> DungeonClusterMutationPlanner.overlapsCluster(candidate, movedClusterCells));
        if (overlapsExistingCluster) {
            return new DungeonLayoutEditResult(layout, DungeonSelection.roomCluster(cluster.clusterId()));
        }

        DungeonRoomPersistenceRepository.updateClusterGeometry(conn, cluster.clusterId(), cluster.center().add(delta), cluster.relativeVertices());
        for (DungeonRoom member : DungeonClusterMutationPlanner.roomsForCluster(layout, cluster.clusterId())) {
            DungeonRoomPersistenceRepository.updateRoomPosition(conn, member.roomId(), member.componentAnchor().add(delta));
        }
        return DungeonTopologyEditResultLoader.loadEditResult(conn, mapId, DungeonSelection.roomCluster(cluster.clusterId()));
    }

    public DungeonLayoutEditResult paintRoomCells(Connection conn, long mapId, Set<Point2i> cells) throws SQLException {
        if (cells == null || cells.isEmpty()) {
            throw new IllegalArgumentException("cells darf nicht leer sein");
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        return applyPaintClusterCells(conn, layout, Set.copyOf(cells));
    }

    public DungeonLayoutEditResult createGraphRoom(Connection conn, long mapId, Point2i center) throws SQLException {
        if (center == null) {
            throw new IllegalArgumentException("center darf nicht null sein");
        }
        return paintRoomCells(conn, mapId, DungeonRoomGeometry.graphRoomCells(center));
    }

    public DungeonLayoutEditResult deleteRoomsAtCells(Connection conn, long mapId, Set<Point2i> cells) throws SQLException {
        if (cells == null || cells.isEmpty()) {
            throw new IllegalArgumentException("cells darf nicht leer sein");
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        for (DungeonRoomCluster cluster : layout.clusters()) {
            DungeonClusterMutationPlanner.ClusterDeletePlan deletePlan = DungeonClusterMutationPlanner.planClusterDeletion(layout, cluster, cells);
            if (deletePlan == null) {
                continue;
            }
            if (deletePlan.deleteCluster()) {
                deleteCluster(conn, layout, cluster.clusterId());
                continue;
            }
            applyUpdateMutation(conn, layout, (DungeonClusterMutationPlanner.ClusterMutation.Update) deletePlan.mutation());
        }
        return DungeonTopologyEditResultLoader.loadEditResult(conn, mapId, null);
    }

    public DungeonLayoutEditResult deleteGraphCluster(Connection conn, long mapId, long clusterId) throws SQLException {
        DungeonLayout layout = requireLayout(conn, mapId);
        deleteCluster(conn, layout, clusterId);
        return DungeonTopologyEditResultLoader.loadEditResult(conn, mapId, null);
    }

    public void createDefaultRoom(Connection conn, long mapId) throws SQLException {
        Point2i center = new Point2i(0, 0);
        long clusterId = DungeonRoomPersistenceRepository.insertCluster(conn, mapId, center, DungeonRoomGeometry.standardRoomVertices());
        DungeonRoomPersistenceRepository.insertRoom(conn, mapId, clusterId, "Eingang", center);
    }

    public DungeonLayoutEditResult paintClusterEdges(
            Connection conn,
            long mapId,
            Set<DungeonClusterEdgeRef> edgeRefs,
            DungeonRoomCluster.EdgeType edgeType
    ) throws SQLException {
        return applyClusterEdgeOperation(conn, mapId, edgeRefs, edgeType, true);
    }

    public DungeonLayoutEditResult deleteClusterEdges(
            Connection conn,
            long mapId,
            Set<DungeonClusterEdgeRef> edgeRefs,
            DungeonRoomCluster.EdgeType edgeType
    ) throws SQLException {
        return applyClusterEdgeOperation(conn, mapId, edgeRefs, edgeType, false);
    }

    private DungeonLayoutEditResult applyClusterEdgeOperation(
            Connection conn,
            long mapId,
            Set<DungeonClusterEdgeRef> edgeRefs,
            DungeonRoomCluster.EdgeType edgeType,
            boolean paint
    ) throws SQLException {
        if (edgeRefs == null || edgeRefs.isEmpty() || edgeType == null) {
            throw new IllegalArgumentException("edgeRefs darf nicht leer sein");
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        Map<Long, List<DungeonClusterEdgeRef>> refsByClusterId = DungeonClusterPersistenceSupport.groupEdgeRefsByClusterId(edgeRefs);
        Long focusClusterId = null;
        for (Map.Entry<Long, List<DungeonClusterEdgeRef>> entry : refsByClusterId.entrySet()) {
            DungeonRoomCluster cluster = layout.findCluster(entry.getKey());
            if (cluster == null) {
                continue;
            }
            applyUpdateMutation(conn, layout, DungeonClusterMutationPlanner.planClusterEdgeUpdate(layout, cluster, entry.getValue(), edgeType, paint));
            if (focusClusterId == null) {
                focusClusterId = cluster.clusterId();
            }
        }
        return DungeonTopologyEditResultLoader.loadEditResult(conn, mapId,
                focusClusterId == null ? null : DungeonSelection.roomCluster(focusClusterId));
    }

    private DungeonLayoutEditResult applyPaintClusterCells(Connection conn, DungeonLayout layout, Set<Point2i> paintedCells) throws SQLException {
        List<DungeonRoomCluster> overlappingClusters = layout.clusters().stream()
                .filter(cluster -> DungeonClusterMutationPlanner.overlapsCluster(cluster, paintedCells))
                .sorted(Comparator.comparing(cluster -> cluster.clusterId() == null ? Long.MAX_VALUE : cluster.clusterId()))
                .toList();
        if (overlappingClusters.isEmpty()) {
            return createNewCluster(conn, layout, paintedCells);
        }

        DungeonClusterMutationPlanner.ClusterMutation.Merge mutation = DungeonClusterMutationPlanner.planPaintClusterMutation(layout, paintedCells, overlappingClusters);
        applyMergeMutation(conn, layout, mutation);
        return DungeonTopologyEditResultLoader.loadEditResult(conn, layout.map().mapId(),
                DungeonSelection.roomCluster(mutation.clusterId()));
    }

    private DungeonLayoutEditResult createNewCluster(Connection conn, DungeonLayout layout, Set<Point2i> cells) throws SQLException {
        RoomShape shape = DungeonRoomGeometry.roomShapeForCells(cells);
        long clusterId = DungeonRoomPersistenceRepository.insertCluster(conn, layout.map().mapId(), shape.center(), shape.relativeVertices());
        DungeonRoomPersistenceRepository.insertRoom(
                conn,
                layout.map().mapId(),
                clusterId,
                DungeonRoomNaming.nextRoomName(layout.rooms()),
                DungeonClusterRoomReconciler.componentAnchor(shape));
        DungeonRoomPersistenceRepository.replaceClusterEdges(conn, clusterId, List.of());
        return DungeonTopologyEditResultLoader.loadEditResult(conn, layout.map().mapId(),
                DungeonSelection.roomCluster(clusterId));
    }

    private void applyUpdateMutation(Connection conn, DungeonLayout layout, DungeonClusterMutationPlanner.ClusterMutation.Update mutation) throws SQLException {
        reanchorClusterBindings(conn, layout, mutation.replacementAnchors(), Set.of());
        writeClusterGeometry(conn, mutation.clusterId(), mutation.clusterCells());
        DungeonRoomPersistenceRepository.replaceClusterEdges(conn, mutation.clusterId(), mutation.edgeOverrides());
        clusterRoomReconciler.reconcileClusterRooms(conn, layout, mutation.mapId(), mutation.clusterId(), mutation.clusterCenter(),
                mutation.existingRooms(), mutation.clusterCells(), mutation.edgeOverrides());
    }

    private void applyMergeMutation(Connection conn, DungeonLayout layout, DungeonClusterMutationPlanner.ClusterMutation.Merge mutation) throws SQLException {
        DungeonClusterPersistenceSupport.reassignRoomsToCluster(conn, mutation.clusterId(), mutation.roomsToReassign());
        reanchorClusterBindings(conn, layout, mutation.replacementAnchors(), mutation.deletedClusterIds());
        DungeonClusterPersistenceSupport.deleteClusters(conn, mutation.deletedClusterIds(), mutation.clusterId());
        writeClusterGeometry(conn, mutation.clusterId(), mutation.clusterCells());
        DungeonRoomPersistenceRepository.replaceClusterEdges(conn, mutation.clusterId(), mutation.edgeOverrides());
        clusterRoomReconciler.reconcileClusterRooms(conn, layout, mutation.mapId(), mutation.clusterId(), mutation.clusterCenter(),
                mutation.existingRooms(), mutation.clusterCells(), mutation.edgeOverrides());
    }

    private static void writeClusterGeometry(Connection conn, long clusterId, Set<Point2i> cells) throws SQLException {
        RoomShape shape = DungeonRoomGeometry.roomShapeForCells(cells);
        DungeonRoomPersistenceRepository.updateClusterGeometry(conn, clusterId, shape.center(), shape.relativeVertices());
    }

    private void deleteCluster(Connection conn, DungeonLayout layout, long clusterId) throws SQLException {
        reanchorClusterBindings(conn, layout, Map.of(), Set.of(clusterId));
        DungeonRoomPersistenceRepository.deleteCluster(conn, clusterId);
    }

    private void reanchorClusterBindings(
            Connection conn,
            DungeonLayout layout,
            Map<Long, ClusterAnchor> replacementAnchors,
            Set<Long> deletedClusterIds
    ) throws SQLException {
        corridorBindingReanchorer.reanchorCorridorClusterBindings(conn, layout, replacementAnchors, deletedClusterIds);
    }

    private static DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        return DungeonTopologyEditResultLoader.requireLayout(conn, mapId);
    }
}
