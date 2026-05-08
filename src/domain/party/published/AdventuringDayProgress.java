package src.domain.party.published;

import java.util.List;
import src.domain.party.application.CalculateAdventuringDayUseCase;

public final class AdventuringDayProgress {

    private final int totalGroupXp;
    private final int perCharacterAwardedXp;
    private final int partySize;
    private final int fullDays;
    private final double totalDays;
    private final int shortRests;
    private final int longRests;
    private final List<AdventuringDayLevelProgress> levelProgressions;
    private final List<AdventuringDayProgressEvent> events;

    public AdventuringDayProgress(
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
        this.totalGroupXp = totalGroupXp;
        this.perCharacterAwardedXp = perCharacterAwardedXp;
        this.partySize = partySize;
        this.fullDays = fullDays;
        this.totalDays = totalDays;
        this.shortRests = shortRests;
        this.longRests = longRests;
        this.levelProgressions = levelProgressions == null ? List.of() : List.copyOf(levelProgressions);
        this.events = events == null ? List.of() : List.copyOf(events);
    }

    public static AdventuringDayProgress fromInternal(CalculateAdventuringDayUseCase.Progress progress) {
        CalculateAdventuringDayUseCase.Progress safeProgress = progress == null
                ? new CalculateAdventuringDayUseCase.Progress(0, 0, 0, 0, 0.0, 0, 0, List.of(), List.of())
                : progress;
        return new AdventuringDayProgress(
                safeProgress.totalGroupXp(),
                safeProgress.perCharacterAwardedXp(),
                safeProgress.partySize(),
                safeProgress.fullDays(),
                safeProgress.totalDays(),
                safeProgress.shortRests(),
                safeProgress.longRests(),
                safeProgress.levelProgressions().stream().map(AdventuringDayLevelProgress::fromInternal).toList(),
                safeProgress.events().stream().map(AdventuringDayProgressEvent::fromInternal).toList());
    }

    public int totalGroupXp() {
        return totalGroupXp;
    }

    public int perCharacterAwardedXp() {
        return perCharacterAwardedXp;
    }

    public int partySize() {
        return partySize;
    }

    public int fullDays() {
        return fullDays;
    }

    public double totalDays() {
        return totalDays;
    }

    public int shortRests() {
        return shortRests;
    }

    public int longRests() {
        return longRests;
    }

    public List<AdventuringDayLevelProgress> levelProgressions() {
        return levelProgressions;
    }

    public List<AdventuringDayProgressEvent> events() {
        return events;
    }
}
