package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.connection.LocalConnection;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
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
        Set<GridSegment2x> connectionSegments = connectionSegments(projectedLayout.connections());

        descriptors.addAll(roomBoundaryDescriptors(projectedClusters, projectedLayout, connectionSegments, probe.levelZ()));
        descriptors.addAll(corridorBoundaryDescriptors(projectedLayout.corridors(), projectedLayout, connectionSegments, probe.levelZ()));
        descriptors.addAll(connectionDescriptors(projectedLayout.connections(), probe.levelZ()));
        return List.copyOf(descriptors);
    }

    private static Set<GridSegment2x> connectionSegments(List<Connection> connections) {
        LinkedHashSet<GridSegment2x> segments = new LinkedHashSet<>();
        for (Connection connection : connections) {
            if (connection == null || connection.door() == null) {
                continue;
            }
            segments.addAll(connection.door().segments2x());
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
                for (GridSegment2x segment2x : room.structure().boundaryEdgesAtLevel(levelZ)) {
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

    private static List<DungeonHitDescriptor> connectionDescriptors(
            List<Connection> connections,
            int levelZ
    ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Connection connection : connections) {
            descriptors.addAll(connectionDescriptors(connection, levelZ));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> connectionDescriptors(Connection connection, int levelZ) {
        if (connection == null || connection.door() == null) {
            return List.of();
        }
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (GridSegment2x segment2x : connection.door().segments2x()) {
            if (segment2x == null) {
                continue;
            }
            Long clusterId = connection instanceof LocalConnection localConnection ? localConnection.clusterId() : null;
            Long corridorId = connection instanceof CorridorConnection corridorConnection ? corridorConnection.corridorId() : null;
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonSelectionRef.ConnectionRef(connection.kind(), clusterId, corridorId, segment2x),
                    List.of(new DungeonHitSurface.SegmentSurface(Set.of(segment2x), levelZ))));
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
            Set<GridSegment2x> openingEdges = corridor.structure().openingEdgesAtLevel(levelZ);
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
