package features.dungeon.application.editor.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.projection.DungeonAreaFacts;
import features.dungeon.domain.core.projection.DungeonMapFacts;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;

public final class DungeonEditorWorkspaceAreaProjectionHelper {
    public List<DungeonEditorWorkspaceValues.Area> project(DungeonMapFacts safeFacts) {
        List<DungeonEditorWorkspaceValues.Area> areas = new ArrayList<>();
        for (DungeonAreaFacts area : safeFacts.areas()) {
            areas.add(area(area));
        }
        return List.copyOf(areas);
    }

    private static DungeonEditorWorkspaceValues.Area area(DungeonAreaFacts area) {
        List<features.dungeon.domain.core.geometry.Cell> cells = new ArrayList<>();
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

    private static features.dungeon.domain.core.geometry.Cell cell(@Nullable Cell cell) {
        return cell == null
                ? features.dungeon.domain.core.geometry.Cell.empty()
                : new features.dungeon.domain.core.geometry.Cell(cell.q(), cell.r(), cell.level());
    }
}
