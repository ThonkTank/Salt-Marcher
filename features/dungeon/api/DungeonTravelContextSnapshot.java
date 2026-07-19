package features.dungeon.api;

public record DungeonTravelContextSnapshot(
        long sourceRevision,
        long partyPositionRevision,
        boolean active,
        long mapId,
        int authoredRevision,
        String mapName,
        String areaLabel,
        String tileLabel,
        String headingLabel,
        String statusText,
        String hintText
) {

    public DungeonTravelContextSnapshot {
        sourceRevision = Math.max(0L, sourceRevision);
        partyPositionRevision = Math.max(0L, partyPositionRevision);
        mapId = active ? Math.max(0L, mapId) : 0L;
        authoredRevision = active ? Math.max(0, authoredRevision) : 0;
        mapName = clean(mapName);
        areaLabel = clean(areaLabel);
        tileLabel = clean(tileLabel);
        headingLabel = clean(headingLabel);
        statusText = clean(statusText);
        hintText = clean(hintText);
    }

    public static DungeonTravelContextSnapshot empty(long sourceRevision, long partyPositionRevision) {
        return new DungeonTravelContextSnapshot(
                sourceRevision,
                partyPositionRevision,
                false,
                0L,
                0,
                "",
                "",
                "",
                "",
                "Kein Dungeon-Reisekontext",
                "Dungeon-Reiseposition auswaehlen");
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
