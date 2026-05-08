package src.domain.party.published;

public record AdventuringDayProgressEvent(
        int groupXp,
        AdventuringDayProgressEventType type,
        int dayNumber,
        int newLevel,
        int affectedCharacters,
        boolean partialDay
) {

    public AdventuringDayProgressEvent {
        type = type == null ? AdventuringDayProgressEventType.LONG_REST : type;
    }
}
