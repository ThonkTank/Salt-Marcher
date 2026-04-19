package src.domain.dungeon.map;

public record CorridorSegmentId(long value) {

    public CorridorSegmentId {
        value = Math.max(1L, value);
    }
}
