package src.data.dungeon.repository;

import java.util.LinkedHashMap;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.repository.DungeonDocumentRepository;
import src.domain.dungeon.map.value.DungeonDocument;
import src.domain.dungeon.map.value.DungeonMapIdentity;

/**
 * Local placeholder authored-document repository used until dungeon persistence is real.
 */
public final class LocalDungeonDocumentRepository implements DungeonDocumentRepository {

    private final Map<Long, DungeonDocument> documents = new LinkedHashMap<>();
    private @Nullable DungeonMapIdentity activeMapId;

    @Override
    public synchronized void ensureMap(DungeonMapIdentity mapId, String mapName) {
        documents.computeIfAbsent(mapId.value(), ignored -> DungeonDocument.demo().withMapName(mapName));
        if (activeMapId == null) {
            activeMapId = mapId;
        }
    }

    @Override
    public synchronized void activateMap(DungeonMapIdentity mapId, String mapName) {
        ensureMap(mapId, mapName);
        activeMapId = mapId;
    }

    @Override
    public synchronized @Nullable DungeonMapIdentity activeMapId() {
        return activeMapId;
    }

    @Override
    public synchronized DungeonDocument load() {
        if (activeMapId == null) {
            return DungeonDocument.demo();
        }
        return load(activeMapId, "Dungeon Bastion");
    }

    @Override
    public synchronized DungeonDocument load(DungeonMapIdentity mapId, String mapName) {
        ensureMap(mapId, mapName);
        DungeonDocument document = documents.get(mapId.value());
        if (document == null) {
            throw new IllegalStateException("Dungeon document missing after ensureMap.");
        }
        return document;
    }

    @Override
    public synchronized void save(DungeonDocument nextDocument) {
        if (activeMapId == null) {
            throw new IllegalStateException("No active dungeon map selected.");
        }
        save(activeMapId, nextDocument);
    }

    @Override
    public synchronized void save(DungeonMapIdentity mapId, DungeonDocument nextDocument) {
        DungeonDocument resolved = nextDocument == null ? DungeonDocument.demo() : nextDocument;
        documents.put(mapId.value(), resolved);
        activeMapId = mapId;
    }

    @Override
    public synchronized void deleteMap(DungeonMapIdentity mapId) {
        documents.remove(mapId.value());
        if (mapId.equals(activeMapId)) {
            activeMapId = firstAvailableMapId();
        }
    }

    @Override
    public synchronized long revisionFor(DungeonMapIdentity mapId, long fallbackRevision) {
        DungeonDocument document = documents.get(mapId.value());
        return document == null ? fallbackRevision : document.revision();
    }

    private @Nullable DungeonMapIdentity firstAvailableMapId() {
        if (documents.isEmpty()) {
            return null;
        }
        return new DungeonMapIdentity(documents.keySet().iterator().next());
    }
}
