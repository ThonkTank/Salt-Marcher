package src.domain.dungeoneditor.model.session.helper;

import java.util.ArrayList;
import java.util.List;
import java.util.NavigableSet;
import java.util.Set;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.Cell;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.Feature;

final class DungeonEditorSnapshotProjectionLevelProjectionHelper {

    private DungeonEditorSnapshotProjectionLevelProjectionHelper() {
    }

    static int clampProjectionLevel(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            int projectionLevel
    ) {
        List<Integer> levels = levelsFrom(surface, projectionLevel);
        if (levels.isEmpty()) {
            return projectionLevel;
        }
        return Math.max(levels.getFirst(), Math.min(levels.getLast(), projectionLevel));
    }

    private static List<Integer> levelsFrom(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            int fallbackLevel
    ) {
        NavigableSet<Integer> levels = new TreeSet<>();
        if (surface != null) {
            surface.map().areas().forEach(area -> addCellLevels(levels, area.cells()));
            for (Feature feature : surface.map().features()) {
                addCellLevels(levels, feature.cells());
            }
            surface.map().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            if (surface.previewMap() != null) {
                surface.previewMap().areas().forEach(area -> addCellLevels(levels, area.cells()));
                for (Feature feature : surface.previewMap().features()) {
                    addCellLevels(levels, feature.cells());
                }
                surface.previewMap().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            }
        }
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return new ArrayList<>(levels);
    }

    private static void addCellLevels(Set<Integer> levels, List<Cell> cells) {
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            levels.add(cell.level());
        }
    }
}
