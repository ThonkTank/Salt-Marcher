package src.domain.hex.model.map;

public record HexMarkerIdentity(long value) {

    private static final long MINIMUM_VALUE = 1L;

    public HexMarkerIdentity {
        if (value < MINIMUM_VALUE) {
            throw new IllegalArgumentException("Hex marker id must be positive.");
        }
    }
}
