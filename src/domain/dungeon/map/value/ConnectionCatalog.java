package src.domain.dungeon.map.value;

import src.domain.dungeon.map.entity.DungeonCorridor;

import java.util.List;

/**
 * Authored map connections loaded from dungeon write-model truth.
 */
public record ConnectionCatalog(
        List<DungeonCorridor> corridors
) {

    public ConnectionCatalog {
        corridors = corridors == null ? List.of() : List.copyOf(corridors);
    }

    public static ConnectionCatalog empty() {
        return new ConnectionCatalog(List.of());
    }
}
