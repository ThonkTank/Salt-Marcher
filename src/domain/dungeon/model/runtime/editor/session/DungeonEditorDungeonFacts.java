package src.domain.dungeon.model.runtime.editor.session;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSummary;

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

}
