package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.map.model.DungeonLayout;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.map.cluster.model.RoomCluster;
import features.world.dungeonmap.map.corridor.model.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.map.structure.model.Structure;
import features.world.dungeonmap.map.structure.model.boundary.door.Door;

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
        Set<GridSegment> connectionSegments = occupiedDoorSegments(projectedLayout);

        descriptors.addAll(roomBoundaryDescriptors(projectedClusters, projectedLayout, connectionSegments, probe.levelZ()));
        descriptors.addAll(corridorBoundaryDescriptors(projectedLayout.corridors(), projectedLayout, connectionSegments, probe.levelZ()));
        descriptors.addAll(doorDescriptors(projectedLayout, probe.levelZ()));
        return List.copyOf(descriptors);
    }

    private static Set<GridSegment> occupiedDoorSegments(DungeonLayout layout) {
        LinkedHashSet<GridSegment> segments = new LinkedHashSet<>();
        for (Door door : layout == null ? List.<Door>of() : layout.doors()) {
            if (door == null) {
                continue;
            }
            segments.addAll(door.boundarySegments());
        }
        return Set.copyOf(segments);
    }

    private static List<DungeonHitDescriptor> roomBoundaryDescriptors(
            List<RoomCluster> projectedClusters,
            DungeonLayout projectedLayout,
            Set<GridSegment> connectionSegments,
            int levelZ
    ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (RoomCluster cluster : projectedClusters) {
            for (Room room : cluster.roomTopology().rooms()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                Structure roomStructure = cluster.roomTopology().structureFor(room);
                var boundary = roomStructure.boundaryAtLevel(levelZ);
                for (GridSegment segment2x : boundary.boundaryEdges()) {
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
        Map<DungeonSelectionRef.DoorRef, LinkedHashSet<GridSegment>> segmentsByDoor = new LinkedHashMap<>();
        for (Door door : layout == null ? List.<Door>of() : layout.doors()) {
            if (door == null) {
                continue;
            }
            for (GridSegment segment2x : door.boundarySegments()) {
                DungeonSelectionRef.DoorRef ref = layout.doorSelectionRefAt(levelZ, segment2x);
                if (ref == null) {
                    continue;
                }
                segmentsByDoor.computeIfAbsent(ref, ignored -> new LinkedHashSet<>()).add(segment2x);
            }
        }
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Map.Entry<DungeonSelectionRef.DoorRef, LinkedHashSet<GridSegment>> entry : segmentsByDoor.entrySet()) {
            descriptors.add(new DungeonHitDescriptor(
                    entry.getKey(),
                    List.of(new DungeonHitSurface.SegmentSurface(Set.copyOf(entry.getValue()), levelZ))));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> corridorBoundaryDescriptors(
            List<Corridor> corridors,
            DungeonLayout projectedLayout,
            Set<GridSegment> connectionSegments,
            int levelZ
    ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Corridor corridor : corridors) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            Set<GridSegment> openingEdges = corridor.boundaryDoorSegments(projectedLayout);
            for (GridSegment segment2x : corridor.boundaryAtLevel(levelZ).boundaryEdges()) {
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
