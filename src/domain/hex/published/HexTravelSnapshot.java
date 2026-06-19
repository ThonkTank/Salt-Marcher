package src.domain.hex.published;

import java.util.List;

public record HexTravelSnapshot(
        boolean active,
        long mapId,
        int q,
        int r,
        String locationText,
        String statusText,
        String weatherText,
        String timeOfDayText,
        String paceText,
        String hintText,
        List<Long> partyTokenCharacterIds
) {

    public HexTravelSnapshot {
        locationText = safeText(locationText);
        statusText = safeText(statusText);
        weatherText = safeText(weatherText);
        timeOfDayText = safeText(timeOfDayText);
        paceText = safeText(paceText);
        hintText = safeText(hintText);
        partyTokenCharacterIds = partyTokenCharacterIds == null ? List.of() : List.copyOf(partyTokenCharacterIds);
    }

    public static HexTravelSnapshot empty(String statusText) {
        return new HexTravelSnapshot(
                false,
                0L,
                0,
                0,
                "Kein Hex-Ort gewaehlt",
                statusText,
                "nicht verfuegbar",
                "nicht verfuegbar",
                "Normal",
                "Hex-Reiseposition auswaehlen",
                List.of());
    }

    private static String safeText(String text) {
        return text == null ? "" : text.trim();
    }
}
