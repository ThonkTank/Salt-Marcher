package src.domain.encounter;

import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.published.CreatureDetail;
import src.domain.encounter.application.ApplyEncounterSessionUseCase;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.generation.value.EncounterTuningIntent;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.value.EncounterPlanCreature;
import src.domain.encounter.plan.value.EncounterPlanSummary;
import src.domain.encounter.published.ApplyEncounterSessionCommand;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterGenerationTuning;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.domain.encounter.published.GenerateEncounterCommand;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.encounter.session.entity.EncounterSession;

final class EncounterSessionMapper {

    private EncounterSessionMapper() {
    }

    static ApplyEncounterSessionUseCase.Command toInternalCommand(
            @Nullable ApplyEncounterSessionCommand command
    ) {
        if (command == null) {
            return ApplyEncounterSessionUseCase.Command.refresh();
        }
        return new ApplyEncounterSessionUseCase.Command(
                ApplyEncounterSessionUseCase.Action.valueOf(command.action().name()),
                command.generation() == null
                        ? Optional.empty()
                        : Optional.of(toInternalGenerateRequest(command.generation())),
                toInternalBuilderInputs(command.builderInputs()),
                command.creatureId(),
                command.planId(),
                command.delta(),
                command.token(),
                command.initiativeInputs().stream()
                        .map(entry -> new EncounterSession.InitiativeInputData(entry.id(), entry.initiative()))
                        .toList(),
                command.combatantId(),
                command.initiative(),
                command.partyMemberId(),
                command.amount(),
                command.healing());
    }

    static EncounterSessionSnapshot toPublishedSnapshot(EncounterSession.SnapshotData snapshot) {
        if (snapshot == null) {
            return EncounterSessionSnapshot.empty("");
        }
        return new EncounterSessionSnapshot(
                toPublishedMode(snapshot.mode()),
                toPublishedBuilderState(snapshot.builderState()),
                toPublishedInitiativeState(snapshot.initiativeState()),
                toPublishedCombatProjection(snapshot.combatState()),
                toPublishedResultState(snapshot.resultState()),
                snapshot.status(),
                snapshot.missingCombatPartyMembers().stream()
                        .map(member -> new EncounterSessionSnapshot.PartyMember(
                                member.id(),
                                member.numericId(),
                                member.name(),
                                member.level()))
                        .toList());
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
                result.encounters().stream().map(EncounterSessionMapper::toSessionGeneratedEncounter).toList(),
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
        return switch (effectiveStatus) {
            case SUCCESS -> EncounterSession.SavedPlanStatus.SUCCESS;
            case STORAGE_ERROR -> EncounterSession.SavedPlanStatus.STORAGE_ERROR;
        };
    }

