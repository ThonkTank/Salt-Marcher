package features.travel.api;

public record TravelContextSnapshot(
        long publicationRevision,
        long sourceRevision,
        long partyPositionRevision,
        TravelContextKind kind,
        long mapId,
        String mapName,
        String areaLabel,
        String tileLabel,
        String headingLabel,
        String statusText,
        String hintText,
        String weatherText,
        String timeOfDayText,
        String paceText
) {

    public TravelContextSnapshot {
        publicationRevision = Math.max(0L, publicationRevision);
        sourceRevision = Math.max(0L, sourceRevision);
        partyPositionRevision = Math.max(0L, partyPositionRevision);
        kind = kind == null ? TravelContextKind.NONE : kind;
        mapId = kind == TravelContextKind.NONE ? 0L : Math.max(0L, mapId);
        mapName = clean(mapName);
        areaLabel = clean(areaLabel);
        tileLabel = clean(tileLabel);
        headingLabel = clean(headingLabel);
        statusText = clean(statusText);
        hintText = clean(hintText);
        weatherText = clean(weatherText);
        timeOfDayText = clean(timeOfDayText);
        paceText = clean(paceText);
    }

    public static TravelContextSnapshot none(long partyPositionRevision) {
        return new TravelContextSnapshot(
                0L,
                0L,
                partyPositionRevision,
                TravelContextKind.NONE,
                0L,
                "Kein Reiseort gewaehlt",
                "",
                "",
                "",
                "Kein Reisekontext",
                "Reiseposition auswaehlen",
                "nicht verfuegbar",
                "nicht verfuegbar",
                "Normal");
    }

    public TravelContextSnapshot withPublicationRevision(long revision) {
        return new TravelContextSnapshot(
                revision,
                sourceRevision,
                partyPositionRevision,
                kind,
                mapId,
                mapName,
                areaLabel,
                tileLabel,
                headingLabel,
                statusText,
                hintText,
                weatherText,
                timeOfDayText,
                paceText);
    }

    public boolean sameContext(TravelContextSnapshot other) {
        return other != null && withPublicationRevision(0L).equals(other.withPublicationRevision(0L));
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
