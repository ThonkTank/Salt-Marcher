package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.map.model.DungeonLayout;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.map.structure.model.Structure;
import features.world.dungeonmap.map.cluster.model.RoomCluster;
import features.world.dungeonmap.map.corridor.model.Corridor;
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
        Room room = roomAtCell(layout, probe.gridCell(), probe.levelZ());
        Set<GridPoint> roomCells = room == null
                ? Set.of()
                : roomStructure(layout, room).surfaceAtLevel(probe.levelZ()).surface().cells();
        if (room == null || room.roomId() == null || roomCells.isEmpty()) {
            return List.of();
        }
        return List.of(new DungeonHitDescriptor(
                new DungeonSelectionRef.RoomRef(room.roomId()),
                List.of(new DungeonHitSurface.CellSurface(roomCells, probe.levelZ()))));
    }

    private static List<DungeonHitDescriptor> corridorDescriptors(DungeonLayout layout, DungeonHitProbe probe) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Corridor corridor : layout.corridorsAtCell(probe.gridCell(), probe.levelZ())) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonSelectionRef.CorridorTileRef(
                            corridor.corridorId(),
                            features.world.dungeonmap.geometry.GridPoint.cell(
                                    probe.gridCell().cellX(),
                                    probe.gridCell().cellY(),
                                    probe.levelZ()),
                            probe.gridCell()),
                    List.of(new DungeonHitSurface.CellSurface(Set.of(probe.gridCell()), probe.levelZ()))));
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonSelectionRef.CorridorRef(corridor.corridorId()),
                    List.of(new DungeonHitSurface.CellSurface(
                            corridor.surfaceAtLevel(probe.levelZ()).surface().cells(),
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
                    new DungeonSelectionRef.StairRef(stair.stairId()),
                    List.of(new DungeonHitSurface.CellSurface(Set.of(probe.gridCell()), probe.levelZ()))));
        }
        return List.copyOf(descriptors);
    }

    private static List<DungeonHitDescriptor> transitionDescriptors(DungeonLayout layout, DungeonHitProbe probe) {
        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (DungeonTransition transition : layout.transitionsAtLevel(probe.levelZ())) {
            if (transition == null || transition.transitionId() == null || transition.localConnection() == null) {
                continue;
            }
            if (transition.localConnection().doorCarrier() != null) {
                GridSegment anchorSegment = transition.localConnection().anchorSegment(layout);
                if (anchorSegment == null || !anchorSegment.touchingCells().contains(probe.gridCell())) {
                    continue;
                }
                descriptors.add(new DungeonHitDescriptor(
                        new DungeonSelectionRef.TransitionRef(transition.transitionId()),
                        List.of(new DungeonHitSurface.SegmentSurface(
                                Set.of(anchorSegment),
                                transition.localConnection().levelZ()))));
                continue;
            }
            Set<GridPoint> occupiedCells = transition.localConnection().occupiedPositions(layout).stream()
                    .filter(point -> point != null && point.z() == probe.levelZ())
                    .map(DungeonSpatialHitSource::projectedCell)
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

    private static Room roomAtCell(DungeonLayout layout, GridPoint cell, int levelZ) {
        RoomCluster cluster = layout == null ? null : layout.clusterAtCell(cell, levelZ);
        return cluster == null ? null : cluster.roomTopology().roomAt(cell, levelZ);
    }

    private static Structure roomStructure(DungeonLayout layout, Room room) {
        if (layout == null || room == null) {
            return Structure.empty();
        }
        RoomCluster cluster = layout.findCluster(room.clusterId());
        return cluster == null ? Structure.empty() : cluster.roomTopology().structureFor(room);
    }

    private static GridPoint projectedCell(GridPoint point) {
        return point == null ? null : point.touchingCells().center();
    }
}
