package src.domain.encounter.application;

import src.domain.encounter.plan.value.EncounterPlanSummary;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;

public final class EncounterPlanBoundaryTranslator {

    private EncounterPlanBoundaryTranslator() {
    }

    public static SavedEncounterPlanStatus toPublishedListPlansStatus(
            ListSavedEncounterPlansUseCase.Status status
    ) {
        ListSavedEncounterPlansUseCase.Status effectiveStatus = status == null
                ? ListSavedEncounterPlansUseCase.Status.STORAGE_ERROR
                : status;
        if (effectiveStatus == ListSavedEncounterPlansUseCase.Status.SUCCESS) {
            return SavedEncounterPlanStatus.SUCCESS;
        }
        return SavedEncounterPlanStatus.STORAGE_ERROR;
    }

    public static SavedEncounterPlan toPublishedPlan(EncounterPlan plan) {
        return new SavedEncounterPlan(
                plan.id(),
                plan.name(),
                plan.generatedLabel(),
                plan.creatures().stream()
                        .map(creature -> new SavedEncounterPlanCreature(
                                creature.creatureId(),
                                creature.quantity()))
                        .toList());
    }

    public static SavedEncounterPlanSummary toPublishedSummary(EncounterPlanSummary summary) {
        return new SavedEncounterPlanSummary(
                summary.id(),
                summary.name(),
                summary.generatedLabel(),
                summary.creatureCount());
    }
}
