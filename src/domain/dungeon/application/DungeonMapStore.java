package src.domain.dungeon.application;

import src.domain.dungeon.api.DungeonMapId;
import src.domain.dungeon.map.DungeonMap;
import src.domain.dungeon.map.DungeonMapRepository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Domain-owned in-memory repository used by the first real dungeon map slice.
 */
public final class DungeonMapStore implements DungeonMapRepository {

    private final Map<Long, DungeonMap> maps = new LinkedHashMap<>();
    private long nextId = 1L;

    @Override
    public synchronized List<DungeonMap> searchByName(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        List<DungeonMap> matches = new ArrayList<>();
        for (DungeonMap dungeonMap : maps.values()) {
            String candidate = dungeonMap.metadata().mapName().toLowerCase(Locale.ROOT);
            if (normalized.isBlank() || candidate.contains(normalized)) {
                matches.add(dungeonMap);
            }
        }
        return List.copyOf(matches);
    }

    @Override
    public synchronized Optional<DungeonMap> findById(DungeonMapId mapId) {
        return Optional.ofNullable(maps.get(mapId.value()));
    }

    @Override
    public synchronized DungeonMap save(DungeonMap dungeonMap) {
        maps.put(dungeonMap.metadata().mapId().value(), dungeonMap);
        nextId = Math.max(nextId, dungeonMap.metadata().mapId().value() + 1L);
        return dungeonMap;
    }

    @Override
    public synchronized void delete(DungeonMapId mapId) {
        maps.remove(mapId.value());
    }

    @Override
    public synchronized DungeonMapId nextId() {
        long mapId = nextId;
        nextId = mapId + 1L;
        return new DungeonMapId(mapId);
    }
}
