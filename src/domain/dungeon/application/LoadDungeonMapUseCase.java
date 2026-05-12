package src.domain.dungeon.application;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonMapAuthoring;
import src.domain.dungeon.model.map.repository.DungeonMapRepository;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;

/**
 * Loads authored dungeon maps through narrow loader functions instead of storing raw ports.
 */
public final class LoadDungeonMapUseCase {

    private final Function<DungeonMapIdentity, Optional<DungeonMap>> findById;
    private final Supplier<Optional<DungeonMap>> firstMap;

    public LoadDungeonMapUseCase(
            DungeonMapRepository repository
    ) {
        this(
                Objects.requireNonNull(repository, "repository")::findById,
                Objects.requireNonNull(repository, "repository")::firstMap);
    }

    LoadDungeonMapUseCase(
            Function<DungeonMapIdentity, Optional<DungeonMap>> findById,
            Supplier<Optional<DungeonMap>> firstMap
    ) {
        this.findById = Objects.requireNonNull(findById, "findById");
        this.firstMap = Objects.requireNonNull(firstMap, "firstMap");
    }

    public DungeonMap execute() {
        return firstMap.get()
                .orElseGet(LoadDungeonMapUseCase::emptyFallbackMap);
    }

    public DungeonMap execute(@Nullable DungeonMapIdentity mapId) {
        if (mapId != null) {
            return findById.apply(mapId).orElseGet(this::execute);
        }
        return execute();
    }

    public DungeonMap require(DungeonMapIdentity mapId) {
        DungeonMapIdentity safeMapId = Objects.requireNonNull(mapId, "mapId");
        return findById.apply(safeMapId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + safeMapId.value()));
    }

    private static DungeonMap emptyFallbackMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Dungeon Map");
    }
}
