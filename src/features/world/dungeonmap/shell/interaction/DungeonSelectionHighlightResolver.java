package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeonmap.structure.model.boundary.door.DoorRef;
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
        DungeonSelectionRef ownerRef = layout.ownerRef(ref);
        if (ownerRef != null && !Objects.equals(ownerRef, ref)) {
            return resolveOwnerSurfaces(layout, ownerRef, levelZ);
        }
        return switch (ownerRef == null ? ref : ownerRef) {
            case DungeonSelectionRef.ClusterRef clusterRef -> clusterOwnerSurfaces(layout, layout.findCluster(clusterRef.clusterId()), levelZ);
            case DungeonSelectionRef.RoomRef roomRef -> roomOwnerSurfaces(layout, layout.findRoom(roomRef.roomId()), levelZ);
            case DungeonSelectionRef.CorridorRef corridorRef -> corridorOwnerSurfaces(layout.findCorridor(corridorRef.corridorId()), levelZ);
            case DungeonSelectionRef.StairRef stairRef -> stairOwnerSurfaces(layout.findStair(stairRef.stairId()), levelZ);
            case DungeonSelectionRef.TransitionRef transitionRef -> transitionOwnerSurfaces(layout, layout.findTransition(transitionRef.transitionId()), levelZ);
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
            case DungeonSelectionRef.DoorRef doorRef ->
                    doorPartSurfaces(layout, doorRef, levelZ);
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

    private static List<DungeonHitSurface> clusterOwnerSurfaces(DungeonLayout layout, RoomCluster cluster, int levelZ) {
        if (cluster == null) {
            return List.of();
        }
        LinkedHashSet<CellCoord> cells = new LinkedHashSet<>();
        for (Room room : cluster.rooms()) {
            if (room != null) {
                cells.addAll(layout.roomCellsAtLevel(room, levelZ));
            }
        }
        return cells.isEmpty() ? List.of() : List.of(new DungeonHitSurface.CellSurface(cells, levelZ));
    }

    private static List<DungeonHitSurface> roomOwnerSurfaces(DungeonLayout layout, Room room, int levelZ) {
        if (room == null) {
            return List.of();
        }
        Set<CellCoord> cells = layout.roomCellsAtLevel(room, levelZ);
        return cells.isEmpty() ? List.of() : List.of(new DungeonHitSurface.CellSurface(cells, levelZ));
    }

    private static List<DungeonHitSurface> corridorOwnerSurfaces(Corridor corridor, int levelZ) {
        if (corridor == null) {
            return List.of();
        }
        Set<CellCoord> cells = corridor.structure().surfaceAtLevel(levelZ).surface().cellCoords();
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

    private static List<DungeonHitSurface> transitionOwnerSurfaces(DungeonLayout layout, DungeonTransition transition, int levelZ) {
        if (transition == null || transition.localConnection() == null) {
            return List.of();
        }
        if (transition.localConnection().doorCarrier() != null) {
            GridSegment2x anchorSegment2x = transition.localConnection().anchorSegment2x(layout);
            return transition.localConnection().levelZ() == levelZ
                    && anchorSegment2x != null
                    ? List.of(new DungeonHitSurface.SegmentSurface(Set.of(anchorSegment2x), levelZ))
                    : List.of();
        }
        Set<CellCoord> cells = transition.localConnection().stairCarrier() == null
                ? Set.of()
                : transition.localConnection().stairCarrier().path().stream()
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
        return corridor.pathTraces().stream()
                .filter(trace -> Objects.equals(trace.traceId(), corridorSegmentRef.segmentId()))
                .findFirst()
                .map(trace -> List.<DungeonHitSurface>of(
                        new DungeonHitSurface.SegmentSurface(Set.copyOf(trace.segments2x()), levelZ)))
                .orElse(List.of());
    }

    private static List<DungeonHitSurface> doorPartSurfaces(
            DungeonLayout layout,
            DungeonSelectionRef.DoorRef doorRef,
            int levelZ
    ) {
        if (layout == null || doorRef == null) {
            return List.of();
        }
        DungeonLayout.DoorDescription description = layout.describeDoor(
                new DoorRef(doorRef.doorId()));
        if (description == null || description.levelZ() != levelZ) {
            return List.of();
        }
        Door door = description.door();
        return door == null || !door.hasBoundarySegments()
                ? List.of()
                : List.of(new DungeonHitSurface.SegmentSurface(door.boundarySegments(), levelZ));
    }
}
