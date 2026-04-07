package features.world.dungeon.shell.interaction;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonBoundaryHitSource implements DungeonHitSource {

    @Override
    public List<DungeonHitDescriptor> describe(DungeonMap layout, DungeonHitProbe probe) {
        if (layout == null || probe == null) {
            return List.of();
        }

        DungeonMap projectedLayout = layout.projectedToLevel(probe.levelZ());
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        List<Cluster> projectedClusters = projectedLayout.clusters();
        Set<GridSegment> connectionSegments = occupiedDoorSegments(projectedLayout);

        descriptors.addAll(roomBoundaryDescriptors(projectedClusters, projectedLayout, connectionSegments, probe.levelZ()));
        descriptors.addAll(corridorBoundaryDescriptors(projectedLayout.corridors(), projectedLayout, connectionSegments, probe.levelZ()));
        descriptors.addAll(doorDescriptors(projectedLayout, probe.levelZ()));
        return List.copyOf(descriptors);
    }

    private static Set<GridSegment> occupiedDoorSegments(DungeonMap layout) {
        LinkedHashSet<GridSegment> segments = new LinkedHashSet<>();
        for (Door door : layout == null ? List.<Door>of() : layout.doors()) {
            if (door == null) {
                continue;
            }
            segments.addAll(door.boundary().segments());
        }
        return Set.copyOf(segments);
    }

    private static List<DungeonHitDescriptor> roomBoundaryDescriptors(
            List<Cluster> projectedClusters,
            DungeonMap projectedLayout,
            Set<GridSegment> connectionSegments,
            int levelZ
    ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Cluster cluster : projectedClusters) {
            for (Room room : cluster.roomTopology().rooms()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                Structure roomStructure = cluster.roomTopology().structureFor(room);
                var boundary = roomStructure.boundaryAtLevel(levelZ);
                for (GridSegment segment2x : boundary.boundary().segments()) {
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
            DungeonMap layout,
            int levelZ
    ) {
        Map<DungeonSelectionRef.DoorRef, LinkedHashSet<GridSegment>> segmentsByDoor = new LinkedHashMap<>();
        for (Door door : layout == null ? List.<Door>of() : layout.doors()) {
            if (door == null) {
                continue;
            }
            for (GridSegment segment2x : door.boundary().segments()) {
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
            DungeonMap projectedLayout,
            Set<GridSegment> connectionSegments,
            int levelZ
    ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Corridor corridor : corridors) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            Set<GridSegment> openingEdges = corridor.boundaryDoorBoundary().segments();
            for (GridSegment segment2x : corridor.boundaryAtLevel(levelZ).boundary().segments()) {
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
