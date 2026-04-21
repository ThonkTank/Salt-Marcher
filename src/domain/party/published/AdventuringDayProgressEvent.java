package src.domain.party.published;

public record AdventuringDayProgressEvent(
        int groupXp,
        AdventuringDayProgressEventType type,
        int dayNumber,
        int newLevel,
        int affectedCharacters,
        boolean partialDay
) {
}
