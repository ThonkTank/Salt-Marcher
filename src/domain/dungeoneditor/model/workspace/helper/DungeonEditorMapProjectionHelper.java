package src.domain.dungeoneditor.model.workspace.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapProjectionContent;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorMapProjectionHelper {

    private DungeonEditorMapProjectionHelper() {
    }

    public static @Nullable DungeonEditorMapProjectionSnapshot projection(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            DungeonEditorSessionValues.@Nullable Selection selection,
            DungeonEditorSessionValues.@Nullable Preview preview
    ) {
        if (surface == null) {
            return null;
        }
        DungeonEditorSessionValues.Selection safeSelection = selection == null
                ? DungeonEditorSessionValues.Selection.empty()
                : selection;
        DungeonEditorSessionValues.Preview safePreview = preview == null
                ? DungeonEditorSessionValues.Preview.none()
                : preview;
        DungeonEditorProjectionAssemblyProjectionHelper.ProjectionAccumulator projection =
                DungeonEditorProjectionAssemblyProjectionHelper.assemble(surface, safeSelection, safePreview);
        DungeonEditorWorkspaceValues.MapSnapshot map = surface.map();
        return new DungeonEditorMapProjectionSnapshot(
                surface.mapName(),
                DungeonEditorProjectionPublishedBoundaryTranslationHelper.topology(map.topology()),
                map.width(),
                map.height(),
                new DungeonMapProjectionContent<>(
                        projection.cells(),
                        projection.edges(),
                        projection.labels(),
                        projection.markers(),
                        projection.graphNodes(),
                        projection.graphLinks()),
                null);
    }
}
