package src.domain.dungeon.map;

public record SpaceId(long value) {

    public SpaceId {
        value = Math.max(1L, value);
    }
}
