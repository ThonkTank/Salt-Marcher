package features.hex.domain.map;

import java.util.Objects;

public record HexMapSummary(HexMapIdentity mapId, String displayName, int radius) {

    public HexMapSummary {
        mapId = Objects.requireNonNull(mapId, "mapId");
        displayName = normalizeName(displayName);
        if (radius < 0) {
            throw new IllegalArgumentException("Hex map radius must be nonnegative.");
        }
        if (radius > HexMap.maxRadius()) {
            throw new IllegalArgumentException("Hex map radius must be at most " + HexMap.maxRadius() + ".");
        }
    }

    private static String normalizeName(String displayName) {
        String normalized = displayName == null ? "" : displayName.trim();
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Hex map name must be nonblank.");
        }
        return normalized;
    }
}
