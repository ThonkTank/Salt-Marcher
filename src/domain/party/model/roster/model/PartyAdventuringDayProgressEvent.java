package src.domain.party.model.roster.model;

public final class PartyAdventuringDayProgressEvent {

    private static final int LEVEL_UP_KIND = 0;
    private static final int SHORT_REST_KIND = 1;
    private static final int LONG_REST_KIND = 2;

    private final int groupXp;
    private final int kind;
    private final int dayNumber;
    private final int newLevel;
    private final int affectedCharacters;
    private final boolean partialDay;

    private PartyAdventuringDayProgressEvent(
            int groupXp,
            int kind,
            int dayNumber,
            int newLevel,
            int affectedCharacters,
            boolean partialDay
    ) {
        this.groupXp = Math.max(0, groupXp);
        this.kind = kind;
        this.dayNumber = Math.max(1, dayNumber);
        this.newLevel = Math.max(0, newLevel);
        this.affectedCharacters = Math.max(0, affectedCharacters);
        this.partialDay = partialDay;
    }

    public static PartyAdventuringDayProgressEvent levelUp(
            int groupXp,
            int dayNumber,
            int newLevel,
            int affectedCharacters,
            boolean partialDay
    ) {
        return new PartyAdventuringDayProgressEvent(
                groupXp,
                LEVEL_UP_KIND,
                dayNumber,
                newLevel,
                affectedCharacters,
                partialDay);
    }

    public static PartyAdventuringDayProgressEvent shortRest(int groupXp, int dayNumber, boolean partialDay) {
        return new PartyAdventuringDayProgressEvent(groupXp, SHORT_REST_KIND, dayNumber, 0, 0, partialDay);
    }

    public static PartyAdventuringDayProgressEvent longRest(int groupXp, int dayNumber) {
        return new PartyAdventuringDayProgressEvent(groupXp, LONG_REST_KIND, dayNumber, 0, 0, false);
    }

    public int groupXp() {
        return groupXp;
    }

    public int dayNumber() {
        return dayNumber;
    }

    public int newLevel() {
        return newLevel;
    }

    public int affectedCharacters() {
        return affectedCharacters;
    }

    public boolean partialDay() {
        return partialDay;
    }

    public boolean isLevelUp() {
        return kind == LEVEL_UP_KIND;
    }

    public boolean isShortRest() {
        return kind == SHORT_REST_KIND;
    }

    public boolean isLongRest() {
        return kind == LONG_REST_KIND;
    }

    int sortOrder() {
        return kind;
    }
}
