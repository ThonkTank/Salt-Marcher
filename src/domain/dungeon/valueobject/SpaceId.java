package src.domain.dungeon.valueobject;

public record SpaceId(long value) {

    public SpaceId {
        value = Math.max(1L, value);
    }
}
