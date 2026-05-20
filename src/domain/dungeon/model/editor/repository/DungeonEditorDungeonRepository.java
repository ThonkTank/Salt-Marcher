package src.domain.dungeon.model.editor.repository;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorRoomNarrationInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;

public final class DungeonEditorDungeonRepository {

    private final CatalogRequests catalogRequests;
    private final AuthoredRequests authoredRequests;

    public DungeonEditorDungeonRepository(
            CatalogRequests catalogRequests,
            AuthoredRequests authoredRequests
    ) {
        this.catalogRequests = Objects.requireNonNull(catalogRequests, "catalogRequests");
        this.authoredRequests = Objects.requireNonNull(authoredRequests, "authoredRequests");
    }

    public void searchMaps(String query) {
        catalogRequests.searchMaps(query);
    }

    public void createMap(String mapName) {
        catalogRequests.createMap(mapName);
    }

    public void renameMap(@Nullable MapId mapId, String mapName) {
        if (mapId != null) {
            catalogRequests.renameMap(mapId, mapName);
        }
    }

    public void deleteMap(@Nullable MapId mapId) {
        if (mapId != null) {
            catalogRequests.deleteMap(mapId);
        }
    }

    public void loadMap(@Nullable MapId mapId) {
        if (mapId != null) {
            authoredRequests.loadMap(mapId);
        }
    }

    public void describeSelection(
            @Nullable MapId mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        if (mapId == null || (!topologyRef.present() && !clusterSelection)) {
            return;
        }
        authoredRequests.describeSelection(mapId, topologyRef, clusterId, clusterSelection);
    }

    public void previewOperation(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
        if (mapId != null) {
            authoredRequests.previewOperation(mapId, preview);
        }
    }

    public void applyOperation(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
        if (mapId != null) {
            authoredRequests.applyOperation(mapId, preview);
        }
    }

    public void saveRoomNarration(@Nullable MapId mapId, DungeonEditorRoomNarrationInput roomNarration) {
        if (mapId == null || roomNarration == null || !DungeonEditorWorkspaceValues.hasId(roomNarration.roomId())) {
            return;
        }
        authoredRequests.saveRoomNarration(mapId, roomNarration);
    }

    public interface CatalogRequests {
        void searchMaps(String query);

        void createMap(String mapName);

        void renameMap(MapId mapId, String mapName);

        void deleteMap(MapId mapId);
    }

    public interface AuthoredRequests {
        void loadMap(MapId mapId);

        void describeSelection(
                MapId mapId,
                DungeonTopologyRef topologyRef,
                long clusterId,
                boolean clusterSelection);

        void previewOperation(MapId mapId, DungeonEditorSessionValues.Preview preview);

        void applyOperation(MapId mapId, DungeonEditorSessionValues.Preview preview);

        void saveRoomNarration(MapId mapId, DungeonEditorRoomNarrationInput roomNarration);
    }
}
