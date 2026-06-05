package src.domain.dungeon.model.runtime.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.projection.DungeonAreaFacts;
import src.domain.dungeon.model.core.projection.DungeonMapFacts;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

public final class DungeonEditorWorkspaceAreaProjectionHelper {
    public List<DungeonEditorWorkspaceValues.Area> project(DungeonMapFacts safeFacts) {
        List<DungeonEditorWorkspaceValues.Area> areas = new ArrayList<>();
        for (DungeonAreaFacts area : safeFacts.areas()) {
            areas.add(area(area));
        }
        return List.copyOf(areas);
    }

    private static DungeonEditorWorkspaceValues.Area area(DungeonAreaFacts area) {
        List<DungeonEditorWorkspaceValues.Cell> cells = new ArrayList<>();
        for (Cell cell : area.cells()) {
            cells.add(cell(cell));
        }
        return new DungeonEditorWorkspaceValues.Area(
                area.kind(),
                area.id(),
                area.clusterId(),
                area.label(),
                List.copyOf(cells),
                area.topologyRef());
    }

    private static DungeonEditorWorkspaceValues.Cell cell(@Nullable Cell cell) {
        return cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level());
    }
}
