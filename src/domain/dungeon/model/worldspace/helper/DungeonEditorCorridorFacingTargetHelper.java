package src.domain.dungeon.model.worldspace.helper;

import java.util.LinkedHashSet;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.PendingCorridorTarget;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

public final class DungeonEditorCorridorFacingTargetHelper {

    public PendingCorridorTarget resolveFacingTarget(
            PendingCorridorTarget target,
            PendingCorridorTarget other,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot
    ) {
        if (!genericRoomTarget(target)) {
            return target;
        }
        DungeonEditorWorkspaceValues.CorridorDoorEndpoint door =
                (DungeonEditorWorkspaceValues.CorridorDoorEndpoint) target.endpoint();
        FacingDoor facingDoor = facingDoor(roomAreaById(snapshot, door.roomId()), corridorCell(other.endpoint()));
        return facingDoor == null ? target : new PendingCorridorTarget.EndpointTarget(
                target.targetKey(),
                target.displayLabel(),
                target.selection(),
                target.deleteCorridorId(),
                new DungeonEditorWorkspaceValues.CorridorDoorEndpoint(
                        door.roomId(),
                        door.clusterId(),
                        facingDoor.roomCell(),
                        facingDoor.direction().name(),
                        door.topologyRef()));
    }

    private static @Nullable FacingDoor facingDoor(
            DungeonEditorWorkspaceValues.@Nullable Area room,
            DungeonEditorWorkspaceValues.@Nullable Cell otherCell
    ) {
        if (room == null || otherCell == null) {
            return null;
        }
        Set<CellKey> roomCells = cellKeys(room);
        FacingDoor result = null;
        for (DungeonEditorWorkspaceValues.Cell cell : room.cells()) {
            result = betterFacingDoorFromCell(cell, roomCells, otherCell, result);
        }
        return result;
    }

    private static @Nullable FacingDoor betterFacingDoorFromCell(
            DungeonEditorWorkspaceValues.Cell cell,
            Set<CellKey> roomCells,
            DungeonEditorWorkspaceValues.Cell otherCell,
            @Nullable FacingDoor current
    ) {
        CellKey key = new CellKey(cell.q(), cell.r(), cell.level());
        FacingDoor result = current;
        for (TravelHeading direction : TravelHeading.values()) {
            CellKey corridorKey = key.neighbor(direction);
            if (!roomCells.contains(corridorKey)) {
                FacingDoor candidate = new FacingDoor(
                        cell,
                        direction,
                        new DungeonEditorWorkspaceValues.Cell(corridorKey.q(), corridorKey.r(), corridorKey.level()));
                if (result == null || betterFacingDoor(candidate, result, otherCell)) {
                    result = candidate;
                }
            }
        }
        return result;
    }

    private static boolean betterFacingDoor(
            FacingDoor candidate,
            FacingDoor current,
            DungeonEditorWorkspaceValues.Cell otherCell
    ) {
        int distanceComparison = Integer.compare(
                manhattan(candidate.corridorCell(), otherCell),
                manhattan(current.corridorCell(), otherCell));
        if (distanceComparison != 0) {
            return distanceComparison < 0;
        }
        int rowComparison = Integer.compare(candidate.roomCell().r(), current.roomCell().r());
        if (rowComparison != 0) {
            return rowComparison < 0;
        }
        return candidate.roomCell().q() != current.roomCell().q()
                ? candidate.roomCell().q() < current.roomCell().q()
                : candidate.direction().name().compareTo(current.direction().name()) < 0;
    }

    private static boolean genericRoomTarget(PendingCorridorTarget target) {
        if (!(target.endpoint() instanceof DungeonEditorWorkspaceValues.CorridorDoorEndpoint door)) {
            return false;
        }
        return !door.topologyRef().present()
                && target.targetKey().equals(DungeonEditorMainViewInteractionValues.ROOM_PREFIX + door.roomId());
    }

    private static DungeonEditorWorkspaceValues.@Nullable Cell corridorCell(
            DungeonEditorWorkspaceValues.CorridorEndpoint endpoint
    ) {
        return switch (endpoint) {
            case DungeonEditorWorkspaceValues.CorridorDoorEndpoint door -> doorCorridorCell(door);
            case DungeonEditorWorkspaceValues.CorridorAnchorEndpoint anchor -> anchor.anchorCell();
            case null -> null;
        };
    }

    private static DungeonEditorWorkspaceValues.Cell doorCorridorCell(
            DungeonEditorWorkspaceValues.CorridorDoorEndpoint door
    ) {
        return switch (door.direction()) {
            case "EAST" -> new DungeonEditorWorkspaceValues.Cell(door.roomCell().q() + 1, door.roomCell().r(), door.roomCell().level());
            case "SOUTH" -> new DungeonEditorWorkspaceValues.Cell(door.roomCell().q(), door.roomCell().r() + 1, door.roomCell().level());
            case "WEST" -> new DungeonEditorWorkspaceValues.Cell(door.roomCell().q() - 1, door.roomCell().r(), door.roomCell().level());
            default -> new DungeonEditorWorkspaceValues.Cell(door.roomCell().q(), door.roomCell().r() - 1, door.roomCell().level());
        };
    }

    private static DungeonEditorWorkspaceValues.@Nullable Area roomAreaById(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            long roomId
    ) {
        if (snapshot == null || roomId <= 0L) {
            return null;
        }
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (area.kind().isRoom() && area.id() == roomId) {
                return area;
            }
        }
        return null;
    }

    private static Set<CellKey> cellKeys(DungeonEditorWorkspaceValues.Area room) {
        Set<CellKey> result = new LinkedHashSet<>();
        for (DungeonEditorWorkspaceValues.Cell cell : room.cells()) {
            result.add(new CellKey(cell.q(), cell.r(), cell.level()));
        }
        return Set.copyOf(result);
    }

    private static int manhattan(DungeonEditorWorkspaceValues.Cell left, DungeonEditorWorkspaceValues.Cell right) {
        return Math.abs(left.q() - right.q())
                + Math.abs(left.r() - right.r())
                + Math.abs(left.level() - right.level());
    }

    private record FacingDoor(
            DungeonEditorWorkspaceValues.Cell roomCell,
            TravelHeading direction,
            DungeonEditorWorkspaceValues.Cell corridorCell
    ) {
    }
}
