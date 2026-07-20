package features.dungeon.application.editor.session;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSummary;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;

public record DungeonEditorDungeonFacts(
        List<MapSummary> maps,
        @Nullable MapId mutationMapId,
        @Nullable MapSnapshot committedSnapshot,
        DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
        DungeonEditorCommandOutcome commandOutcome,
        String previewStatusText
) {

    public DungeonEditorDungeonFacts {
        maps = maps == null ? List.of() : List.copyOf(maps);
        commandOutcome = commandOutcome == null ? DungeonEditorCommandOutcome.idle() : commandOutcome;
        previewStatusText = previewStatusText == null ? "" : previewStatusText;
    }

}
