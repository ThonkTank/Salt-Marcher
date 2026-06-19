package src.domain.hex.published;

public record HexMarkerId(long value) {

    public HexMarkerId {
        value = Math.max(0L, value);
    }
}
