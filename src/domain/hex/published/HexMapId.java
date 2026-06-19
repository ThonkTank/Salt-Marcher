package src.domain.hex.published;

public record HexMapId(long value) {

    public HexMapId {
        value = Math.max(0L, value);
    }
}
