package src.domain.dungeon.map;

public record FeatureId(long value) {

    public FeatureId {
        value = Math.max(1L, value);
    }
}
