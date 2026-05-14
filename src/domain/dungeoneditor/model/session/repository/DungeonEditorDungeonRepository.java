package src.domain.dungeoneditor.model.session.repository;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.TopologyElementRef;

public interface DungeonEditorDungeonRepository {

    void searchMaps(String query);

    void createMap(String mapName);

    void renameMap(@Nullable MapId mapId, String mapName);

    void deleteMap(@Nullable MapId mapId);

    void loadMap(@Nullable MapId mapId);

    void describeSelection(
            @Nullable MapId mapId,
            TopologyElementRef topologyRef,
            long clusterId,
            boolean clusterSelection);

    void previewOperation(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview);

    void applyOperation(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview);

    void saveRoomNarration(@Nullable MapId mapId, DungeonEditorSessionCommand.RoomNarrationInput roomNarration);
}
