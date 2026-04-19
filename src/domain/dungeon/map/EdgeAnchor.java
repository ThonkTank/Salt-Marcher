package src.domain.dungeon.map;

public record EdgeAnchor(
        DungeonCell from,
        DungeonCell to
) implements MapPlacement {
}
