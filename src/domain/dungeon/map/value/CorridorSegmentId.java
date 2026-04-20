package src.domain.dungeon.map.value;

public record CorridorSegmentId(long value) {

    public CorridorSegmentId {
        value = Math.max(1L, value);
    }
}
