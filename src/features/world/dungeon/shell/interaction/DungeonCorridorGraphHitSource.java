package features.world.dungeon.shell.interaction;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorInputNode;
import features.world.dungeon.dungeonmap.corridor.model.CorridorPathTrace;

import java.util.ArrayList;
import java.util.List;

public final class DungeonCorridorGraphHitSource implements DungeonHitSource {

    @Override
    public List<DungeonHitDescriptor> describe(DungeonMap layout, DungeonHitProbe probe) {
        if (layout == null || probe == null) {
            return List.of();
        }

        DungeonMap projectedLayout = layout.projectedToLevel(probe.levelZ());
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Corridor corridor : projectedLayout.corridors()) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            descriptors.addAll(nodeDescriptors(corridor, probe.levelZ()));
            descriptors.addAll(segmentDescriptors(corridor, probe.levelZ()));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> nodeDescriptors(Corridor corridor, int levelZ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (CorridorInputNode waypoint : corridor.fixedNodes()) {
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonSelectionRef.CorridorNodeRef(corridor.corridorId(), waypoint.nodeId(), waypoint.fixedPoint()),
                    List.of(new DungeonHitSurface.PointSurface(waypoint.fixedPoint(), levelZ))));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> segmentDescriptors(Corridor corridor, int levelZ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (CorridorPathTrace trace : corridor.pathTraces()) {
            if (trace.path().isEmpty()) {
                continue;
            }
            if (trace.segmentPath().isEmpty()) {
                continue;
            }
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonSelectionRef.CorridorSegmentRef(
                            corridor.corridorId(),
                            trace.segmentId(),
                            trace.canonicalPoint()),
                    List.of(new DungeonHitSurface.SegmentSurface(trace.segmentPath().boundary(), levelZ))));
        }
        return List.copyOf(descriptors);
    }
}
