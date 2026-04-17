package src.domain.dungeon.valueobject;

public record StairPlacement(
        int startFloor,
        int endFloor,
        int q,
        int r
) implements MapPlacement {
}
