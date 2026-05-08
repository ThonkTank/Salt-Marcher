package src.domain.party.published;

import java.util.List;

public record AdventuringDayProgress(
        int totalGroupXp,
        int perCharacterAwardedXp,
        int partySize,
        int fullDays,
        double totalDays,
        int shortRests,
        int longRests,
        List<AdventuringDayLevelProgress> levelProgressions,
        List<AdventuringDayProgressEvent> events
) {

    public AdventuringDayProgress {
        levelProgressions = levelProgressions == null ? List.of() : List.copyOf(levelProgressions);
        events = events == null ? List.of() : List.copyOf(events);
    }
}
