package src.domain.encounter.published;

public record SavedEncounterPlanSummary(long id, String name, String generatedLabel, int creatureCount) {

    public SavedEncounterPlanSummary {
        name = name == null ? "" : name.trim();
        generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        creatureCount = Math.max(0, creatureCount);
    }
}
