package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.value.DungeonMapIdentity;

/**
 * Renames one authored dungeon map aggregate.
 */
public final class RenameDungeonMapUseCase {

    public record RenamedMap(DungeonMapIdentity mapId) {
    }

    private final DungeonMapRepository repository;

    public RenameDungeonMapUseCase(DungeonMapRepository repository) {
        this.repository = repository;
    }

    public RenamedMap execute(DungeonMapIdentity mapIdentity, String requestedMapName) {
        DungeonMap dungeonMap = repository.findById(mapIdentity)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + mapIdentity.value()));
        DungeonMap renamed = repository.save(dungeonMap.rename(normalizeName(requestedMapName)));
        return new RenamedMap(renamed.metadata().mapId());
    }

    private String normalizeName(String requestedMapName) {
        if (requestedMapName == null || requestedMapName.isBlank()) {
            return "Dungeon Map";
        }
        return requestedMapName;
    }
}
