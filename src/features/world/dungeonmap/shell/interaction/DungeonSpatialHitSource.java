package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonSpatialHitSource implements DungeonHitSource {

    @Override
    public List<DungeonHitDescriptor> describe(DungeonLayout layout, DungeonHitProbe probe) {
        if (layout == null || probe == null) {
            return List.of();
        }

        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        descriptors.addAll(roomDescriptors(layout, probe));
        descriptors.addAll(corridorDescriptors(layout, probe));
        descriptors.addAll(stairDescriptors(layout, probe));
        descriptors.addAll(transitionDescriptors(layout, probe));
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> roomDescriptors(DungeonLayout layout, DungeonHitProbe probe) {
        Room room = layout.roomAtCell(probe.gridCell(), probe.levelZ());
        if (room == null || room.roomId() == null || room.structure().cellCoordsAtLevel(probe.levelZ()).isEmpty()) {
            return List.of();
        }
        return List.of(new DungeonHitDescriptor(
                new DungeonHitSubject.RoomSubject(room.roomId(), room.clusterId()),
                List.of(new DungeonHitSurface.CellSurface(room.structure().cellCoordsAtLevel(probe.levelZ()), probe.levelZ()))));
    }

    private static List<DungeonHitDescriptor> corridorDescriptors(DungeonLayout layout, DungeonHitProbe probe) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Corridor corridor : layout.corridorsAtCell(probe.gridCell(), probe.levelZ())) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.CorridorSubject(corridor.corridorId(), corridor.levelZ()),
                    List.of(new DungeonHitSurface.CellSurface(
                            corridor.structure().cellCoordsAtLevel(probe.levelZ()),
                            probe.levelZ()))));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> stairDescriptors(DungeonLayout layout, DungeonHitProbe probe) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (DungeonStair stair : layout.stairsAtCell(probe.gridCell(), probe.levelZ())) {
            if (stair == null || stair.stairId() == null) {
                continue;
            }
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.StairSubject(stair.stairId()),
                    List.of(new DungeonHitSurface.CellSurface(Set.of(probe.gridCell()), probe.levelZ()))));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> transitionDescriptors(DungeonLayout layout, DungeonHitProbe probe) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (DungeonTransition transition : layout.transitionsAtCell(probe.gridCell(), probe.levelZ())) {
            if (transition == null || transition.transitionId() == null || transition.anchor() == null) {
                continue;
            }
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.TransitionSubject(transition.transitionId()),
                    List.of(new DungeonHitSurface.CellSurface(
                            Set.of(transition.anchor().projectedCell()),
                            transition.anchor().z()))));
        }
        return List.copyOf(descriptors);
    }
}
