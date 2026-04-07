package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.structure.model.Door;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonBoundaryHitSource implements DungeonHitSource {

    @Override
    public List<DungeonHitDescriptor> describe(DungeonLayout layout, DungeonHitProbe probe) {
        if (layout == null || probe == null) {
            return List.of();
        }

        DungeonLayout projectedLayout = layout.projectedToLevel(probe.levelZ());
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        List<RoomCluster> projectedClusters = projectedLayout.clusters();
        Set<GridSegment2x> connectionSegments = occupiedDoorSegments(projectedLayout);

        descriptors.addAll(roomBoundaryDescriptors(projectedClusters, projectedLayout, connectionSegments, probe.levelZ()));
        descriptors.addAll(corridorBoundaryDescriptors(projectedLayout.corridors(), projectedLayout, connectionSegments, probe.levelZ()));
        descriptors.addAll(doorDescriptors(projectedLayout, probe.levelZ()));
        return List.copyOf(descriptors);
    }

    private static Set<GridSegment2x> occupiedDoorSegments(DungeonLayout layout) {
        LinkedHashSet<GridSegment2x> segments = new LinkedHashSet<>();
        for (Door door : layout == null ? List.<Door>of() : layout.doors()) {
            if (door == null) {
                continue;
            }
            segments.addAll(door.segments2x());
        }
        return Set.copyOf(segments);
    }

    private static List<DungeonHitDescriptor> roomBoundaryDescriptors(
            List<RoomCluster> projectedClusters,
            DungeonLayout projectedLayout,
            Set<GridSegment2x> connectionSegments,
            int levelZ
    ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (RoomCluster cluster : projectedClusters) {
            for (Room room : cluster.rooms()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                for (GridSegment2x segment2x : projectedLayout.roomBoundaryEdgesAtLevel(room, levelZ)) {
                    if (segment2x == null || connectionSegments.contains(segment2x)) {
                        continue;
                    }
                    DungeonSelectionRef.RoomBoundaryRef ref = new DungeonSelectionRef.RoomBoundaryRef(room.roomId(), segment2x);
                    if (projectedLayout.describeRoomBoundary(ref, levelZ) == null) {
                        continue;
                    }
                    descriptors.add(new DungeonHitDescriptor(
                            ref,
                            List.of(new DungeonHitSurface.SegmentSurface(Set.of(segment2x), levelZ))));
                }
            }
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> doorDescriptors(
            DungeonLayout layout,
            int levelZ
    ) {
        Map<DungeonSelectionRef.DoorRef, LinkedHashSet<GridSegment2x>> segmentsByDoor = new LinkedHashMap<>();
        for (Door door : layout == null ? List.<Door>of() : layout.doors()) {
            if (door == null) {
                continue;
            }
            for (GridSegment2x segment2x : door.segments2x()) {
                DungeonSelectionRef.DoorRef ref = layout.doorSelectionRefAt(levelZ, segment2x);
                if (ref == null) {
                    continue;
                }
                segmentsByDoor.computeIfAbsent(ref, ignored -> new LinkedHashSet<>()).add(segment2x);
            }
        }
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Map.Entry<DungeonSelectionRef.DoorRef, LinkedHashSet<GridSegment2x>> entry : segmentsByDoor.entrySet()) {
            descriptors.add(new DungeonHitDescriptor(
                    entry.getKey(),
                    List.of(new DungeonHitSurface.SegmentSurface(Set.copyOf(entry.getValue()), levelZ))));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> corridorBoundaryDescriptors(
            List<Corridor> corridors,
            DungeonLayout projectedLayout,
            Set<GridSegment2x> connectionSegments,
            int levelZ
    ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Corridor corridor : corridors) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            Set<GridSegment2x> openingEdges = corridor.boundaryDoorSegments(projectedLayout);
            for (GridSegment2x segment2x : corridor.structure().boundaryEdgesAtLevel(levelZ)) {
                if (segment2x == null || openingEdges.contains(segment2x) || connectionSegments.contains(segment2x)) {
                    continue;
                }
                DungeonSelectionRef.CorridorBoundaryRef ref =
                        new DungeonSelectionRef.CorridorBoundaryRef(corridor.corridorId(), segment2x);
                if (projectedLayout.describeCorridorBoundary(ref, levelZ) == null) {
                    continue;
                }
                descriptors.add(new DungeonHitDescriptor(
                        ref,
                        List.of(new DungeonHitSurface.SegmentSurface(Set.of(segment2x), levelZ))));
            }
        }
        return List.copyOf(descriptors);
    }
}
