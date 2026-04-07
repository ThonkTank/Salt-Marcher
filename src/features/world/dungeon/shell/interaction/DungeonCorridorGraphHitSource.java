package features.world.dungeon.shell.interaction;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorPathTrace;
import features.world.dungeon.dungeonmap.corridor.model.CorridorWaypoint;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

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
        for (CorridorWaypoint waypoint : corridor.waypoints()) {
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonSelectionRef.CorridorNodeRef(corridor.corridorId(), waypoint.waypointId(), waypoint.point()),
                    List.of(new DungeonHitSurface.PointSurface(Set.of(waypoint.point()), levelZ))));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> segmentDescriptors(Corridor corridor, int levelZ) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (CorridorPathTrace trace : corridor.pathTraces()) {
            if (trace.path().isEmpty()) {
                continue;
            }
            Set<GridSegment> segments2x = Set.copyOf(trace.segments());
            if (segments2x.isEmpty()) {
                continue;
            }
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonSelectionRef.CorridorSegmentRef(
                            corridor.corridorId(),
                            trace.memberId(),
                            trace.segmentOrdinal(),
                            trace.canonicalPoint()),
                    List.of(new DungeonHitSurface.SegmentSurface(segments2x, levelZ))));
        }
        return List.copyOf(descriptors);
    }
}
