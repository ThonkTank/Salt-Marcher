package src.data.dungeon.repository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.value.DungeonMapIdentity;

/**
 * Local placeholder repository used until dungeon maps are persisted.
 */
public final class LocalDungeonMapRepository implements DungeonMapRepository {

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
    public synchronized Optional<DungeonMap> findById(DungeonMapIdentity mapId) {
        return Optional.ofNullable(maps.get(mapId.value()));
    }

    @Override
    public synchronized DungeonMap save(DungeonMap dungeonMap) {
        maps.put(dungeonMap.metadata().mapId().value(), dungeonMap);
        nextId = Math.max(nextId, dungeonMap.metadata().mapId().value() + 1L);
        return dungeonMap;
    }

    @Override
    public synchronized void delete(DungeonMapIdentity mapId) {
        maps.remove(mapId.value());
    }

    @Override
    public synchronized DungeonMapIdentity nextId() {
        long mapId = nextId;
        nextId = mapId + 1L;
        return new DungeonMapIdentity(mapId);
    }
}
