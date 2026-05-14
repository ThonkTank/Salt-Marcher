package src.domain.dungeoneditor.model.session.port;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;

public interface DungeonEditorDungeonPort {

    DungeonEditorDungeonFacts currentFacts(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview);

    DungeonEditorDungeonFacts committedFacts(@Nullable MapId mapId);
}
