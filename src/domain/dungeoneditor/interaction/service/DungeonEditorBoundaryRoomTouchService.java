package src.domain.dungeoneditor.interaction.service;

import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryRoomTouch;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.EdgeKey;

public final class DungeonEditorBoundaryRoomTouchService {

    public boolean editableDoorBoundary(@Nullable DungeonSnapshot snapshot, @Nullable BoundaryTarget boundary, boolean deleteMode) {
        if (boundary == null || !boundary.present()) {
            return false;
        }
        if (deleteMode) {
            return boundary.doorKind();
        }
        return !boundary.doorKind() && touchingRoomCount(snapshot, boundary) >= 1;
    }

    public @Nullable BoundaryRoomTouch singleRoomTouch(
            @Nullable DungeonSnapshot snapshot,
            @Nullable BoundaryTarget boundary,
            boolean requireDoorBoundary
    ) {
        if (snapshot == null || snapshot.map() == null || boundary == null || !boundary.present()) {
            return null;
        }
        if (requireDoorBoundary != boundary.doorKind()) {
            return null;
        }
        List<DungeonCellRef> touchingCells = touchingCells(boundary.start().toDungeonCellRef(), boundary.end().toDungeonCellRef());
        List<BoundaryRoomTouch> touches = roomTouches(snapshot.map().areas(), touchingCells);
        return touches.size() == 1 ? touches.getFirst() : null;
    }

    public String boundaryDirectionForRoomCell(BoundaryTarget boundary, DungeonCellRef roomCell) {
        EdgeKey boundaryKey = EdgeKey.from(boundary.edgeRef());
        CellKey cellKey = new CellKey(roomCell.q(), roomCell.r(), roomCell.level());
        for (TravelHeading direction : TravelHeading.values()) {
            if (EdgeKey.sideOf(cellKey, direction).equals(boundaryKey)) {
                return direction.name();
            }
        }
        return "";
    }

    private int touchingRoomCount(@Nullable DungeonSnapshot snapshot, BoundaryTarget boundary) {
        if (snapshot == null || snapshot.map() == null) {
            return 0;
        }
        Set<Long> roomIds = new LinkedHashSet<>();
        List<CellKey> touchingCells = touchingCells(boundary.start().toDungeonCellRef(), boundary.end().toDungeonCellRef()).stream()
                .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                .toList();
        for (DungeonAreaSnapshot area : snapshot.map().areas()) {
            if (area.kind() != DungeonAreaKind.ROOM) {
                continue;
            }
            for (DungeonCellRef cell : area.cells()) {
                if (touchingCells.contains(new CellKey(cell.q(), cell.r(), cell.level()))) {
                    roomIds.add(area.id());
                }
            }
        }
        return roomIds.size();
    }

    private static List<BoundaryRoomTouch> roomTouches(
            List<DungeonAreaSnapshot> areas,
            List<DungeonCellRef> touchingCells
    ) {
        List<BoundaryRoomTouch> touches = new ArrayList<>();
        for (DungeonAreaSnapshot area : areas) {
            if (area.kind() != DungeonAreaKind.ROOM) {
                continue;
            }
            for (DungeonCellRef cell : area.cells()) {
                if (touchingCells.contains(cell)) {
                    touches.add(new BoundaryRoomTouch(area, cell));
                    break;
                }
            }
        }
        return List.copyOf(touches);
    }

    private static List<DungeonCellRef> touchingCells(DungeonCellRef start, DungeonCellRef end) {
        if (start.level() != end.level()) {
            return List.of();
        }
        if (start.r() == end.r()) {
            return horizontalTouchingCells(start, end);
        }
        if (start.q() == end.q()) {
            return verticalTouchingCells(start, end);
        }
        return List.of();
    }

    private static List<DungeonCellRef> horizontalTouchingCells(DungeonCellRef start, DungeonCellRef end) {
        int minQ = Math.min(start.q(), end.q());
        int maxQ = Math.max(start.q(), end.q());
        List<DungeonCellRef> result = new ArrayList<>();
        for (int q = minQ; q < maxQ; q++) {
            result.add(new DungeonCellRef(q, start.r() - 1, start.level()));
            result.add(new DungeonCellRef(q, start.r(), start.level()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCellRef> verticalTouchingCells(DungeonCellRef start, DungeonCellRef end) {
        int minR = Math.min(start.r(), end.r());
        int maxR = Math.max(start.r(), end.r());
        List<DungeonCellRef> result = new ArrayList<>();
        for (int r = minR; r < maxR; r++) {
            result.add(new DungeonCellRef(start.q() - 1, r, start.level()));
            result.add(new DungeonCellRef(start.q(), r, start.level()));
        }
        return List.copyOf(result);
    }
}
