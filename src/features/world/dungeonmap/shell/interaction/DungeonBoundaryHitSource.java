package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
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
        Set<Point2i> occupiedRoomCells = occupiedRoomCells(projectedClusters);
        Set<VertexEdge> connectionEdges = connectionEdges(projectedClusters, layout, probe.levelZ());

        descriptors.addAll(clusterBoundaryDescriptors(projectedClusters, probe.levelZ()));
        descriptors.addAll(roomBoundaryDescriptors(projectedClusters, occupiedRoomCells, connectionEdges, probe.levelZ()));
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

    private static Set<Point2i> occupiedRoomCells(List<RoomCluster> projectedClusters) {
        LinkedHashSet<Point2i> cells = new LinkedHashSet<>();
        for (RoomCluster cluster : projectedClusters) {
            for (Room room : cluster.rooms()) {
                if (room != null) {
                    cells.addAll(room.cells());
                }
            }
        }
        return Set.copyOf(cells);
    }

    private static Set<VertexEdge> connectionEdges(List<RoomCluster> projectedClusters, DungeonLayout layout, int levelZ) {
        LinkedHashSet<VertexEdge> edges = new LinkedHashSet<>();
        for (RoomCluster cluster : projectedClusters) {
            for (var connection : cluster.localConnections()) {
                if (connection == null || connection.door() == null) {
                    continue;
                }
                edges.addAll(connection.door().edges());
            }
        }
        for (Corridor corridor : corridorsAtLevel(layout, levelZ)) {
            for (var connection : corridor.connections()) {
                if (connection == null || connection.door() == null || connection.levelZ() != levelZ) {
                    continue;
                }
                edges.addAll(connection.door().edges());
            }
        }
        return Set.copyOf(edges);
    }

    private static List<DungeonHitDescriptor> clusterBoundaryDescriptors(List<RoomCluster> projectedClusters, int levelZ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (RoomCluster cluster : projectedClusters) {
            if (cluster.clusterId() == null) {
                continue;
            }
            for (Map.Entry<VertexEdge, InternalBoundaryType> entry : cluster.internalBoundaryKinds().entrySet()) {
                VertexEdge edge = entry.getKey();
                if (edge == null) {
                    continue;
                }
                Point2i baseCell = edge.touchingCells().stream()
                        .filter(cluster::contains)
                        .sorted(Point2i.POINT_ORDER)
                        .findFirst()
                        .orElse(null);
                Point2i direction = baseCell == null ? null : edge.directionFrom(baseCell);
                if (baseCell == null || direction == null) {
                    continue;
                }
                descriptors.add(new DungeonHitDescriptor(
                        new DungeonHitSubject.ClusterBoundarySubject(
                                cluster.clusterId(),
                                edge,
                                entry.getValue(),
                                baseCell,
                                direction),
                        List.of(new DungeonHitSurface.EdgeSurface(edge, levelZ))));
            }
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> roomBoundaryDescriptors(
            List<RoomCluster> projectedClusters,
            Set<Point2i> occupiedRoomCells,
            Set<VertexEdge> connectionEdges,
            int levelZ
    ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (RoomCluster cluster : projectedClusters) {
            for (Room room : cluster.rooms()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                for (VertexEdge edge : room.boundaryEdges()) {
                    if (edge == null || connectionEdges.contains(edge)) {
                        continue;
                    }
                    RoomBoundaryGeometry geometry = roomBoundaryGeometry(room, occupiedRoomCells, edge);
                    if (geometry == null) {
                        continue;
                    }
                    descriptors.add(new DungeonHitDescriptor(
                            new DungeonHitSubject.RoomBoundarySubject(
                                    room.roomId(),
                                    room.clusterId(),
                                    edge,
                                    geometry.roomCell(),
                                    geometry.outwardStep(),
                                    geometry.exterior()),
                            List.of(new DungeonHitSurface.EdgeSurface(edge, levelZ))));
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
        for (VertexEdge edge : connection.door().edges()) {
            if (edge == null) {
                continue;
            }
            Long clusterId = connection instanceof LocalConnection localConnection ? localConnection.clusterId() : null;
            Long corridorId = connection instanceof CorridorConnection corridorConnection ? corridorConnection.corridorId() : null;
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.ConnectionSubject(connection.kind(), clusterId, corridorId, edge),
                    List.of(new DungeonHitSurface.EdgeSurface(edge, levelZ))));
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

    private static RoomBoundaryGeometry roomBoundaryGeometry(Room room, Set<Point2i> occupiedRoomCells, VertexEdge edge) {
        if (room == null || edge == null) {
            return null;
        }
        for (Point2i cell : edge.touchingCells().stream().sorted(Point2i.POINT_ORDER).toList()) {
            if (!room.contains(cell)) {
                continue;
            }
            Point2i outwardStep = edge.directionFrom(cell);
            Point2i opposite = outwardStep == null ? null : cell.add(outwardStep);
            boolean exterior = opposite == null || !occupiedRoomCells.contains(opposite);
            return new RoomBoundaryGeometry(cell, outwardStep, exterior);
        }
        return null;
    }

    private record RoomBoundaryGeometry(Point2i roomCell, Point2i outwardStep, boolean exterior) {
    }
}
