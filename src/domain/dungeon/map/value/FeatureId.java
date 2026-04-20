package src.domain.dungeon.map.value;

public record FeatureId(long value) {

    public FeatureId {
        value = Math.max(1L, value);
    }
}
