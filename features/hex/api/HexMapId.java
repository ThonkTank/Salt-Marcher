package features.hex.api;

public record HexMapId(long value) {

    public HexMapId {
        value = Math.max(0L, value);
    }
}
