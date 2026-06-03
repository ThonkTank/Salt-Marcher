package src.domain.dungeon.model.worldspace.helper;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryClusterCellsHelper {
    public Map<Long, Set<CellKey>> collect(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            int level
    ) {
        Map<Long, Set<CellKey>> result = new LinkedHashMap<>();
        if (snapshot == null) {
            return Map.of();
        }
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            collectArea(result, area, level);
        }
        return immutable(result);
    }

    private static void collectArea(
            Map<Long, Set<CellKey>> result,
            DungeonEditorWorkspaceValues.Area area,
            int level
    ) {
        if (!area.kind().isRoom() || !DungeonEditorWorkspaceValues.hasId(area.clusterId())) {
            return;
        }
        Set<CellKey> cells = result.get(area.clusterId());
        if (cells == null) {
            cells = new LinkedHashSet<>();
            result.put(area.clusterId(), cells);
        }
        for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
            if (cell.level() == level) {
                cells.add(new CellKey(cell.q(), cell.r(), cell.level()));
            }
        }
    }

    private static Map<Long, Set<CellKey>> immutable(Map<Long, Set<CellKey>> result) {
        Map<Long, Set<CellKey>> immutable = new LinkedHashMap<>();
        for (Map.Entry<Long, Set<CellKey>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(immutable);
    }
}
