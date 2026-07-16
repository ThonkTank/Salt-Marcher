package features.hex.domain.map;

public record HexMapIdentity(long value) {

    private static final long MINIMUM_VALUE = 1L;

    public HexMapIdentity {
        if (value < MINIMUM_VALUE) {
            throw new IllegalArgumentException("Hex map id must be positive.");
        }
    }
}
