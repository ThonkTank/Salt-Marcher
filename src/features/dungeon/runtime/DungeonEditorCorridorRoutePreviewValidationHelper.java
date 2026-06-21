package src.features.dungeon.runtime;

import java.util.LinkedHashSet;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoute;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.CellKey;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.TravelHeading;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PendingCorridorTarget;

final class DungeonEditorCorridorRoutePreviewValidationHelper {

    boolean hasValidRoute(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            PendingCorridorTarget start,
            PendingCorridorTarget end
    ) {
        DungeonEditorWorkspaceValues.Cell startCell = corridorCell(start.endpoint());
        DungeonEditorWorkspaceValues.Cell endCell = corridorCell(end.endpoint());
        if (snapshot == null || startCell == null || endCell == null || startCell.level() != endCell.level()) {
            return true;
        }
        Set<CellKey> roomCells = roomCells(snapshot);
        return CorridorRoute.unblockedBetween(toCoreCell(startCell), toCoreCell(endCell), coreCells(roomCells)).present();
    }

    DungeonEditorWorkspaceValues.@Nullable Cell corridorCell(
            DungeonEditorWorkspaceValues.CorridorEndpoint endpoint
    ) {
        return switch (endpoint) {
            case DungeonEditorWorkspaceValues.CorridorDoorEndpoint door ->
                    neighbor(door.roomCell(), travelHeading(door.direction()));
            case DungeonEditorWorkspaceValues.CorridorAnchorEndpoint anchor -> anchor.anchorCell();
            case null -> null;
        };
    }

    private static Set<CellKey> roomCells(DungeonEditorWorkspaceValues.MapSnapshot snapshot) {
        Set<CellKey> result = new LinkedHashSet<>();
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (area.kind().isRoom()) {
                for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
                    result.add(new CellKey(cell.q(), cell.r(), cell.level()));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static Set<Cell> coreCells(Set<CellKey> cells) {
        Set<Cell> result = new LinkedHashSet<>();
        for (CellKey cell : cells == null ? Set.<CellKey>of() : cells) {
            result.add(new Cell(cell.q(), cell.r(), cell.level()));
        }
        return Set.copyOf(result);
    }

    private static Cell toCoreCell(DungeonEditorWorkspaceValues.Cell cell) {
        return new Cell(cell.q(), cell.r(), cell.level());
    }

    private static DungeonEditorWorkspaceValues.Cell neighbor(
            DungeonEditorWorkspaceValues.Cell cell,
            TravelHeading direction
    ) {
        CellKey key = new CellKey(cell.q(), cell.r(), cell.level()).neighbor(direction);
        return new DungeonEditorWorkspaceValues.Cell(key.q(), key.r(), key.level());
    }

    private static TravelHeading travelHeading(@Nullable String direction) {
        for (TravelHeading heading : TravelHeading.values()) {
            if (heading.name().equals(direction)) {
                return heading;
            }
        }
        return TravelHeading.NORTH;
    }
}
