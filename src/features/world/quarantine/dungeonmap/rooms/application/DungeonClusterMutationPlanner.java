package features.world.quarantine.dungeonmap.rooms.application;
import features.world.quarantine.dungeonmap.rooms.application.spi.ClusterAnchor;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRules;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.rooms.model.DungeonCellPolygonMath;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomGeometry;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.rooms.model.RoomShape;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

final class DungeonClusterMutationPlanner {

    private DungeonClusterMutationPlanner() {
        throw new AssertionError("No instances");
    }

    static ClusterDeletePlan planClusterDeletion(DungeonLayout layout, DungeonRoomCluster cluster, Set<Point2i> deletedCells) {
        Set<Point2i> remainingCells = new LinkedHashSet<>(layout.clusterCells(cluster.clusterId()));
        if (!remainingCells.removeAll(deletedCells)) {
            return null;
        }
        if (remainingCells.isEmpty()) {
            return new ClusterDeletePlan(true, null);
        }
        RoomShape shape = DungeonRoomGeometry.roomShapeForCells(remainingCells);
        List<DungeonRoomCluster.EdgeOverride> shiftedEdges = shiftEdges(cluster.center(), shape.center(), cluster.edgeOverrides());
        List<DungeonRoomCluster.EdgeOverride> sanitizedEdges = DungeonRoomCluster.sanitizeInternalEdges(shape.center(), remainingCells, shiftedEdges);
        return new ClusterDeletePlan(false, new ClusterMutation.Update(
                layout.map().mapId(),
                cluster.clusterId(),
                shape.center(),
                remainingCells,
                sanitizedEdges,
                roomsForCluster(layout, cluster.clusterId()),
                Map.of(cluster.clusterId(), new ClusterAnchor(cluster.clusterId(), shape.center()))));
    }

    static ClusterMutation.Merge planPaintClusterMutation(
            DungeonLayout layout,
            Set<Point2i> paintedCells,
            List<DungeonRoomCluster> overlappingClusters
    ) {
        DungeonRoomCluster primaryCluster = overlappingClusters.get(0);
        Set<Point2i> mergedCells = collectMergedCells(layout, paintedCells, overlappingClusters);
        List<DungeonRoom> mergedRooms = collectMergedRooms(layout, overlappingClusters);
        RoomShape mergedShape = DungeonRoomGeometry.roomShapeForCells(mergedCells);
        Set<Long> deletedClusterIds = overlappingClusters.stream()
                .skip(1)
                .map(DungeonRoomCluster::clusterId)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        // Merge paint keeps the external perimeter intact while removing edges that became internal after the rewrite.
        List<DungeonRoomCluster.EdgeOverride> persistedEdges = DungeonRoomCluster.sanitizeInternalEdges(
                mergedShape.center(),
                mergedCells,
                collectShiftedEdges(overlappingClusters, mergedShape.center()));
        return new ClusterMutation.Merge(
                layout.map().mapId(),
                primaryCluster.clusterId(),
                mergedShape.center(),
                mergedCells,
                persistedEdges,
                mergedRooms,
                mergedRooms,
                replacementAnchorsForMerge(overlappingClusters, primaryCluster, mergedShape.center()),
                deletedClusterIds);
    }

    static ClusterMutation.Update planClusterEdgeUpdate(
            DungeonLayout layout,
            DungeonRoomCluster cluster,
            List<DungeonClusterEdgeRef> edgeRefs,
            DungeonRoomCluster.EdgeType edgeType,
            boolean present
    ) {
        Set<Point2i> clusterCells = layout.clusterCells(cluster.clusterId());
        Map<DungeonRoomCluster.EdgeKey, DungeonRoomCluster.EdgeOverride> overrides = indexEdges(cluster.edgeOverrides());
        applyEdgeUpdates(cluster, clusterCells, overrides, edgeRefs, edgeType, present);
        return new ClusterMutation.Update(
                layout.map().mapId(),
                cluster.clusterId(),
                cluster.center(),
                clusterCells,
                List.copyOf(overrides.values()),
                roomsForCluster(layout, cluster.clusterId()),
                Map.of());
    }

