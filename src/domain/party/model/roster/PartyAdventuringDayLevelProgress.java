package src.domain.party.model.roster;

public final class PartyAdventuringDayLevelProgress {

    private final int startLevel;
    private final int endLevel;
    private final int characterCount;

    public PartyAdventuringDayLevelProgress(int startLevel, int endLevel, int characterCount) {
        this.startLevel = PartyCharacterProgress.clampLevel(startLevel);
        this.endLevel = PartyCharacterProgress.clampLevel(endLevel);
        this.characterCount = Math.max(0, characterCount);
    }

    public int startLevel() {
        return startLevel;
    }

    public int endLevel() {
        return endLevel;
    }

    public int characterCount() {
        return characterCount;
    }

    public int levelUps() {
        return Math.max(0, endLevel - startLevel);
    }

}
