package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.DungeonMapId;
import src.domain.dungeon.map.DungeonDocument;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Shared in-memory authored document store for dungeon placeholder delivery.
 */
public final class DungeonDocumentStore {

    private final Map<Long, DungeonDocument> documents = new LinkedHashMap<>();
    private @Nullable DungeonMapId activeMapId;

    public synchronized void ensureMap(DungeonMapId mapId, String mapName) {
        documents.computeIfAbsent(mapId.value(), ignored -> DungeonDocument.demo().withMapName(mapName));
        if (activeMapId == null) {
            activeMapId = mapId;
        }
    }

    public synchronized void activateMap(DungeonMapId mapId, String mapName) {
        ensureMap(mapId, mapName);
        activeMapId = mapId;
    }

    public synchronized @Nullable DungeonMapId activeMapId() {
        return activeMapId;
    }

    public synchronized DungeonDocument load() {
        if (activeMapId == null) {
            return DungeonDocument.demo();
        }
        return load(activeMapId, "Dungeon Bastion");
    }

    public synchronized DungeonDocument load(DungeonMapId mapId, String mapName) {
        ensureMap(mapId, mapName);
        DungeonDocument document = documents.get(mapId.value());
        if (document == null) {
            throw new IllegalStateException("Dungeon document missing after ensureMap.");
        }
        return document;
    }

    public synchronized void save(DungeonDocument nextDocument) {
        if (activeMapId == null) {
            throw new IllegalStateException("No active dungeon map selected.");
        }
        save(activeMapId, nextDocument);
    }

    public synchronized void save(DungeonMapId mapId, DungeonDocument nextDocument) {
        DungeonDocument resolved = nextDocument == null ? DungeonDocument.demo() : nextDocument;
        documents.put(mapId.value(), resolved);
        activeMapId = mapId;
    }

    public synchronized void deleteMap(DungeonMapId mapId) {
        documents.remove(mapId.value());
        if (mapId.equals(activeMapId)) {
            activeMapId = firstAvailableMapId();
        }
    }

    public synchronized long revisionFor(DungeonMapId mapId, long fallbackRevision) {
        DungeonDocument document = documents.get(mapId.value());
        return document == null ? fallbackRevision : document.revision();
    }

    private @Nullable DungeonMapId firstAvailableMapId() {
        if (documents.isEmpty()) {
            return null;
        }
        return new DungeonMapId(documents.keySet().iterator().next());
    }
}
