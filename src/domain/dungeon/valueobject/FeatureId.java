package src.domain.dungeon.valueobject;

public record FeatureId(long value) {

    public FeatureId {
        value = Math.max(1L, value);
    }
}
