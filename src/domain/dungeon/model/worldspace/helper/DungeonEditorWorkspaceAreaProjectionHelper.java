package src.domain.dungeon.model.worldspace.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.DungeonAreaFacts;
import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonMapFacts;
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
        for (DungeonCell cell : area.cells()) {
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

    private static DungeonEditorWorkspaceValues.Cell cell(@Nullable DungeonCell cell) {
        return cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level());
    }
}
