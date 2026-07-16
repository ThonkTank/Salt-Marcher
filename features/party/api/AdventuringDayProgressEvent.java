package features.party.api;

public record AdventuringDayProgressEvent(
        int groupXp,
        AdventuringDayProgressEventType type,
        int dayNumber,
        int newLevel,
        int affectedCharacters,
        boolean partialDay
) {

    public AdventuringDayProgressEvent {
        type = type == null ? AdventuringDayProgressEventType.valueOf("LONG_REST") : type;
    }
}
