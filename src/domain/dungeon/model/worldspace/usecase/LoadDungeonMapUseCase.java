package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.DungeonMap;
import src.domain.dungeon.model.worldspace.model.DungeonMapAuthoring;
import src.domain.dungeon.model.worldspace.repository.DungeonMapRepository;
import src.domain.dungeon.model.worldspace.model.DungeonMapIdentity;

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
            Optional<DungeonMap> map = repository.findById(mapId);
            if (map.isPresent()) {
                return map.get();
            }
        }
        return execute();
    }

    private static DungeonMap emptyFallbackMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Dungeon Map");
    }
}