    static boolean overlapsCluster(DungeonRoomCluster cluster, Set<Point2i> cells) {
        Set<Point2i> clusterCells = DungeonCellPolygonMath.cells(cluster);
        for (Point2i cell : cells) {
            if (clusterCells.contains(cell)) {
                return true;
            }
        }
        return false;
    }


    static List<DungeonRoom> roomsForCluster(DungeonLayout layout, Long clusterId) {
        return layout == null ? List.of() : layout.roomsForCluster(clusterId);
    }

    private static Set<Point2i> collectMergedCells(
            DungeonLayout layout,
            Set<Point2i> paintedCells,
            List<DungeonRoomCluster> overlappingClusters
    ) {
        Set<Point2i> mergedCells = new LinkedHashSet<>(paintedCells);
        for (DungeonRoomCluster cluster : overlappingClusters) {
            mergedCells.addAll(layout.clusterCells(cluster.clusterId()));
        }
        return mergedCells;
    }

    private static List<DungeonRoom> collectMergedRooms(DungeonLayout layout, List<DungeonRoomCluster> overlappingClusters) {
        List<DungeonRoom> mergedRooms = new ArrayList<>();
        for (DungeonRoomCluster cluster : overlappingClusters) {
            mergedRooms.addAll(roomsForCluster(layout, cluster.clusterId()));
        }
        return List.copyOf(mergedRooms);
    }

    private static Map<Long, ClusterAnchor> replacementAnchorsForMerge(
            List<DungeonRoomCluster> overlappingClusters,
            DungeonRoomCluster primaryCluster,
            Point2i mergedCenter
    ) {
        Map<Long, ClusterAnchor> replacementAnchors = new LinkedHashMap<>();
        replacementAnchors.put(primaryCluster.clusterId(), new ClusterAnchor(primaryCluster.clusterId(), mergedCenter));
        for (int i = 1; i < overlappingClusters.size(); i++) {
            replacementAnchors.put(
                    overlappingClusters.get(i).clusterId(),
                    new ClusterAnchor(primaryCluster.clusterId(), mergedCenter));
        }
        return replacementAnchors;
    }

    private static List<DungeonRoomCluster.EdgeOverride> collectShiftedEdges(
            List<DungeonRoomCluster> clusters,
            Point2i mergedCenter
    ) {
        List<DungeonRoomCluster.EdgeOverride> shiftedMergedEdges = new ArrayList<>();
        for (DungeonRoomCluster cluster : clusters) {
            shiftedMergedEdges.addAll(shiftEdges(cluster.center(), mergedCenter, cluster.edgeOverrides()));
        }
        return List.copyOf(shiftedMergedEdges);
    }

    private static List<DungeonRoomCluster.EdgeOverride> shiftEdges(
            Point2i previousCenter,
            Point2i nextCenter,
            List<DungeonRoomCluster.EdgeOverride> edgeOverrides
    ) {
        if (edgeOverrides.isEmpty() || Objects.equals(previousCenter, nextCenter)) {
            return List.copyOf(edgeOverrides);
        }
        Point2i delta = previousCenter.subtract(nextCenter);
        return edgeOverrides.stream()
                .map(edge -> edge.translated(delta))
                .toList();
    }

    private static Map<DungeonRoomCluster.EdgeKey, DungeonRoomCluster.EdgeOverride> indexEdges(List<DungeonRoomCluster.EdgeOverride> edgeOverrides) {
        Map<DungeonRoomCluster.EdgeKey, DungeonRoomCluster.EdgeOverride> result = new LinkedHashMap<>();
        if (edgeOverrides == null) {
            return result;
        }
        for (DungeonRoomCluster.EdgeOverride edge : edgeOverrides) {
            DungeonRoomCluster.EdgeOverride canonical = DungeonRoomCluster.EdgeOverride.of(edge.cell(), edge.direction(), edge.type());
            result.put(canonical.key(), canonical);
        }
        return result;
    }

