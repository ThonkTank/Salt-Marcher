package src.domain.dungeon.model.map.model;


import java.util.List;

/**
 * Authored map connections loaded from dungeon write-model truth.
 */
public record ConnectionCatalog(
        List<DungeonCorridor> corridors,
        List<DungeonStair> stairs,
        List<DungeonTransition> transitions
) {

    public ConnectionCatalog {
        corridors = corridors == null ? List.of() : List.copyOf(corridors);
        stairs = stairs == null ? List.of() : List.copyOf(stairs);
        transitions = transitions == null ? List.of() : List.copyOf(transitions);
    }

    public ConnectionCatalog(List<DungeonCorridor> corridors) {
        this(corridors, List.of(), List.of());
    }

    public static ConnectionCatalog empty() {
        return new ConnectionCatalog(List.of(), List.of(), List.of());
    }
}
