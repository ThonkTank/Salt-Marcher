package src.domain.dungeon.map.value;

public record SpaceId(long value) {

    public SpaceId {
        value = Math.max(1L, value);
    }
}
