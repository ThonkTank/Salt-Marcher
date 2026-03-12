package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.model.PassageDirection;
import features.world.dungeonmap.service.DungeonTopologyReconcileContext;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonTopologyContextFactory {

    DungeonTopologyReconcileContext forSquareEdits(List<DungeonSquare> squares, List<DungeonSquarePaint> edits) {
        if (squares == null || edits == null || edits.isEmpty()) {
            return DungeonTopologyReconcileContext.empty();
        }
        Map<String, DungeonSquare> squaresByCoord = squaresByCoord(squares);
        Set<Long> roomIds = new LinkedHashSet<>();
        LinkedHashMap<String, DungeonTopologyReconcileContext.EditedCell> componentPriorityCells = new LinkedHashMap<>();
        for (DungeonSquarePaint edit : edits) {
            DungeonSquare square = squaresByCoord.get(coordKey(edit.x(), edit.y()));
            addRoomId(roomIds, square);
            addRoomId(roomIds, squaresByCoord.get(coordKey(edit.x() - 1, edit.y())));
            addRoomId(roomIds, squaresByCoord.get(coordKey(edit.x(), edit.y() - 1)));
            addRoomId(roomIds, squaresByCoord.get(coordKey(edit.x() + 1, edit.y())));
            addRoomId(roomIds, squaresByCoord.get(coordKey(edit.x(), edit.y() + 1)));
            addComponentPriorityCells(componentPriorityCells, edit);
        }
        List<DungeonTopologyReconcileContext.EditedCell> editedCells = editedCellsForSquareEdits(edits);
        List<DungeonTopologyReconcileContext.EditedCell> prioritizedCells = List.copyOf(componentPriorityCells.values());
        return roomIds.isEmpty() && editedCells.isEmpty() && prioritizedCells.isEmpty()
                ? DungeonTopologyReconcileContext.empty()
                : new DungeonTopologyReconcileContext(List.copyOf(roomIds), editedCells, prioritizedCells);
    }

    DungeonTopologyReconcileContext forWallEdits(List<DungeonSquare> squares, List<DungeonWallEdit> edits) {
        if (squares == null || edits == null || edits.isEmpty()) {
            return DungeonTopologyReconcileContext.empty();
        }
        Map<String, DungeonSquare> squaresByCoord = squaresByCoord(squares);
        Set<Long> roomIds = new LinkedHashSet<>();
        for (DungeonWallEdit edit : edits) {
            addRoomId(roomIds, squaresByCoord.get(coordKey(edit.x(), edit.y())));
            if (edit.direction() == PassageDirection.EAST) {
                addRoomId(roomIds, squaresByCoord.get(coordKey(edit.x() + 1, edit.y())));
            } else {
                addRoomId(roomIds, squaresByCoord.get(coordKey(edit.x(), edit.y() + 1)));
            }
        }
        List<DungeonTopologyReconcileContext.EditedCell> editedCells = editedCellsForWallEdits(edits);
        return roomIds.isEmpty() && editedCells.isEmpty()
                ? DungeonTopologyReconcileContext.empty()
                : new DungeonTopologyReconcileContext(List.copyOf(roomIds), editedCells, editedCells);
    }

    private Map<String, DungeonSquare> squaresByCoord(List<DungeonSquare> squares) {
        Map<String, DungeonSquare> squaresByCoord = new HashMap<>();
        for (DungeonSquare square : squares) {
            squaresByCoord.put(coordKey(square.x(), square.y()), square);
        }
        return squaresByCoord;
    }

    private void addRoomId(Set<Long> roomIds, DungeonSquare square) {
        if (square != null && square.roomId() != null) {
            roomIds.add(square.roomId());
        }
    }

    private List<DungeonTopologyReconcileContext.EditedCell> editedCellsForSquareEdits(List<DungeonSquarePaint> edits) {
        LinkedHashMap<String, DungeonTopologyReconcileContext.EditedCell> deduped = new LinkedHashMap<>();
        for (DungeonSquarePaint edit : edits) {
            deduped.putIfAbsent(coordKey(edit.x(), edit.y()), new DungeonTopologyReconcileContext.EditedCell(edit.x(), edit.y()));
        }
        return List.copyOf(deduped.values());
    }

    private List<DungeonTopologyReconcileContext.EditedCell> editedCellsForWallEdits(List<DungeonWallEdit> edits) {
        LinkedHashMap<String, DungeonTopologyReconcileContext.EditedCell> deduped = new LinkedHashMap<>();
        for (DungeonWallEdit edit : edits) {
            addEditedCell(deduped, edit.x(), edit.y());
            if (edit.direction() == PassageDirection.EAST) {
                addEditedCell(deduped, edit.x() + 1, edit.y());
            } else {
                addEditedCell(deduped, edit.x(), edit.y() + 1);
            }
        }
        return List.copyOf(deduped.values());
    }

    private void addEditedCell(Map<String, DungeonTopologyReconcileContext.EditedCell> cellsByCoord, int x, int y) {
        cellsByCoord.putIfAbsent(coordKey(x, y), new DungeonTopologyReconcileContext.EditedCell(x, y));
    }

    private void addComponentPriorityCells(
            Map<String, DungeonTopologyReconcileContext.EditedCell> cellsByCoord,
            DungeonSquarePaint edit
    ) {
        if (edit.filled()) {
            addEditedCell(cellsByCoord, edit.x(), edit.y());
        }
        addEditedCell(cellsByCoord, edit.x() - 1, edit.y());
        addEditedCell(cellsByCoord, edit.x(), edit.y() - 1);
        addEditedCell(cellsByCoord, edit.x() + 1, edit.y());
        addEditedCell(cellsByCoord, edit.x(), edit.y() + 1);
    }

    private String coordKey(int x, int y) {
        return x + ":" + y;
    }
}
