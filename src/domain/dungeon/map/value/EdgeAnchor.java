package src.domain.dungeon.map.value;

public record EdgeAnchor(
        DungeonCell from,
        DungeonCell to
) implements MapPlacement {
}
