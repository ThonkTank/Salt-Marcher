package src.domain.party.published;

import src.domain.party.application.CalculateAdventuringDayUseCase;

public final class AdventuringDayLevelProgress {

    private final CalculateAdventuringDayUseCase.LevelProgress progress;

    public AdventuringDayLevelProgress(
            int startLevel,
            int endLevel,
            int characterCount,
            int levelUps
    ) {
        this(new CalculateAdventuringDayUseCase.LevelProgress(startLevel, endLevel, characterCount, levelUps));
    }

    public AdventuringDayLevelProgress(CalculateAdventuringDayUseCase.LevelProgress progress) {
        this.progress = progress == null ? new CalculateAdventuringDayUseCase.LevelProgress(0, 0, 0, 0) : progress;
    }

    public static AdventuringDayLevelProgress fromInternal(CalculateAdventuringDayUseCase.LevelProgress progress) {
        return new AdventuringDayLevelProgress(progress);
    }

    public CalculateAdventuringDayUseCase.LevelProgress toInternal() {
        return progress;
    }

    public int startLevel() {
        return progress.startLevel();
    }

    public int endLevel() {
        return progress.endLevel();
    }

    public int characterCount() {
        return progress.characterCount();
    }

    public int levelUps() {
        return progress.levelUps();
    }
}
