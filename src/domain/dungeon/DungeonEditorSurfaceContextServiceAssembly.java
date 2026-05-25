package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import java.util.SortedSet;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;

final class DungeonEditorSurfaceContextServiceAssembly {

    private DungeonEditorSurfaceContextServiceAssembly() {
    }

    static SurfaceContext surfaceContext(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            int fallbackLevel
    ) {
        SortedSet<Integer> levels = new TreeSet<>();
        if (surface != null && surface.map() != null) {
            addWorkspaceMapLevels(levels, surface.map());
            if (surface.previewMap() != null) {
                addWorkspaceMapLevels(levels, surface.previewMap());
            }
        }
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return new SurfaceContext(DungeonEditorMapProjectionServiceAssembly.surface(surface), new ArrayList<>(levels), surface != null);
    }

    private static void addWorkspaceMapLevels(
            SortedSet<Integer> levels,
            src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot map
    ) {
        for (src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.Area area : map.areas()) {
            addWorkspaceCellLevels(levels, area.cells());
        }
        for (src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.Feature feature : map.features()) {
            addWorkspaceCellLevels(levels, feature.cells());
        }
        for (src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.Handle handle : map.editorHandles()) {
            levels.add(handle.cell().level());
        }
    }

    private static void addWorkspaceCellLevels(
            SortedSet<Integer> levels,
            List<src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.Cell> cells
    ) {
        for (src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.Cell cell
                : cells == null ? List.<src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.Cell>of() : cells) {
            levels.add(cell.level());
        }
    }

    record SurfaceContext(
            @Nullable DungeonEditorSurface surface,
            List<Integer> reachableLevels,
            boolean surfacePresent
    ) {
    }
}
