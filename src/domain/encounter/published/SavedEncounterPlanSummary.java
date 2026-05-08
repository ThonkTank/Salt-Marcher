package src.domain.encounter.published;

import src.domain.encounter.plan.value.EncounterPlanSummary;

public final class SavedEncounterPlanSummary {

    private final EncounterPlanSummary summary;

    public SavedEncounterPlanSummary(long id, String name, String generatedLabel, int creatureCount) {
        this(new EncounterPlanSummary(Math.max(1L, id), name, generatedLabel, creatureCount));
    }

    public SavedEncounterPlanSummary(EncounterPlanSummary summary) {
        this.summary = summary == null ? new EncounterPlanSummary(1L, "", "", 0) : summary;
    }

    public static SavedEncounterPlanSummary fromSummary(EncounterPlanSummary summary) {
        return new SavedEncounterPlanSummary(summary);
    }

    public long id() {
        return summary.id();
    }

    public String name() {
        return summary.name();
    }

    public String generatedLabel() {
        return summary.generatedLabel();
    }

    public int creatureCount() {
        return summary.creatureCount();
    }
}