    private static void applyEdgeUpdates(
            DungeonRoomCluster cluster,
            Set<Point2i> clusterCells,
            Map<DungeonRoomCluster.EdgeKey, DungeonRoomCluster.EdgeOverride> overrides,
            List<DungeonClusterEdgeRef> edgeRefs,
            DungeonRoomCluster.EdgeType edgeType,
            boolean present
    ) {
        for (DungeonClusterEdgeRef ref : edgeRefs) {
            DungeonRoomCluster.EdgeOverride override = ref.toEdgeOverride(cluster, edgeType);
            Point2i absoluteCell = override.absoluteCell(cluster.center());
            if (!cellsContainBothSides(clusterCells, absoluteCell, override.direction())) continue;
            if (present) {
                addEdgeOverride(overrides, override, edgeType);
            } else {
                removeEdgeOverride(overrides, override, edgeType);
            }
        }
    }

    private static boolean cellsContainBothSides(
            Set<Point2i> clusterCells,
            Point2i absoluteCell,
            DungeonRoomCluster.EdgeDirection direction
    ) {
        return clusterCells.contains(absoluteCell)
                && clusterCells.contains(absoluteCell.add(direction.delta()));
    }

    private static void addEdgeOverride(
            Map<DungeonRoomCluster.EdgeKey, DungeonRoomCluster.EdgeOverride> overrides,
            DungeonRoomCluster.EdgeOverride override,
            DungeonRoomCluster.EdgeType edgeType
    ) {
        if (canUpdateClusterEdge(overrides, override, edgeType, true)) {
            overrides.put(override.key(), override);
        }
    }

    private static void removeEdgeOverride(
            Map<DungeonRoomCluster.EdgeKey, DungeonRoomCluster.EdgeOverride> overrides,
            DungeonRoomCluster.EdgeOverride override,
            DungeonRoomCluster.EdgeType edgeType
    ) {
        DungeonRoomCluster.EdgeOverride existing = overrides.get(override.key());
        if (existing != null && deletesExistingEdge(existing, edgeType)) {
            if (edgeType == DungeonRoomCluster.EdgeType.DOOR) {
                overrides.put(override.key(), DungeonClusterEdgeRules.restoreWall(existing));
            } else {
                overrides.remove(override.key());
            }
        }
    }

    private static boolean canUpdateClusterEdge(
            Map<DungeonRoomCluster.EdgeKey, DungeonRoomCluster.EdgeOverride> overrides,
            DungeonRoomCluster.EdgeOverride override,
            DungeonRoomCluster.EdgeType edgeType,
            boolean present
    ) {
        if (!present || edgeType != DungeonRoomCluster.EdgeType.DOOR) {
            return true;
        }
        return DungeonClusterEdgeRules.hasWallAt(overrides, override);
    }

    private static boolean deletesExistingEdge(
            DungeonRoomCluster.EdgeOverride existing,
            DungeonRoomCluster.EdgeType edgeType
    ) {
        if (existing == null || edgeType == null) {
            return false;
        }
        if (edgeType == DungeonRoomCluster.EdgeType.WALL) {
            return DungeonClusterEdgeRules.providesWall(existing.type());
        }
        return existing.type() == edgeType;
    }

    sealed interface ClusterMutation {
        long mapId();
        long clusterId();
        Point2i clusterCenter();
        Set<Point2i> clusterCells();
        List<DungeonRoomCluster.EdgeOverride> edgeOverrides();
        List<DungeonRoom> existingRooms();

        record Update(
                long mapId,
                long clusterId,
                Point2i clusterCenter,
                Set<Point2i> clusterCells,
                List<DungeonRoomCluster.EdgeOverride> edgeOverrides,
                List<DungeonRoom> existingRooms,
                Map<Long, ClusterAnchor> replacementAnchors
        ) implements ClusterMutation {}

        record Merge(
                long mapId,
                long clusterId,
                Point2i clusterCenter,
                Set<Point2i> clusterCells,
                List<DungeonRoomCluster.EdgeOverride> edgeOverrides,
                List<DungeonRoom> existingRooms,
                List<DungeonRoom> roomsToReassign,
                Map<Long, ClusterAnchor> replacementAnchors,
                Set<Long> deletedClusterIds
        ) implements ClusterMutation {}
    }

    record ClusterDeletePlan(boolean deleteCluster, ClusterMutation mutation) {
    }
}
