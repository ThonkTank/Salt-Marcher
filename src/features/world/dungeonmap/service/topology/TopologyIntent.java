package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.editing.DungeonSquarePaint;
import features.world.dungeonmap.model.editing.DungeonWallEdit;
import features.world.dungeonmap.model.domain.PassageDirection;

import java.util.LinkedHashSet;
import java.util.List;

record TopologyIntent(
        List<DungeonSquare> previousSquares,
        List<DungeonSquarePaint> squareEdits,
        RoomSelectionContext roomSelection
) {
    TopologyIntent {
        previousSquares = previousSquares == null ? List.of() : List.copyOf(previousSquares);
        squareEdits = squareEdits == null ? List.of() : List.copyOf(squareEdits);
        roomSelection = roomSelection == null ? RoomSelectionContext.empty() : roomSelection;
    }

    static TopologyIntent geometryChange() {
        return new TopologyIntent(List.of(), List.of(), RoomSelectionContext.empty());
    }

    static TopologyIntent forSquareEdits(List<DungeonSquarePaint> edits, List<DungeonSquare> previousSquares) {
        return new TopologyIntent(
                previousSquares,
                edits,
                new RoomSelectionContext(
                        editedCellsForSquareEdits(edits),
                        componentPriorityCellsForSquareEdits(edits),
                        List.of()));
    }

    static TopologyIntent forWallEdits(List<DungeonWallEdit> edits) {
        List<EditedCell> editedCells = editedCellsForWallEdits(edits);
        return new TopologyIntent(
                List.of(),
                List.of(),
                new RoomSelectionContext(editedCells, editedCells, List.of()));
    }

    TopologyIntent withPrimaryRoomPriority(List<Long> updatedPrimaryRoomPriority) {
        return new TopologyIntent(
                previousSquares,
                squareEdits,
                roomSelection.withPrimaryRoomPriority(updatedPrimaryRoomPriority));
    }

    List<EditedCell> editedCells() {
        return roomSelection.editedCells();
    }

    List<EditedCell> componentPriorityCells() {
        return roomSelection.componentPriorityCells();
    }

    List<Long> primaryRoomPriority() {
        return roomSelection.primaryRoomPriority();
    }

    private static List<EditedCell> editedCellsForSquareEdits(List<DungeonSquarePaint> edits) {
        LinkedHashSet<EditedCell> editedCells = new LinkedHashSet<>();
        if (edits == null) {
            return List.of();
        }
        for (DungeonSquarePaint edit : edits) {
            editedCells.add(new EditedCell(edit.x(), edit.y()));
        }
        return List.copyOf(editedCells);
    }

    private static List<EditedCell> componentPriorityCellsForSquareEdits(List<DungeonSquarePaint> edits) {
        LinkedHashSet<EditedCell> editedCells = new LinkedHashSet<>();
        if (edits == null) {
            return List.of();
        }
        for (DungeonSquarePaint edit : edits) {
            if (edit.filled()) {
                editedCells.add(new EditedCell(edit.x(), edit.y()));
            }
            editedCells.add(new EditedCell(edit.x() - 1, edit.y()));
            editedCells.add(new EditedCell(edit.x(), edit.y() - 1));
            editedCells.add(new EditedCell(edit.x() + 1, edit.y()));
            editedCells.add(new EditedCell(edit.x(), edit.y() + 1));
        }
        return List.copyOf(editedCells);
    }

    private static List<EditedCell> editedCellsForWallEdits(List<DungeonWallEdit> edits) {
        LinkedHashSet<EditedCell> editedCells = new LinkedHashSet<>();
        if (edits == null) {
            return List.of();
        }
        for (DungeonWallEdit edit : edits) {
            editedCells.add(new EditedCell(edit.x(), edit.y()));
            if (edit.direction() == PassageDirection.EAST) {
                editedCells.add(new EditedCell(edit.x() + 1, edit.y()));
            } else {
                editedCells.add(new EditedCell(edit.x(), edit.y() + 1));
            }
        }
        return List.copyOf(editedCells);
    }
}

record RoomSelectionContext(
        List<EditedCell> editedCells,
        List<EditedCell> componentPriorityCells,
        List<Long> primaryRoomPriority
) {
    RoomSelectionContext {
        editedCells = editedCells == null ? List.of() : List.copyOf(editedCells);
        componentPriorityCells = componentPriorityCells == null ? List.of() : List.copyOf(componentPriorityCells);
        primaryRoomPriority = primaryRoomPriority == null ? List.of() : List.copyOf(primaryRoomPriority);
    }

    static RoomSelectionContext empty() {
        return new RoomSelectionContext(List.of(), List.of(), List.of());
    }

    RoomSelectionContext withPrimaryRoomPriority(List<Long> updatedPrimaryRoomPriority) {
        return new RoomSelectionContext(editedCells, componentPriorityCells, updatedPrimaryRoomPriority);
    }
}

record EditedCell(
        int x,
        int y
) {
}

record EdgeRef(
        int x,
        int y,
        PassageDirection direction
) {
    int adjacentX() {
        return direction == PassageDirection.EAST ? x + 1 : x;
    }

    int adjacentY() {
        return direction == PassageDirection.SOUTH ? y + 1 : y;
    }
}

enum SquarePaintOutcome {
    NEW_ROOM,
    EXTEND_EXISTING_ROOM,
    MERGE_EXISTING_ROOMS
}