    static EncounterGenerationUseCase.GenerateRequest toGeneratorRequest(
            EncounterSession.GenerateRequestData request
    ) {
        EncounterSession.GenerateRequestData effectiveRequest = request == null
                ? new EncounterSession.GenerateRequestData(
                        List.of(),
                        List.of(),
                        List.of(),
                        EncounterSession.DifficultyBand.defaultBand(),
                        5,
                        EncounterSession.TuningData.defaultTuning(),
                        0L,
                        List.of())
                : request;
        return new EncounterGenerationUseCase.GenerateRequest(
                effectiveRequest.creatureTypes(),
                effectiveRequest.creatureSubtypes(),
                effectiveRequest.biomes(),
                toDifficultyIntent(effectiveRequest.targetDifficulty()),
                effectiveRequest.targetDifficulty().isAuto(),
                effectiveRequest.alternativeCount(),
                toTuningIntent(effectiveRequest.tuning()),
                effectiveRequest.generationSeed(),
                effectiveRequest.encounterTableIds(),
                List.of(),
                List.of());
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
                toSessionDifficultyBand(encounter.achievedDifficulty()),
                encounter.adjustedXp(),
                encounter.creatures().stream().map(EncounterSessionMapper::toSessionGeneratedCreature).toList());
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
                toSessionDifficultyBand(diagnostics.resolvedDifficulty()),
                toSessionTuningData(diagnostics.resolvedTuning())));
    }

    private static EncounterSession.BuilderInputsData toInternalBuilderInputs(
            EncounterSessionSnapshot.BuilderInputs builderInputs
    ) {
        EncounterSessionSnapshot.BuilderInputs safeInputs = builderInputs == null
                ? EncounterSessionSnapshot.BuilderInputs.empty()
                : builderInputs;
        return new EncounterSession.BuilderInputsData(
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                toInternalDifficultyBand(safeInputs.targetDifficulty()),
                toInternalTuningData(safeInputs.tuning()),
                safeInputs.encounterTableIds());
    }

    private static EncounterSession.GenerateRequestData toInternalGenerateRequest(
            @Nullable GenerateEncounterCommand request
    ) {
        GenerateEncounterCommand safeRequest = request == null
                ? new GenerateEncounterCommand(
                        List.of(),
                        List.of(),
                        List.of(),
                        EncounterDifficultyBand.defaultBand(),
                        5,
                        List.of(),
                        List.of())
                : request;
        return new EncounterSession.GenerateRequestData(
                safeRequest.creatureTypes(),
                safeRequest.creatureSubtypes(),
                safeRequest.biomes(),
                toInternalDifficultyBand(safeRequest.targetDifficulty()),
                safeRequest.alternativeCount(),
                toInternalTuningData(safeRequest.tuning()),
                safeRequest.generationSeed(),
                safeRequest.encounterTableIds());
    }

    private static EncounterSessionSnapshot.Mode toPublishedMode(EncounterSession.Mode mode) {
        EncounterSession.Mode effectiveMode = mode == null ? EncounterSession.Mode.BUILDER : mode;
        return switch (effectiveMode) {
            case BUILDER -> EncounterSessionSnapshot.Mode.BUILDER;
            case INITIATIVE -> EncounterSessionSnapshot.Mode.INITIATIVE;
            case COMBAT -> EncounterSessionSnapshot.Mode.COMBAT;
            case RESULTS -> EncounterSessionSnapshot.Mode.RESULTS;
        };
    }

    private static EncounterSessionSnapshot.BuilderState toPublishedBuilderState(
            EncounterSession.BuilderStateData builderState
    ) {
        EncounterSession.BuilderStateData safeState = builderState == null
                ? new EncounterSession.BuilderStateData(
                        List.of(),
                        List.of(),
                        "",
                        new EncounterSession.DifficultySummaryData(0, 0, 0, 0, 0, ""),
                        EncounterSession.BuilderInputsData.empty(),
                        List.of(),
                        false,
                        false,
                        false,
                        false,
                        false,
                        Optional.empty())
                : builderState;
        return new EncounterSessionSnapshot.BuilderState(
                safeState.party().stream()
                        .map(member -> new EncounterSessionSnapshot.PartyMember(
                                member.id(),
                                member.numericId(),
                                member.name(),
                                member.level()))
                        .toList(),
                safeState.roster().stream()
                        .map(creature -> new EncounterSessionSnapshot.EncounterCreature(
                                creature.id(),
                                creature.creatureId(),
                                creature.name(),
                                creature.cr(),
                                creature.xp(),
                                creature.hp(),
                                creature.ac(),
                                creature.initiativeBonus(),
                                creature.type(),
                                creature.role(),
                                creature.count(),
                                creature.tags()))
                        .toList(),
                safeState.templateLabel(),
                new EncounterSessionSnapshot.DifficultySummary(
                        safeState.difficulty().easy(),
                        safeState.difficulty().medium(),
                        safeState.difficulty().hard(),
                        safeState.difficulty().deadly(),
                        safeState.difficulty().adjustedXp(),
                        safeState.difficulty().difficulty()),
                toPublishedBuilderInputs(safeState.builderInputs()),
                "",
                List.of(),
                safeState.savedPlans().stream()
                        .map(summary -> new SavedEncounterPlanSummary(
                                summary.id(),
                                summary.name(),
                                summary.generatedLabel(),
                                summary.creatureCount()))
                        .toList(),
                safeState.canStartCombat(),
                safeState.canPreviousAlternative(),
                safeState.canNextAlternative(),
                safeState.canSavePlan(),
                safeState.canClearGenerationHistory(),
                safeState.pendingUndo()
                        .map(entry -> new EncounterSessionSnapshot.RemovedRosterEntry(
                                entry.token(),
                                entry.index(),
                                new EncounterSessionSnapshot.EncounterCreature(
                                        entry.creature().id(),
                                        entry.creature().creatureId(),
                                        entry.creature().name(),
                                        entry.creature().cr(),
                                        entry.creature().xp(),
                                        entry.creature().hp(),
                                        entry.creature().ac(),
                                        entry.creature().initiativeBonus(),
                                        entry.creature().type(),
                                        entry.creature().role(),
                                        entry.creature().count(),
                                        entry.creature().tags())))
                        .orElse(null));
    }

    private static EncounterSessionSnapshot.BuilderInputs toPublishedBuilderInputs(
            EncounterSession.BuilderInputsData builderInputs
    ) {
        EncounterSession.BuilderInputsData safeInputs = builderInputs == null
                ? EncounterSession.BuilderInputsData.empty()
                : builderInputs;
        return new EncounterSessionSnapshot.BuilderInputs(
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                toPublishedDifficultyBand(safeInputs.targetDifficulty()),
                toPublishedTuningData(safeInputs.tuning()),
                safeInputs.encounterTableIds());
    }

    private static EncounterSessionSnapshot.InitiativeState toPublishedInitiativeState(
            EncounterSession.InitiativeStateData initiativeState
    ) {
        EncounterSession.InitiativeStateData safeState = initiativeState == null
                ? EncounterSession.InitiativeStateData.empty()
                : initiativeState;
        return new EncounterSessionSnapshot.InitiativeState(
                safeState.entries().stream()
                        .map(entry -> new EncounterSessionSnapshot.InitiativeEntry(
                                entry.id(),
                                entry.label(),
                                entry.kind().publishedLabel(),
                                entry.initiative()))
                        .toList());
    }

    private static EncounterSessionSnapshot.CombatProjection toPublishedCombatProjection(
            EncounterSession.CombatProjectionData combatState
    ) {
        EncounterSession.CombatProjectionData safeState = combatState == null
                ? EncounterSession.CombatProjectionData.empty()
                : combatState;
        return new EncounterSessionSnapshot.CombatProjection(
                safeState.currentTurnIndex(),
                safeState.round(),
                safeState.status(),
                safeState.cards().stream()
                        .map(card -> new EncounterSessionSnapshot.CombatCardSnapshot(
                                card.id(),
                                card.name(),
                                card.playerCharacter(),
                                card.active(),
                                card.alive(),
                                card.currentHp(),
                                card.maxHp(),
                                card.armorClass(),
                                card.initiative(),
                                card.count(),
                                card.detail()))
                        .toList(),
                safeState.allEnemiesDefeated());
    }

    private static EncounterSessionSnapshot.ResultState toPublishedResultState(
            EncounterSession.ResultStateData resultState
    ) {
        EncounterSession.ResultStateData safeState = resultState == null
                ? EncounterSession.ResultStateData.empty()
                : resultState;
        return new EncounterSessionSnapshot.ResultState(
                safeState.enemies().stream()
                        .map(enemy -> new EncounterSessionSnapshot.ResultEnemySnapshot(
                                enemy.name(),
                                enemy.status(),
                                enemy.hpLoss(),
                                enemy.xp(),
                                enemy.defeatedByDefault(),
                                enemy.loot()))
                        .toList(),
                safeState.defeatedCount(),
                safeState.eligibleXp(),
                safeState.perPlayerXp(),
                safeState.goldSummary(),
                safeState.lootDetail(),
                safeState.awardStatus(),
                safeState.xpAwarded(),
                safeState.canAwardXp(),
                safeState.partySize());
    }

    private static EncounterSession.DifficultyBand toSessionDifficultyBand(EncounterDifficultyIntent intent) {
        EncounterDifficultyIntent effectiveIntent = intent == null ? EncounterDifficultyIntent.MEDIUM : intent;
        return switch (effectiveIntent) {
            case EASY -> EncounterSession.DifficultyBand.EASY;
            case MEDIUM -> EncounterSession.DifficultyBand.MEDIUM;
            case HARD -> EncounterSession.DifficultyBand.HARD;
            case DEADLY -> EncounterSession.DifficultyBand.DEADLY;
        };
    }

    private static EncounterDifficultyIntent toDifficultyIntent(EncounterSession.DifficultyBand band) {
        EncounterSession.DifficultyBand effectiveBand = band == null
                ? EncounterSession.DifficultyBand.MEDIUM
                : band;
        return switch (effectiveBand) {
            case AUTO -> EncounterDifficultyIntent.MEDIUM;
            case EASY -> EncounterDifficultyIntent.EASY;
            case MEDIUM -> EncounterDifficultyIntent.MEDIUM;
            case HARD -> EncounterDifficultyIntent.HARD;
            case DEADLY -> EncounterDifficultyIntent.DEADLY;
        };
    }

    private static EncounterSession.DifficultyBand toInternalDifficultyBand(EncounterDifficultyBand band) {
        EncounterDifficultyBand effectiveBand = band == null ? EncounterDifficultyBand.defaultBand() : band;
        return switch (effectiveBand) {
            case AUTO -> EncounterSession.DifficultyBand.AUTO;
            case EASY -> EncounterSession.DifficultyBand.EASY;
            case MEDIUM -> EncounterSession.DifficultyBand.MEDIUM;
            case HARD -> EncounterSession.DifficultyBand.HARD;
            case DEADLY -> EncounterSession.DifficultyBand.DEADLY;
        };
    }

    private static EncounterDifficultyBand toPublishedDifficultyBand(EncounterSession.DifficultyBand band) {
        EncounterSession.DifficultyBand effectiveBand = band == null
                ? EncounterSession.DifficultyBand.MEDIUM
                : band;
        return switch (effectiveBand) {
            case AUTO -> EncounterDifficultyBand.AUTO;
            case EASY -> EncounterDifficultyBand.EASY;
            case MEDIUM -> EncounterDifficultyBand.MEDIUM;
            case HARD -> EncounterDifficultyBand.HARD;
            case DEADLY -> EncounterDifficultyBand.DEADLY;
        };
    }

    private static EncounterSession.TuningData toSessionTuningData(EncounterTuningIntent tuning) {
        EncounterTuningIntent effective = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        return new EncounterSession.TuningData(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }

    private static EncounterTuningIntent toTuningIntent(EncounterSession.TuningData tuning) {
        EncounterSession.TuningData effective = tuning == null
                ? EncounterSession.TuningData.defaultTuning()
                : tuning;
        return new EncounterTuningIntent(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }

    private static EncounterSession.TuningData toInternalTuningData(EncounterGenerationTuning tuning) {
        EncounterGenerationTuning effective = tuning == null
                ? EncounterGenerationTuning.autoTuning()
                : tuning;
        return new EncounterSession.TuningData(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }

    private static EncounterGenerationTuning toPublishedTuningData(EncounterSession.TuningData tuning) {
        EncounterSession.TuningData effective = tuning == null
                ? EncounterSession.TuningData.autoTuning()
                : tuning;
        return new EncounterGenerationTuning(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }
}
