package features.hex.api;

import java.util.List;

public record HexTravelSnapshot(
        long sourceRevision,
        long partyPositionRevision,
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
        sourceRevision = Math.max(0L, sourceRevision);
        partyPositionRevision = Math.max(0L, partyPositionRevision);
        locationText = safeText(locationText);
        statusText = safeText(statusText);
        weatherText = safeText(weatherText);
        timeOfDayText = safeText(timeOfDayText);
        paceText = safeText(paceText);
        hintText = safeText(hintText);
        partyTokenCharacterIds = partyTokenCharacterIds == null ? List.of() : List.copyOf(partyTokenCharacterIds);
    }

    public static HexTravelSnapshot empty(String statusText) {
        return empty(0L, statusText);
    }

    public static HexTravelSnapshot empty(long partyPositionRevision, String statusText) {
        return new HexTravelSnapshot(
                0L,
                partyPositionRevision,
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

    public HexTravelSnapshot withSourceRevision(long revision) {
        return new HexTravelSnapshot(
                revision,
                partyPositionRevision,
                active,
                mapId,
                q,
                r,
                locationText,
                statusText,
                weatherText,
                timeOfDayText,
                paceText,
                hintText,
                partyTokenCharacterIds);
    }

    private static String safeText(String text) {
        return text == null ? "" : text.trim();
    }
}
