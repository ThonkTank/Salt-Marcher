package features.party.domain.roster;

public final class PartyAdventuringDayCalculation {

    private final PartyAdventuringDayPlan plan;
    private final PartyAdventuringDayProgress progress;

    public PartyAdventuringDayCalculation(
            PartyAdventuringDayPlan plan,
            PartyAdventuringDayProgress progress
    ) {
        this.plan = plan == null ? PartyAdventuringDayPlan.empty() : plan;
        this.progress = progress == null ? PartyAdventuringDayProgress.empty(0) : progress;
    }

    public PartyAdventuringDayPlan plan() {
        return plan;
    }

    public PartyAdventuringDayProgress progress() {
        return progress;
    }

    public int plannedShortRests() {
        return progress.shortRests();
    }

    public int plannedLongRests() {
        return progress.longRests();
    }
}
