package src.domain.encounter.application;

import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.value.EncounterPlanCreature;
import src.domain.encounter.plan.value.EncounterPlanSummary;
import src.domain.encounter.published.SavedEncounterPlan;
import src.domain.encounter.published.SavedEncounterPlanCreature;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;

public final class EncounterPlanBoundaryTranslator {

    private EncounterPlanBoundaryTranslator() {
    }

    public static SavedEncounterPlanStatus toPublishedSavePlanStatus(
            SaveEncounterPlanUseCase.Status status
    ) {
        SaveEncounterPlanUseCase.Status effectiveStatus = status == null
                ? SaveEncounterPlanUseCase.Status.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> SavedEncounterPlanStatus.SUCCESS;
            case INVALID_REQUEST -> SavedEncounterPlanStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> SavedEncounterPlanStatus.STORAGE_ERROR;
        };
    }

    public static SavedEncounterPlanStatus toPublishedLoadPlanStatus(
            LoadSavedEncounterPlanUseCase.Status status
    ) {
        LoadSavedEncounterPlanUseCase.Status effectiveStatus = status == null
                ? LoadSavedEncounterPlanUseCase.Status.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> SavedEncounterPlanStatus.SUCCESS;
            case NOT_FOUND -> SavedEncounterPlanStatus.NOT_FOUND;
            case INVALID_REQUEST -> SavedEncounterPlanStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> SavedEncounterPlanStatus.STORAGE_ERROR;
        };
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

    public static EncounterPlanCreature toPlanCreature(SavedEncounterPlanCreature creature) {
        return new EncounterPlanCreature(creature.creatureId(), creature.quantity());
    }
}
