package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonSelectionHighlightResolver {

    private DungeonSelectionHighlightResolver() {
    }

    /**
     * Hover highlighting resolves from the same selection refs that tools consume so new interactive targets do not
     * need a second renderer-local geometry mapping.
     */
    public static List<DungeonHitSurface> resolveOwnerSurfaces(
            DungeonLayout layout,
            DungeonSelectionRef ref,
            int levelZ
    ) {
        if (layout == null || ref == null) {
            return List.of();
        }
        DungeonSelectionRef ownerRef = ref.ownerRef();
        if (ownerRef != null && !Objects.equals(ownerRef, ref)) {
            return resolveOwnerSurfaces(layout, ownerRef, levelZ);
        }
        return switch (ownerRef == null ? ref : ownerRef) {
            case DungeonSelectionRef.ClusterRef clusterRef -> clusterOwnerSurfaces(layout.findCluster(clusterRef.clusterId()), levelZ);
            case DungeonSelectionRef.RoomRef roomRef -> roomOwnerSurfaces(layout.findRoom(roomRef.roomId()), levelZ);
            case DungeonSelectionRef.CorridorRef corridorRef -> corridorOwnerSurfaces(layout.findCorridor(corridorRef.corridorId()), levelZ);
            case DungeonSelectionRef.StairRef stairRef -> stairOwnerSurfaces(layout.findStair(stairRef.stairId()), levelZ);
            case DungeonSelectionRef.TransitionRef transitionRef -> transitionOwnerSurfaces(layout.findTransition(transitionRef.transitionId()), levelZ);
            default -> List.of();
        };
    }

    public static List<DungeonHitSurface> resolvePartSurfaces(
            DungeonLayout layout,
            DungeonSelectionRef ref,
            int levelZ
    ) {
        if (layout == null || ref == null) {
            return List.of();
        }
        return switch (ref) {
            case DungeonSelectionRef.RoomBoundaryRef roomBoundaryRef ->
                    List.of(new DungeonHitSurface.SegmentSurface(Set.of(roomBoundaryRef.boundarySegment2x()), levelZ));
            case DungeonSelectionRef.CorridorBoundaryRef corridorBoundaryRef ->
                    List.of(new DungeonHitSurface.SegmentSurface(Set.of(corridorBoundaryRef.boundarySegment2x()), levelZ));
            case DungeonSelectionRef.ConnectionRef connectionRef ->
                    List.of(new DungeonHitSurface.SegmentSurface(Set.of(connectionRef.boundarySegment2x()), levelZ));
            case DungeonSelectionRef.CorridorTileRef corridorTileRef ->
                    corridorTileRef.cell().z() == levelZ
                            ? List.of(new DungeonHitSurface.CellSurface(Set.of(corridorTileRef.cell().projectedCell()), levelZ))
                            : List.of();
            case DungeonSelectionRef.CorridorNodeRef corridorNodeRef ->
                    List.of(new DungeonHitSurface.PointSurface(Set.of(corridorNodeRef.point2x()), levelZ));
            case DungeonSelectionRef.CorridorCornerRef corridorCornerRef ->
                    List.of(new DungeonHitSurface.PointSurface(Set.of(corridorCornerRef.point2x()), levelZ));
            case DungeonSelectionRef.CorridorSegmentRef corridorSegmentRef -> corridorSegmentSurfaces(layout, corridorSegmentRef, levelZ);
            case DungeonSelectionRef.VertexRef vertexRef ->
                    List.of(new DungeonHitSurface.PointSurface(Set.of(vertexRef.vertex2x()), levelZ));
            case DungeonSelectionRef.GridCellRef gridCellRef ->
                    gridCellRef.cell().z() == levelZ
                            ? List.of(new DungeonHitSurface.CellSurface(Set.of(gridCellRef.cell().projectedCell()), levelZ))
                            : List.of();
            case DungeonSelectionRef.RoomCellRef roomCellRef ->
                    roomCellRef.cell().z() == levelZ
                            ? List.of(new DungeonHitSurface.CellSurface(Set.of(roomCellRef.cell().projectedCell()), levelZ))
                            : List.of();
            case DungeonSelectionRef.FloorCellRef floorCellRef ->
                    floorCellRef.cell().z() == levelZ
                            ? List.of(new DungeonHitSurface.CellSurface(Set.of(floorCellRef.cell().projectedCell()), levelZ))
                            : List.of();
            default -> List.of();
        };
    }

    private static List<DungeonHitSurface> clusterOwnerSurfaces(RoomCluster cluster, int levelZ) {
        if (cluster == null) {
            return List.of();
        }
        LinkedHashSet<CellCoord> cells = new LinkedHashSet<>();
        for (Room room : cluster.rooms()) {
            if (room != null) {
                cells.addAll(room.structure().cellCoordsAtLevel(levelZ));
            }
        }
        return cells.isEmpty() ? List.of() : List.of(new DungeonHitSurface.CellSurface(cells, levelZ));
    }

    private static List<DungeonHitSurface> roomOwnerSurfaces(Room room, int levelZ) {
        if (room == null) {
            return List.of();
        }
        Set<CellCoord> cells = room.structure().cellCoordsAtLevel(levelZ);
        return cells.isEmpty() ? List.of() : List.of(new DungeonHitSurface.CellSurface(cells, levelZ));
    }

    private static List<DungeonHitSurface> corridorOwnerSurfaces(Corridor corridor, int levelZ) {
        if (corridor == null) {
            return List.of();
        }
        Set<CellCoord> cells = corridor.structure().cellCoordsAtLevel(levelZ);
        return cells.isEmpty() ? List.of() : List.of(new DungeonHitSurface.CellSurface(cells, levelZ));
    }

    private static List<DungeonHitSurface> stairOwnerSurfaces(DungeonStair stair, int levelZ) {
        if (stair == null) {
            return List.of();
        }
        LinkedHashSet<CellCoord> cells = new LinkedHashSet<>();
        stair.path().stream()
                .filter(point -> point != null && point.z() == levelZ)
                .map(point -> point.projectedCell())
                .forEach(cells::add);
        return cells.isEmpty() ? List.of() : List.of(new DungeonHitSurface.CellSurface(cells, levelZ));
    }

    private static List<DungeonHitSurface> transitionOwnerSurfaces(DungeonTransition transition, int levelZ) {
        if (transition == null || transition.placement() == null) {
            return List.of();
        }
        if (transition.doorPlacement() != null) {
            return transition.doorPlacement().levelZ() == levelZ
                    ? List.of(new DungeonHitSurface.SegmentSurface(Set.of(transition.doorPlacement().boundarySegment2x()), levelZ))
                    : List.of();
        }
        Set<CellCoord> cells = transition.placement().occupiedPositions().stream()
                .filter(point -> point != null && point.z() == levelZ)
                .map(point -> point.projectedCell())
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        return cells.isEmpty() ? List.of() : List.of(new DungeonHitSurface.CellSurface(cells, levelZ));
    }

    private static List<DungeonHitSurface> corridorSegmentSurfaces(
            DungeonLayout layout,
            DungeonSelectionRef.CorridorSegmentRef corridorSegmentRef,
            int levelZ
    ) {
        Corridor corridor = layout.corridor(corridorSegmentRef);
        if (corridor == null || corridorSegmentRef.segmentId() == null) {
            return List.of();
        }
        return corridor.routes().stream()
                .filter(route -> Objects.equals(route.segmentId(), corridorSegmentRef.segmentId()))
                .findFirst()
                .map(route -> List.<DungeonHitSurface>of(
                        new DungeonHitSurface.SegmentSurface(Set.copyOf(route.segments2x()), levelZ)))
                .orElse(List.of());
    }
}
