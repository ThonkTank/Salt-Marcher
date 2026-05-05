package src.domain.encounter;

import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.published.CreatureDetail;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.value.EncounterPlanCreature;
import src.domain.encounter.plan.value.EncounterPlanSummary;
import src.domain.encounter.session.entity.EncounterSessionRuntimeData;

final class EncounterSessionRuntimeMapper {

    private EncounterSessionRuntimeMapper() {
    }

    static EncounterSessionRuntimeData.BudgetData toSessionBudget(EncounterDifficultyMath.BudgetSummary budget) {
        return new EncounterSessionRuntimeData.BudgetData(
                budget.activePartyLevels(),
                budget.averagePartyLevel(),
                budget.easyThreshold(),
                budget.mediumThreshold(),
                budget.hardThreshold(),
                budget.deadlyThreshold());
    }

    static EncounterSessionRuntimeData.GenerationResultData toSessionGenerationResult(
            EncounterGenerationUseCase.GenerateResult result
    ) {
        return new EncounterSessionRuntimeData.GenerationResultData(
                mapSessionStatus(result.status()),
                result.encounters().stream().map(EncounterSessionRuntimeMapper::toSessionGeneratedEncounter).toList(),
                result.message(),
                toSessionDiagnostics(result.diagnostics()),
                result.advisories().contains(EncounterGenerationUseCase.GenerationAdvisory.FALLBACK_USED));
    }

    static EncounterSessionRuntimeData.GenerationStatus mapSessionStatus(
            EncounterGenerationUseCase.GenerateStatus status
    ) {
        EncounterGenerationUseCase.GenerateStatus effectiveStatus = status == null
                ? EncounterGenerationUseCase.GenerateStatus.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> EncounterSessionRuntimeData.GenerationStatus.SUCCESS;
            case NO_ACTIVE_PARTY -> EncounterSessionRuntimeData.GenerationStatus.NO_ACTIVE_PARTY;
            case NO_CREATURES -> EncounterSessionRuntimeData.GenerationStatus.NO_CREATURES;
            case NO_SOLUTION -> EncounterSessionRuntimeData.GenerationStatus.NO_SOLUTION;
            case INVALID_REQUEST -> EncounterSessionRuntimeData.GenerationStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterSessionRuntimeData.GenerationStatus.STORAGE_ERROR;
        };
    }

    static EncounterSessionRuntimeData.SavedPlanStatus toSessionSavePlanStatus(
            SaveEncounterPlanUseCase.Status status
    ) {
        SaveEncounterPlanUseCase.Status effectiveStatus = status == null
                ? SaveEncounterPlanUseCase.Status.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> EncounterSessionRuntimeData.SavedPlanStatus.SUCCESS;
            case INVALID_REQUEST -> EncounterSessionRuntimeData.SavedPlanStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterSessionRuntimeData.SavedPlanStatus.STORAGE_ERROR;
        };
    }

    static EncounterSessionRuntimeData.SavedPlanStatus toSessionLoadPlanStatus(
            LoadSavedEncounterPlanUseCase.Status status
    ) {
        LoadSavedEncounterPlanUseCase.Status effectiveStatus = status == null
                ? LoadSavedEncounterPlanUseCase.Status.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> EncounterSessionRuntimeData.SavedPlanStatus.SUCCESS;
            case NOT_FOUND -> EncounterSessionRuntimeData.SavedPlanStatus.NOT_FOUND;
            case INVALID_REQUEST -> EncounterSessionRuntimeData.SavedPlanStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterSessionRuntimeData.SavedPlanStatus.STORAGE_ERROR;
        };
    }

    static EncounterSessionRuntimeData.SavedPlanStatus toSessionListPlansStatus(
            ListSavedEncounterPlansUseCase.Status status
    ) {
        ListSavedEncounterPlansUseCase.Status effectiveStatus = status == null
                ? ListSavedEncounterPlansUseCase.Status.STORAGE_ERROR
                : status;
        if (effectiveStatus == ListSavedEncounterPlansUseCase.Status.SUCCESS) {
            return EncounterSessionRuntimeData.SavedPlanStatus.SUCCESS;
        }
        return EncounterSessionRuntimeData.SavedPlanStatus.STORAGE_ERROR;
    }

    static EncounterSessionRuntimeData.CreatureDetailData toSessionCreatureDetail(CreatureDetail detail) {
        return new EncounterSessionRuntimeData.CreatureDetailData(
                detail.id(),
                detail.name(),
                detail.challengeRating(),
                detail.xp(),
                detail.hitPoints(),
                detail.armorClass(),
                detail.initiativeBonus(),
                detail.creatureType());
    }

    static EncounterPlanCreature toPlanCreature(EncounterSessionRuntimeData.PlanCreatureData creature) {
        return new EncounterPlanCreature(creature.creatureId(), creature.quantity());
    }

    static EncounterSessionRuntimeData.SavedPlanData toSessionSavedPlan(EncounterPlan plan) {
        return new EncounterSessionRuntimeData.SavedPlanData(
                plan.id(),
                plan.name(),
                plan.generatedLabel(),
                plan.creatures().stream()
                        .map(creature -> new EncounterSessionRuntimeData.PlanCreatureData(
                                creature.creatureId(),
                                creature.quantity()))
                        .toList());
    }

    static EncounterSessionRuntimeData.SavedPlanSummaryData toSessionSavedPlanSummary(EncounterPlanSummary summary) {
        return new EncounterSessionRuntimeData.SavedPlanSummaryData(
                summary.id(),
                summary.name(),
                summary.generatedLabel(),
                summary.creatureCount());
    }

    private static EncounterSessionRuntimeData.GeneratedEncounterData toSessionGeneratedEncounter(
            EncounterGenerationUseCase.GeneratedEncounterData encounter
    ) {
        return new EncounterSessionRuntimeData.GeneratedEncounterData(
                encounter.title(),
                encounter.achievedDifficulty(),
                encounter.adjustedXp(),
                encounter.creatures().stream().map(EncounterSessionRuntimeMapper::toSessionGeneratedCreature).toList());
    }

    private static EncounterSessionRuntimeData.GeneratedCreatureData toSessionGeneratedCreature(
            EncounterGenerationUseCase.EncounterCreatureData creature
    ) {
        return new EncounterSessionRuntimeData.GeneratedCreatureData(
                creature.creatureId(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                creature.quantity(),
                creature.role(),
                creature.tags());
    }

    private static Optional<EncounterSessionRuntimeData.GenerationDiagnosticsData> toSessionDiagnostics(
            EncounterGenerationUseCase.@Nullable GenerationDiagnostics diagnostics
    ) {
        if (diagnostics == null) {
            return Optional.empty();
        }
        return Optional.of(new EncounterSessionRuntimeData.GenerationDiagnosticsData(
                diagnostics.resolvedDifficulty(),
                diagnostics.resolvedTuning()));
    }
}
