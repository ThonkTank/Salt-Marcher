package features.hex.domain.map;

import java.util.Objects;

public record HexMarker(
        HexMarkerIdentity markerId,
        HexCoordinate coordinate,
        String name,
        HexMarkerKind type,
        String note
) {

    public HexMarker {
        markerId = Objects.requireNonNull(markerId, "markerId");
        coordinate = Objects.requireNonNull(coordinate, "coordinate");
        name = requireName(name);
        type = requireType(type);
        note = note == null ? "" : note.trim();
    }

    private static String requireName(String name) {
        String normalized = name == null ? "" : name.trim();
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Hex marker name must be nonblank.");
        }
        return normalized;
    }

    private static HexMarkerKind requireType(HexMarkerKind type) {
        if (type == null) {
            throw new IllegalArgumentException("Hex marker type is required.");
        }
        return type;
    }
}
