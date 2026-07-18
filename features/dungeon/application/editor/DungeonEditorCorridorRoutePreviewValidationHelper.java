package features.dungeon.application.editor;

import java.util.LinkedHashSet;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorInteractionValues.CellKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.TravelHeading;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PendingCorridorTarget;

final class DungeonEditorCorridorRoutePreviewValidationHelper {
    private final CorridorRoutingPolicy routingPolicy;

    DungeonEditorCorridorRoutePreviewValidationHelper(CorridorRoutingPolicy routingPolicy) {
        this.routingPolicy = java.util.Objects.requireNonNull(routingPolicy, "routingPolicy");
    }

    boolean hasValidRoute(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            PendingCorridorTarget start,
            PendingCorridorTarget end
    ) {
        features.dungeon.domain.core.geometry.Cell startCell = corridorCell(start.endpoint());
        features.dungeon.domain.core.geometry.Cell endCell = corridorCell(end.endpoint());
        if (snapshot == null || startCell == null || endCell == null || startCell.level() != endCell.level()) {
            return true;
        }
        return routingPolicy.route(startCell, endCell, roomCells(snapshot)).present();
    }

    @Nullable Cell corridorCell(
            DungeonEditorWorkspaceValues.CorridorEndpoint endpoint
    ) {
        return switch (endpoint) {
            case DungeonEditorWorkspaceValues.CorridorDoorEndpoint door ->
                    neighbor(door.roomCell(), travelHeading(door.direction()));
            case DungeonEditorWorkspaceValues.CorridorAnchorEndpoint anchor -> anchor.anchorCell();
            case null -> null;
        };
    }

    private static Set<Cell> roomCells(DungeonEditorWorkspaceValues.MapSnapshot snapshot) {
        Set<Cell> result = new LinkedHashSet<>();
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (area.kind().isRoom()) {
                for (features.dungeon.domain.core.geometry.Cell cell : area.cells()) {
                    result.add(cell);
                }
            }
        }
        return Set.copyOf(result);
    }

    private static features.dungeon.domain.core.geometry.Cell neighbor(
            features.dungeon.domain.core.geometry.Cell cell,
            TravelHeading direction
    ) {
        CellKey key = new CellKey(cell.q(), cell.r(), cell.level()).neighbor(direction);
        return new features.dungeon.domain.core.geometry.Cell(key.q(), key.r(), key.level());
    }

    private static TravelHeading travelHeading(@Nullable Direction direction) {
        for (TravelHeading heading : TravelHeading.values()) {
            if (direction != null && heading.name().equals(direction.name())) {
                return heading;
            }
        }
        return TravelHeading.NORTH;
    }
}
