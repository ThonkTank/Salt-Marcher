package features.hex.domain.map;

import java.util.Optional;

public record HexCoordinate(int q, int r) {

    private static final int MAX_STABLE_RADIUS = 99;
    private static final int STABLE_TILE_SPAN = MAX_STABLE_RADIUS * 2 + 1;
    private static final long FIRST_STABLE_TILE_ID = 1L;

    public boolean insideRadius(int radius) {
        if (radius < 0) {
            return false;
        }
        int s = -q - r;
        return Math.max(Math.max(Math.abs(q), Math.abs(r)), Math.abs(s)) <= radius;
    }

    public long stableTileId() {
        if (!insideRadius(MAX_STABLE_RADIUS)) {
            throw new IllegalArgumentException("Hex coordinate is outside the stable tile-id range.");
        }
        return (long) (q + MAX_STABLE_RADIUS) * STABLE_TILE_SPAN + r + MAX_STABLE_RADIUS + FIRST_STABLE_TILE_ID;
    }

    public static Optional<HexCoordinate> fromStableTileId(long tileId) {
        if (tileId < FIRST_STABLE_TILE_ID) {
            return Optional.empty();
        }
        long zeroBased = tileId - FIRST_STABLE_TILE_ID;
        long encodedQ = zeroBased / STABLE_TILE_SPAN;
        long encodedR = zeroBased % STABLE_TILE_SPAN;
        if (encodedQ < 0L || encodedQ >= STABLE_TILE_SPAN || encodedR < 0L || encodedR >= STABLE_TILE_SPAN) {
            return Optional.empty();
        }
        HexCoordinate coordinate = new HexCoordinate(
                Math.toIntExact(encodedQ) - MAX_STABLE_RADIUS,
                Math.toIntExact(encodedR) - MAX_STABLE_RADIUS);
        return coordinate.insideRadius(MAX_STABLE_RADIUS)
                ? Optional.of(coordinate)
                : Optional.empty();
    }

}
