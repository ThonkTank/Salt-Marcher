package features.world.dungeon.shell.interaction;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.model.structures.stair.DungeonStair;
import features.world.dungeon.model.structures.transition.DungeonTransition;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonSpatialHitSource implements DungeonHitSource {

    @Override
    public List<DungeonHitDescriptor> describe(DungeonMap layout, DungeonHitProbe probe) {
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

    private static List<DungeonHitDescriptor> roomDescriptors(DungeonMap layout, DungeonHitProbe probe) {
        Room room = roomAtCell(layout, probe.gridCell(), probe.levelZ());
        Set<GridPoint> roomCells = room == null
                ? Set.of()
                : roomStructure(layout, room).surfaceAtLevel(probe.levelZ()).surface().cellFootprint().cells();
        if (room == null || room.roomId() == null || roomCells.isEmpty()) {
            return List.of();
        }
        return List.of(new DungeonHitDescriptor(
                new DungeonSelectionRef.RoomRef(room.roomId()),
                List.of(new DungeonHitSurface.CellSurface(roomCells, probe.levelZ()))));
    }

    private static List<DungeonHitDescriptor> corridorDescriptors(DungeonMap layout, DungeonHitProbe probe) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Corridor corridor : layout.corridorsAtCell(probe.gridCell(), probe.levelZ())) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonSelectionRef.CorridorTileRef(
                            corridor.corridorId(),
                            features.world.dungeon.geometry.GridPoint.cell(
                                    probe.gridCell().x2() / 2,
                                    probe.gridCell().y2() / 2,
                                    probe.levelZ()),
                            probe.gridCell()),
                    List.of(new DungeonHitSurface.CellSurface(Set.of(probe.gridCell()), probe.levelZ()))));
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonSelectionRef.CorridorRef(corridor.corridorId()),
                    List.of(new DungeonHitSurface.CellSurface(
                            corridor.surfaceAtLevel(probe.levelZ()).surface().cellFootprint().cells(),
                            probe.levelZ()))));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> stairDescriptors(DungeonMap layout, DungeonHitProbe probe) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (DungeonStair stair : layout.stairsAtCell(probe.gridCell(), probe.levelZ())) {
            if (stair == null || stair.stairId() == null) {
                continue;
            }
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonSelectionRef.StairRef(stair.stairId()),
                    List.of(new DungeonHitSurface.CellSurface(Set.of(probe.gridCell()), probe.levelZ()))));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> transitionDescriptors(DungeonMap layout, DungeonHitProbe probe) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (DungeonTransition transition : layout.transitionsAtLevel(probe.levelZ())) {
            if (transition == null || transition.transitionId() == null || transition.localConnection() == null) {
                continue;
            }
            if (transition.localConnection().doorCarrier() != null) {
                GridSegment anchorSegment = transition.localConnection().anchorSegment(layout);
                if (anchorSegment == null || !anchorSegment.cellFootprint().contains(probe.gridCell())) {
                    continue;
                }
                descriptors.add(new DungeonHitDescriptor(
                        new DungeonSelectionRef.TransitionRef(transition.transitionId()),
                        List.of(new DungeonHitSurface.SegmentSurface(
                                Set.of(anchorSegment),
                                transition.localConnection().levelZ()))));
                continue;
            }
            Set<GridPoint> occupiedCells = transition.localConnection().cellFootprint(layout).cells().stream()
                    .filter(point -> point != null && point.z() == probe.levelZ())
                    .filter(cell -> cell.equals(probe.gridCell()))
                    .collect(java.util.stream.Collectors.toSet());
            if (occupiedCells.isEmpty()) {
                continue;
            }
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonSelectionRef.TransitionRef(transition.transitionId()),
                    List.of(new DungeonHitSurface.CellSurface(occupiedCells, probe.levelZ()))));
        }
        return List.copyOf(descriptors);
    }

    private static Room roomAtCell(DungeonMap layout, GridPoint cell, int levelZ) {
        Cluster cluster = layout == null ? null : layout.clusterAtCell(cell, levelZ);
        return cluster == null ? null : cluster.roomTopology().roomAt(cell, levelZ);
    }

    private static Structure roomStructure(DungeonMap layout, Room room) {
        if (layout == null || room == null) {
            return Structure.empty();
        }
        Cluster cluster = layout.findCluster(room.clusterId());
        return cluster == null ? Structure.empty() : cluster.roomTopology().structureFor(room);
    }
}
