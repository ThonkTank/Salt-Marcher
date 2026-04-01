package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridShapes;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DungeonSpatialHitSource implements DungeonHitSource {

    @Override
    public List<DungeonHitDescriptor> describe(DungeonLayout layout, DungeonHitProbe probe) {
        if (layout == null || probe == null) {
            return List.of();
        }

        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        CubePoint point = CubePoint.at(probe.gridCell(), probe.levelZ());

        descriptors.addAll(roomDescriptors(layout, point, probe.levelZ()));
        descriptors.addAll(corridorDescriptors(layout, probe));
        descriptors.addAll(stairDescriptors(layout, probe));
        descriptors.addAll(transitionDescriptors(layout, probe));
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> roomDescriptors(DungeonLayout layout, CubePoint point, int levelZ) {
        Map<Long, DungeonHitDescriptor> descriptorsByRoomId = new LinkedHashMap<>();
        for (RoomCluster cluster : layout.clusters()) {
            if (cluster == null) {
                continue;
            }
            Room room = cluster.roomAt(point);
            if (room == null || room.roomId() == null || room.geometry().floorAtLevel(levelZ) == null) {
                continue;
            }
            descriptorsByRoomId.putIfAbsent(
                    room.roomId(),
                    new DungeonHitDescriptor(
                            new DungeonHitSubject.RoomSubject(room.roomId(), room.clusterId()),
                            List.of(new DungeonHitSurface.ShapeSurface(room.structure().floorAtLevel(levelZ).shape2x(), levelZ))));
        }
        return List.copyOf(descriptorsByRoomId.values());
    }

    private static List<DungeonHitDescriptor> corridorDescriptors(DungeonLayout layout, DungeonHitProbe probe) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Corridor corridor : layout.corridorsAtCell(probe.gridCell(), probe.levelZ())) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.CorridorSubject(corridor.corridorId(), corridor.levelZ()),
                    List.of(new DungeonHitSurface.ShapeSurface(
                            corridor.structure().floorAtLevel(probe.levelZ()).shape2x(),
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
                    List.of(new DungeonHitSurface.ShapeSurface(GridShapes.tile(probe.gridCell()), probe.levelZ()))));
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
                    List.of(new DungeonHitSurface.ShapeSurface(
                            GridShapes.tile(transition.anchor().projectedCell()),
                            transition.anchor().z()))));
        }
        return List.copyOf(descriptors);
    }
}
