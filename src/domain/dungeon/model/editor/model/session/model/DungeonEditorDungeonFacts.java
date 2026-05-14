package src.domain.dungeon.model.editor.model.session.model;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;

public record DungeonEditorDungeonFacts(
        List<MapSummary> maps,
        @Nullable MapId mutationMapId,
        @Nullable MapSnapshot committedSnapshot,
        DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
        String mutationStatusText,
        String previewStatusText
) {

    public DungeonEditorDungeonFacts {
        maps = maps == null ? List.of() : List.copyOf(maps);
        mutationStatusText = mutationStatusText == null ? "" : mutationStatusText;
        previewStatusText = previewStatusText == null ? "" : previewStatusText;
    }

    public static DungeonEditorDungeonFacts empty() {
        return new DungeonEditorDungeonFacts(
                List.of(),
                null,
                DungeonEditorWorkspaceValues.MapSnapshot.empty(),
                null,
                "",
                "");
    }
}
