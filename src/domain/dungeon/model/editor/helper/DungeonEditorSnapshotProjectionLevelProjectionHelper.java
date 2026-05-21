package src.domain.dungeon.model.editor.helper;

import java.util.ArrayList;
import java.util.List;
import java.util.NavigableSet;
import java.util.Set;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Cell;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Feature;

public final class DungeonEditorSnapshotProjectionLevelProjectionHelper {

    private DungeonEditorSnapshotProjectionLevelProjectionHelper() {
    }

    public static int clampProjectionLevel(
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
            for (var area : surface.map().areas()) {
                addCellLevels(levels, area.cells());
            }
            for (Feature feature : surface.map().features()) {
                addCellLevels(levels, feature.cells());
            }
            for (var handle : surface.map().editorHandles()) {
                levels.add(handle.cell().level());
            }
            if (surface.previewMap() != null) {
                for (var area : surface.previewMap().areas()) {
                    addCellLevels(levels, area.cells());
                }
                for (Feature feature : surface.previewMap().features()) {
                    addCellLevels(levels, feature.cells());
                }
                for (var handle : surface.previewMap().editorHandles()) {
                    levels.add(handle.cell().level());
                }
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
