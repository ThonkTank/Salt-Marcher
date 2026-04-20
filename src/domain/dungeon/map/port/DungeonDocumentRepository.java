package src.domain.dungeon.map.port;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonDocument;
import src.domain.dungeon.map.value.DungeonMapIdentity;

public interface DungeonDocumentRepository {

    void ensureMap(DungeonMapIdentity mapId, String mapName);

    void activateMap(DungeonMapIdentity mapId, String mapName);

    @Nullable DungeonMapIdentity activeMapId();

    DungeonDocument load();

    DungeonDocument load(DungeonMapIdentity mapId, String mapName);

    void save(DungeonDocument nextDocument);

    void save(DungeonMapIdentity mapId, DungeonDocument nextDocument);

    void deleteMap(DungeonMapIdentity mapId);

    long revisionFor(DungeonMapIdentity mapId, long fallbackRevision);
}
