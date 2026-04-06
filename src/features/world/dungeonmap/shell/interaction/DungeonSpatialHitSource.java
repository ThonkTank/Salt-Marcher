package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
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
        Set<CellCoord> roomCells = room == null ? Set.of() : layout.roomCellsAtLevel(room, probe.levelZ());
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
                            features.world.dungeonmap.model.geometry.CubePoint.at(probe.gridCell(), probe.levelZ()),
                            features.world.dungeonmap.model.geometry.GridPoint2x.cell(probe.gridCell())),
                    List.of(new DungeonHitSurface.CellSurface(Set.of(probe.gridCell()), probe.levelZ()))));
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonSelectionRef.CorridorRef(corridor.corridorId()),
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
                if (!transition.localConnection().anchorSegment2x().touchingCells().contains(probe.gridCell())) {
                    continue;
                }
                descriptors.add(new DungeonHitDescriptor(
                        new DungeonSelectionRef.TransitionRef(transition.transitionId()),
                        List.of(new DungeonHitSurface.SegmentSurface(
                                Set.of(transition.localConnection().anchorSegment2x()),
                                transition.localConnection().levelZ()))));
                continue;
            }
            Set<CellCoord> occupiedCells = transition.localConnection().occupiedPositions(layout).stream()
                    .filter(point -> point != null && point.z() == probe.levelZ())
                    .map(point -> point.projectedCell())
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
}
