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
import src.domain.encounter.session.entity.EncounterSession;

final class EncounterSessionRuntimeMapper {

    private EncounterSessionRuntimeMapper() {
    }

    static EncounterSession.BudgetData toSessionBudget(EncounterDifficultyMath.BudgetSummary budget) {
        return new EncounterSession.BudgetData(
                budget.activePartyLevels(),
                budget.averagePartyLevel(),
                budget.easyThreshold(),
                budget.mediumThreshold(),
                budget.hardThreshold(),
                budget.deadlyThreshold());
    }

    static EncounterSession.GenerationResultData toSessionGenerationResult(
            EncounterGenerationUseCase.GenerateResult result
    ) {
        return new EncounterSession.GenerationResultData(
                mapSessionStatus(result.status()),
                result.encounters().stream().map(EncounterSessionRuntimeMapper::toSessionGeneratedEncounter).toList(),
                result.message(),
                toSessionDiagnostics(result.diagnostics()),
                result.advisories().contains(EncounterGenerationUseCase.GenerationAdvisory.FALLBACK_USED));
    }

    static EncounterSession.GenerationStatus mapSessionStatus(
            EncounterGenerationUseCase.GenerateStatus status
    ) {
        EncounterGenerationUseCase.GenerateStatus effectiveStatus = status == null
                ? EncounterGenerationUseCase.GenerateStatus.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> EncounterSession.GenerationStatus.SUCCESS;
            case NO_ACTIVE_PARTY -> EncounterSession.GenerationStatus.NO_ACTIVE_PARTY;
            case NO_CREATURES -> EncounterSession.GenerationStatus.NO_CREATURES;
            case NO_SOLUTION -> EncounterSession.GenerationStatus.NO_SOLUTION;
            case INVALID_REQUEST -> EncounterSession.GenerationStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterSession.GenerationStatus.STORAGE_ERROR;
        };
    }

    static EncounterSession.SavedPlanStatus toSessionSavePlanStatus(
            SaveEncounterPlanUseCase.Status status
    ) {
        SaveEncounterPlanUseCase.Status effectiveStatus = status == null
                ? SaveEncounterPlanUseCase.Status.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> EncounterSession.SavedPlanStatus.SUCCESS;
            case INVALID_REQUEST -> EncounterSession.SavedPlanStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterSession.SavedPlanStatus.STORAGE_ERROR;
        };
    }

    static EncounterSession.SavedPlanStatus toSessionLoadPlanStatus(
            LoadSavedEncounterPlanUseCase.Status status
    ) {
        LoadSavedEncounterPlanUseCase.Status effectiveStatus = status == null
                ? LoadSavedEncounterPlanUseCase.Status.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> EncounterSession.SavedPlanStatus.SUCCESS;
            case NOT_FOUND -> EncounterSession.SavedPlanStatus.NOT_FOUND;
            case INVALID_REQUEST -> EncounterSession.SavedPlanStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterSession.SavedPlanStatus.STORAGE_ERROR;
        };
    }

    static EncounterSession.SavedPlanStatus toSessionListPlansStatus(
            ListSavedEncounterPlansUseCase.Status status
    ) {
        ListSavedEncounterPlansUseCase.Status effectiveStatus = status == null
                ? ListSavedEncounterPlansUseCase.Status.STORAGE_ERROR
                : status;
        if (effectiveStatus == ListSavedEncounterPlansUseCase.Status.SUCCESS) {
            return EncounterSession.SavedPlanStatus.SUCCESS;
        }
        return EncounterSession.SavedPlanStatus.STORAGE_ERROR;
    }

    static EncounterSession.CreatureDetailData toSessionCreatureDetail(CreatureDetail detail) {
        return new EncounterSession.CreatureDetailData(
                detail.id(),
                detail.name(),
                detail.challengeRating(),
                detail.xp(),
                detail.hitPoints(),
                detail.armorClass(),
                detail.initiativeBonus(),
                detail.creatureType());
    }

    static EncounterPlanCreature toPlanCreature(EncounterSession.PlanCreatureData creature) {
        return new EncounterPlanCreature(creature.creatureId(), creature.quantity());
    }

    static EncounterSession.SavedPlanData toSessionSavedPlan(EncounterPlan plan) {
        return new EncounterSession.SavedPlanData(
                plan.id(),
                plan.name(),
                plan.generatedLabel(),
                plan.creatures().stream()
                        .map(creature -> new EncounterSession.PlanCreatureData(
                                creature.creatureId(),
                                creature.quantity()))
                        .toList());
    }

    static EncounterSession.SavedPlanSummaryData toSessionSavedPlanSummary(EncounterPlanSummary summary) {
        return new EncounterSession.SavedPlanSummaryData(
                summary.id(),
                summary.name(),
                summary.generatedLabel(),
                summary.creatureCount());
    }

    private static EncounterSession.GeneratedEncounterData toSessionGeneratedEncounter(
            EncounterGenerationUseCase.GeneratedEncounterData encounter
    ) {
        return new EncounterSession.GeneratedEncounterData(
                encounter.title(),
                encounter.achievedDifficulty(),
                encounter.adjustedXp(),
                encounter.creatures().stream().map(EncounterSessionRuntimeMapper::toSessionGeneratedCreature).toList());
    }

    private static EncounterSession.GeneratedCreatureData toSessionGeneratedCreature(
            EncounterGenerationUseCase.EncounterCreatureData creature
    ) {
        return new EncounterSession.GeneratedCreatureData(
                creature.creatureId(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                creature.quantity(),
                creature.role(),
                creature.tags());
    }

    private static Optional<EncounterSession.GenerationDiagnosticsData> toSessionDiagnostics(
            EncounterGenerationUseCase.@Nullable GenerationDiagnostics diagnostics
    ) {
        if (diagnostics == null) {
            return Optional.empty();
        }
        return Optional.of(new EncounterSession.GenerationDiagnosticsData(
                diagnostics.resolvedDifficulty(),
                diagnostics.resolvedTuning()));
    }
}
