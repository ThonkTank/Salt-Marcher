package src.domain.dungeon.valueobject;

public record EdgeAnchor(
        DungeonCell from,
        DungeonCell to
) implements MapPlacement {
}
