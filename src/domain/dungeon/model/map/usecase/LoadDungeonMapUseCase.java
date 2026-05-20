package src.domain.dungeon.model.map.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonMapAuthoring;
import src.domain.dungeon.model.map.repository.DungeonMapRepository;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;

/**
 * Loads authored dungeon maps through the dungeon repository.
 */
public final class LoadDungeonMapUseCase {

    private final DungeonMapRepository repository;

    public LoadDungeonMapUseCase(DungeonMapRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public DungeonMap execute() {
        return repository.firstMap().orElse(emptyFallbackMap());
    }

    public DungeonMap execute(@Nullable DungeonMapIdentity mapId) {
        if (mapId != null) {
            return repository.findById(mapId).orElseGet(this::execute);
        }
        return execute();
    }

    public DungeonMap require(DungeonMapIdentity mapId) {
        DungeonMapIdentity safeMapId = Objects.requireNonNull(mapId, "mapId");
        return repository.findById(safeMapId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + safeMapId.value()));
    }

    private static DungeonMap emptyFallbackMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Dungeon Map");
    }
}
