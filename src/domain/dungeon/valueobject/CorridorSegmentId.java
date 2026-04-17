package src.domain.dungeon.valueobject;

public record CorridorSegmentId(long value) {

    public CorridorSegmentId {
        value = Math.max(1L, value);
    }
}
