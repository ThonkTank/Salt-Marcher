package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;

import java.util.ArrayList;
import java.util.List;

public final class DungeonCorridorGraphHitSource implements DungeonHitSource {

    @Override
    public List<DungeonHitDescriptor> describe(DungeonLayout layout, DungeonHitProbe probe) {
        if (layout == null || probe == null) {
            return List.of();
        }

        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Corridor corridor : corridorsAtLevel(layout, probe.levelZ())) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            descriptors.addAll(nodeDescriptors(corridor, probe.levelZ()));
            descriptors.addAll(cornerDescriptors(corridor, probe.levelZ()));
            descriptors.addAll(segmentDescriptors(corridor, probe.levelZ()));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> nodeDescriptors(Corridor corridor, int levelZ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (CorridorNode node : corridor.persistedManualNodes()) {
            Point2i doubledPoint = new Point2i(node.gridX2(), node.gridY2());
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.CorridorNodeSubject(corridor.corridorId(), node.nodeId(), doubledPoint),
                    List.of(new DungeonHitSurface.DoubledPointSurface(doubledPoint, levelZ))));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> cornerDescriptors(Corridor corridor, int levelZ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Corridor.CorridorRoute route : corridor.routes()) {
            for (Point2i cornerPoint : route.cornerPoints()) {
                descriptors.add(new DungeonHitDescriptor(
                        new DungeonHitSubject.CorridorCornerSubject(corridor.corridorId(), route.segmentId(), cornerPoint),
                        List.of(new DungeonHitSurface.DoubledPointSurface(cornerPoint, levelZ))));
            }
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> segmentDescriptors(Corridor corridor, int levelZ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Corridor.CorridorRoute route : corridor.routes()) {
            if (route.segmentId() == null || route.doubledPath().isEmpty()) {
                continue;
            }
            ArrayList<DungeonHitSurface> surfaces = new ArrayList<>();
            for (VertexEdge edge : route.doubledEdges()) {
                surfaces.add(new DungeonHitSurface.DoubledEdgeSurface(edge, levelZ));
            }
            if (surfaces.isEmpty()) {
                continue;
            }
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.CorridorSegmentSubject(
                            corridor.corridorId(),
                            route.segmentId(),
                            canonicalSegmentPoint(route.doubledPath())),
                    surfaces));
        }
        return List.copyOf(descriptors);
    }

    private static Point2i canonicalSegmentPoint(List<Point2i> doubledPath) {
        return doubledPath.get(doubledPath.size() / 2);
    }

    private static List<Corridor> corridorsAtLevel(DungeonLayout layout, int levelZ) {
        if (layout == null) {
            return List.of();
        }
        return layout.corridors().stream()
                .filter(corridor -> corridor != null && corridor.levelZ() == levelZ)
                .toList();
    }
}
