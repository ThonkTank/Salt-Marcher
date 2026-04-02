package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.connection.LocalConnection;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
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

        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        List<RoomCluster> projectedClusters = projectedClusters(layout, probe.levelZ());
        Set<CellCoord> occupiedRoomCells = occupiedRoomCells(projectedClusters);
        Set<GridSegment2x> connectionSegments = connectionSegments(projectedClusters, layout, probe.levelZ());

        descriptors.addAll(clusterBoundaryDescriptors(projectedClusters, probe.levelZ()));
        descriptors.addAll(roomBoundaryDescriptors(projectedClusters, occupiedRoomCells, connectionSegments, probe.levelZ()));
        descriptors.addAll(connectionDescriptors(projectedClusters, layout, probe.levelZ()));
        return List.copyOf(descriptors);
    }

    private static List<RoomCluster> projectedClusters(DungeonLayout layout, int levelZ) {
        ArrayList<RoomCluster> clusters = new ArrayList<>();
        for (RoomCluster cluster : layout.clusters()) {
            if (cluster == null) {
                continue;
            }
            RoomCluster projected = cluster.projectedToLevel(levelZ);
            if (projected != null) {
                clusters.add(projected);
            }
        }
        return List.copyOf(clusters);
    }

    private static Set<CellCoord> occupiedRoomCells(List<RoomCluster> projectedClusters) {
        LinkedHashSet<CellCoord> cells = new LinkedHashSet<>();
        for (RoomCluster cluster : projectedClusters) {
            for (Room room : cluster.rooms()) {
                if (room != null) {
                    cells.addAll(room.structure().cellCoords());
                }
            }
        }
        return Set.copyOf(cells);
    }

    private static Set<GridSegment2x> connectionSegments(List<RoomCluster> projectedClusters, DungeonLayout layout, int levelZ) {
        LinkedHashSet<GridSegment2x> segments = new LinkedHashSet<>();
        for (RoomCluster cluster : projectedClusters) {
            for (var connection : cluster.localConnections()) {
                if (connection == null || connection.door() == null) {
                    continue;
                }
                segments.addAll(GridSegment2x.fromLegacyBoundaryEdges(connection.door().segments2x()));
            }
        }
        for (Corridor corridor : corridorsAtLevel(layout, levelZ)) {
            for (var connection : corridor.connections()) {
                if (connection == null || connection.door() == null || connection.levelZ() != levelZ) {
                    continue;
                }
                segments.addAll(GridSegment2x.fromLegacyBoundaryEdges(connection.door().segments2x()));
            }
        }
        return Set.copyOf(segments);
    }

    private static List<DungeonHitDescriptor> clusterBoundaryDescriptors(List<RoomCluster> projectedClusters, int levelZ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (RoomCluster cluster : projectedClusters) {
            if (cluster.clusterId() == null) {
                continue;
            }
            for (Map.Entry<GridSegment2x, InternalBoundaryType> entry : cluster.internalBoundaryKinds().entrySet()) {
                GridSegment2x segment = entry.getKey();
                if (segment == null) {
                    continue;
                }
                CellCoord baseCell = segment.touchingCells().stream()
                        .filter(cluster::contains)
                        .sorted(CellCoord.ORDER)
                        .findFirst()
                        .orElse(null);
                CardinalDirection direction = baseCell == null
                        ? null
                        : segment.directionFrom(baseCell);
                if (baseCell == null || direction == null) {
                    continue;
                }
                descriptors.add(new DungeonHitDescriptor(
                        new DungeonHitSubject.ClusterBoundarySubject(
                                cluster.clusterId(),
                                segment,
                                entry.getValue(),
                                baseCell,
                                direction),
                        List.of(new DungeonHitSurface.SegmentSurface(Set.of(segment), levelZ))));
            }
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> roomBoundaryDescriptors(
            List<RoomCluster> projectedClusters,
            Set<CellCoord> occupiedRoomCells,
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
                    RoomBoundaryGeometry geometry = roomBoundaryGeometry(room, occupiedRoomCells, segment2x, levelZ);
                    if (geometry == null) {
                        continue;
                    }
                    descriptors.add(new DungeonHitDescriptor(
                            new DungeonHitSubject.RoomBoundarySubject(
                                    room.roomId(),
                                    room.clusterId(),
                                    segment2x,
                                    geometry.roomCell(),
                                    geometry.outwardDirection(),
                                    geometry.exterior()),
                            List.of(new DungeonHitSurface.SegmentSurface(Set.of(segment2x), levelZ))));
                }
            }
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> connectionDescriptors(
            List<RoomCluster> projectedClusters,
            DungeonLayout layout,
            int levelZ
    ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (RoomCluster cluster : projectedClusters) {
            for (LocalConnection connection : cluster.localConnections()) {
                descriptors.addAll(connectionDescriptors(connection, levelZ));
            }
        }
        for (Corridor corridor : corridorsAtLevel(layout, levelZ)) {
            for (CorridorConnection connection : corridor.connections()) {
                descriptors.addAll(connectionDescriptors(connection, connection.levelZ()));
            }
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> connectionDescriptors(Connection connection, int levelZ) {
        if (connection == null || connection.door() == null) {
            return List.of();
        }
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (GridSegment2x segment2x : GridSegment2x.fromLegacyBoundaryEdges(connection.door().segments2x())) {
            if (segment2x == null) {
                continue;
            }
            Long clusterId = connection instanceof LocalConnection localConnection ? localConnection.clusterId() : null;
            Long corridorId = connection instanceof CorridorConnection corridorConnection ? corridorConnection.corridorId() : null;
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.ConnectionSubject(connection.kind(), clusterId, corridorId, segment2x),
                    List.of(new DungeonHitSurface.SegmentSurface(Set.of(segment2x), levelZ))));
        }
        return List.copyOf(descriptors);
    }

    private static List<Corridor> corridorsAtLevel(DungeonLayout layout, int levelZ) {
        if (layout == null) {
            return List.of();
        }
        return layout.corridors().stream()
                .filter(corridor -> corridor != null && corridor.levelZ() == levelZ)
                .toList();
    }

    private static RoomBoundaryGeometry roomBoundaryGeometry(
            Room room,
            Set<CellCoord> occupiedRoomCells,
            GridSegment2x segment2x,
            int levelZ
    ) {
        if (room == null || segment2x == null) {
            return null;
        }
        // Boundary hits expose the owning room cell plus outward cardinal step for tool semantics,
        // while the shared boundary itself stays on the 2x segment.
        for (CellCoord cell : segment2x.touchingCells().stream().sorted(CellCoord.ORDER).toList()) {
            if (!room.structure().cellCoordsAtLevel(levelZ).contains(cell)) {
                continue;
            }
            CardinalDirection outwardDirection = segment2x.directionFrom(cell);
            CellCoord opposite = outwardDirection == null ? null : cell.add(outwardDirection.delta());
            boolean exterior = opposite == null || !occupiedRoomCells.contains(opposite);
            return new RoomBoundaryGeometry(cell, outwardDirection, exterior);
        }
        return null;
    }

    private record RoomBoundaryGeometry(CellCoord roomCell, CardinalDirection outwardDirection, boolean exterior) {
    }
}
