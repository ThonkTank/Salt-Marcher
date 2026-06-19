package src.domain.hex.model.map;

import java.util.List;

public record HexTravelPositionState(
        boolean active,
        long mapId,
        int q,
        int r,
        String mapDisplayName,
        String statusText,
        String hintText,
        List<Long> characterIds
) {

    public HexTravelPositionState {
        mapDisplayName = safeText(mapDisplayName);
        statusText = safeText(statusText);
        hintText = safeText(hintText);
        characterIds = characterIds == null ? List.of() : List.copyOf(characterIds);
    }

    public static HexTravelPositionState empty(String statusText) {
        return new HexTravelPositionState(
                false,
                0L,
                0,
                0,
                "",
                statusText,
                "Hex-Reiseposition auswaehlen",
                List.of());
    }

    public static HexTravelPositionState active(
            HexMapSummary map,
            HexCoordinate coordinate,
            List<Long> characterIds
    ) {
        return new HexTravelPositionState(
                true,
                map.mapId().value(),
                coordinate.q(),
                coordinate.r(),
                map.displayName(),
                "Reisend",
                "Reisegruppe auf der Hex-Karte bewegen",
                characterIds);
    }

    private static String safeText(String text) {
        return text == null ? "" : text.trim();
    }
}
