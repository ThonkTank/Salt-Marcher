package src.domain.dungeon.application;

import java.util.Objects;
import java.util.function.Function;
import java.util.function.Supplier;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.value.DungeonMapIdentity;

/**
 * Creates an empty authored dungeon map aggregate.
 */
public final class CreateDungeonMapUseCase {

    public record CreatedMap(DungeonMapIdentity mapId) {
    }

    private final Supplier<DungeonMapIdentity> nextMapId;
    private final Function<DungeonMap, DungeonMap> saveMap;

    public CreateDungeonMapUseCase(
            Supplier<DungeonMapIdentity> nextMapId,
            Function<DungeonMap, DungeonMap> saveMap
    ) {
        this.nextMapId = Objects.requireNonNull(nextMapId, "nextMapId");
        this.saveMap = Objects.requireNonNull(saveMap, "saveMap");
    }

    public CreatedMap execute(String requestedMapName) {
        DungeonMapIdentity mapIdentity = nextMapId.get();
        String mapName = normalizeName(requestedMapName);
        DungeonMap dungeonMap = DungeonMap.empty(mapIdentity, mapName);
        DungeonMap saved = saveMap.apply(dungeonMap);
        return new CreatedMap(saved.metadata().mapId());
    }

    private String normalizeName(String requestedMapName) {
        if (requestedMapName == null || requestedMapName.isBlank()) {
            return "Dungeon Map";
        }
        return requestedMapName;
    }
}
