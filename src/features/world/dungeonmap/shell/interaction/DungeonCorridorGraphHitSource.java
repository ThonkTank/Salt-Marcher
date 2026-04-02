package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.LegacyGridPoint2x;
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
            LegacyGridPoint2x point2x = node.point2x().toLegacyRaw();
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.CorridorNodeSubject(corridor.corridorId(), node.nodeId(), point2x),
                    List.of(new DungeonHitSurface.PointSurface(point2x, levelZ))));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> cornerDescriptors(Corridor corridor, int levelZ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Corridor.CorridorRoute route : corridor.routes()) {
            for (GridPoint2x cornerPoint : route.cornerPoints2x()) {
                LegacyGridPoint2x legacyCorner = cornerPoint.toLegacyRaw();
                descriptors.add(new DungeonHitDescriptor(
                        new DungeonHitSubject.CorridorCornerSubject(corridor.corridorId(), route.segmentId(), legacyCorner),
                        List.of(new DungeonHitSurface.PointSurface(legacyCorner, levelZ))));
            }
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> segmentDescriptors(Corridor corridor, int levelZ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Corridor.CorridorRoute route : corridor.routes()) {
            if (route.segmentId() == null || route.path2x().isEmpty()) {
                continue;
            }
            ArrayList<DungeonHitSurface> surfaces = new ArrayList<>();
            for (GridSegment2x segment2x : route.segments2x()) {
                surfaces.add(new DungeonHitSurface.SegmentSurface(segment2x.toLegacyRaw(), levelZ));
            }
            if (surfaces.isEmpty()) {
                continue;
            }
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.CorridorSegmentSubject(
                            corridor.corridorId(),
                            route.segmentId(),
                            canonicalSegmentPoint(route.path2x())),
                    surfaces));
        }
        return List.copyOf(descriptors);
    }

    private static LegacyGridPoint2x canonicalSegmentPoint(List<GridPoint2x> path2x) {
        return path2x.get(path2x.size() / 2).toLegacyRaw();
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
