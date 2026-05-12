package src.data.encounter.repository;

import java.util.List;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.generation.model.EncounterRequestedDifficulty;
import src.domain.encounter.model.generation.model.EncounterTuningIntent;
import src.domain.encounter.model.plan.model.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.model.EncounterPlanBudgetSummaryData;
import src.domain.encounter.model.plan.model.EncounterPlanSummary;
import src.domain.encounter.model.plan.model.SavedEncounterPlansLoadResult;
import src.domain.encounter.model.session.model.EncounterSessionPublicationData;
import src.domain.encounter.model.session.model.EncounterSessionSnapshotData;
import src.domain.encounter.model.session.model.EncounterSessionValues;
import src.domain.encounter.model.session.model.EncounterSessionValues.BuilderStateData;
import src.domain.encounter.model.session.model.EncounterSessionValues.CombatProjectionData;
import src.domain.encounter.model.session.model.EncounterSessionValues.Mode;
import src.domain.encounter.model.session.model.EncounterSessionValues.PartyMemberData;
import src.domain.encounter.model.session.model.EncounterSessionValues.ResultStateData;
import src.domain.encounter.model.session.model.EncounterTuningPreviewData;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository;
import src.domain.encounter.model.session.repository.EncounterSessionPublishedStateRepository;

public final class EncounterPublishedStateRepositoryAdapter
        implements EncounterSessionPublishedStateRepository, EncounterPlanPublishedStateRepository {

    private static final String SESSION_NOT_REGISTERED = "Encounter session is not registered.";
    private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";
    private static final String PLAN_BUDGET_NOT_REGISTERED = "Encounter plan budget service is not registered.";

    private final EncounterPublishedStateChannel<EncounterStateSnapshot> state =
            new EncounterPublishedStateChannel<>(EncounterStateSnapshot.empty(SESSION_NOT_REGISTERED));
    private final EncounterPublishedStateChannel<EncounterBuilderInputs> builderInputs =
            new EncounterPublishedStateChannel<>(EncounterBuilderInputs.empty());
    private final EncounterPublishedStateChannel<EncounterTuningPreviewResult> tuningPreview =
            new EncounterPublishedStateChannel<>(emptyTuningPreview());
    private final EncounterPublishedStateChannel<SavedEncounterPlanListResult> savedPlans =
            new EncounterPublishedStateChannel<>(emptySavedPlans());
    private final EncounterPublishedStateChannel<EncounterPlanBudgetResult> planBudget =
            new EncounterPublishedStateChannel<>(emptyPlanBudget());
    public final EncounterStateModel stateModel = new EncounterStateModel(
            state::current,
            state::subscribe);
    public final EncounterBuilderInputsModel builderInputsModel = new EncounterBuilderInputsModel(
            builderInputs::current,
            builderInputs::subscribe);
    public final EncounterTuningPreviewModel tuningPreviewModel = new EncounterTuningPreviewModel(
            tuningPreview::current,
            tuningPreview::subscribe);
    public final SavedEncounterPlanListModel savedPlansModel = new SavedEncounterPlanListModel(
            savedPlans::current,
            savedPlans::subscribe);
    public final EncounterPlanBudgetModel planBudgetModel = new EncounterPlanBudgetModel(
            planBudget::current,
            planBudget::subscribe);

    @Override
    public void publishCurrentSession(EncounterSessionPublicationData publication) {
        EncounterSessionPublicationData effective = publication == null
                ? EncounterSessionPublicationData.unavailable(SESSION_NOT_REGISTERED)
                : publication;
        this.state.publish(toPublishedSnapshot(effective));
        this.builderInputs.publish(toPublishedBuilderInputs(effective.builderInputs()));
        this.tuningPreview.publish(toPublishedTuningPreview(effective.tuningPreview()));
    }

    @Override
    public void publishSavedPlans(SavedEncounterPlansLoadResult result) {
        savedPlans.publish(result == null
                ? new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), PLAN_STORAGE_NOT_REGISTERED)
                : toPublishedSavedPlans(result));
    }

    @Override
    public void publishPlanBudget(EncounterPlanBudgetLoadResult result) {
        planBudget.publish(result == null
                ? new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.STORAGE_ERROR, null, PLAN_BUDGET_NOT_REGISTERED)
                : toPublishedPlanBudget(result));
    }

    private static EncounterStateSnapshot toPublishedSnapshot(EncounterSessionPublicationData publication) {
        EncounterSessionSnapshotData snapshot = publication.snapshot();
        if (snapshot == null) {
            return EncounterStateSnapshot.empty(publication.unavailableMessage().isBlank()
                    ? SESSION_NOT_REGISTERED
                    : publication.unavailableMessage());
        }
        BuilderStateData builderState = snapshot.builderState();
        CombatProjectionData combatState = snapshot.combatProjection();
        return new EncounterStateSnapshot(
                toPublishedMode(snapshot.mode()),
                toPublishedBuilderPane(builderState),
                new EncounterStateSnapshot.InitiativePane(snapshot.initiativeEntries().stream()
                        .map(entry -> new EncounterStateSnapshot.InitiativeRow(
                                entry.id(),
                                entry.label(),
                                entry.kind().label(),
                                entry.initiative()))
                        .toList()),
                toPublishedCombatPane(combatState, snapshot.missingCombatPartyMembers()),
                toPublishedResolutionPane(snapshot.resultState()),
                snapshot.status());
    }

    private static EncounterStateSnapshot.Mode toPublishedMode(int mode) {
        return switch (mode) {
            case Mode.BUILDER -> EncounterStateSnapshot.Mode.BUILDER;
            case Mode.INITIATIVE -> EncounterStateSnapshot.Mode.INITIATIVE;
            case Mode.COMBAT -> EncounterStateSnapshot.Mode.COMBAT;
            case Mode.RESULTS -> EncounterStateSnapshot.Mode.RESULTS;
            default -> EncounterStateSnapshot.Mode.BUILDER;
        };
    }

    private static EncounterStateSnapshot.BuilderPane toPublishedBuilderPane(BuilderStateData builderState) {
        BuilderStateData safeState = builderState == null ? EncounterSessionValues.emptyBuilderState() : builderState;
        return new EncounterStateSnapshot.BuilderPane(
                partySummary(safeState),
                safeState.templateLabel(),
                new EncounterStateSnapshot.ThresholdMeter(
                        safeState.difficulty().easy(),
                        safeState.difficulty().medium(),
                        safeState.difficulty().hard(),
                        safeState.difficulty().deadly(),
                        safeState.difficulty().adjustedXp(),
                        safeState.difficulty().difficulty()),
                toPublishedBuilderSettings(safeState.builderInputs()),
                safeState.generationAdvisoryMessages(),
                safeState.savedPlans().stream()
                        .map(EncounterPublishedStateRepositoryAdapter::toPublishedSummary)
                        .toList(),
                safeState.roster().stream()
                        .map(creature -> new EncounterStateSnapshot.RosterCard(
                                creature.creatureId(),
                                creature.name(),
                                creature.challengeRating(),
                                creature.totalXp(),
                                creature.armorClass(),
                                creature.creatureType(),
                                creature.encounterRole(),
                                creature.count()))
                        .toList(),
                safeState.roster().isEmpty(),
                safeState.canStartCombat(),
                safeState.canPreviousAlternative(),
                safeState.canNextAlternative(),
                safeState.canSavePlan(),
                safeState.canClearGenerationHistory(),
                safeState.pendingUndo()
                        .map(removed -> new EncounterStateSnapshot.UndoNotice(removed.token(), removed.creature().name()))
                        .orElse(null));
    }

    private static EncounterStateSnapshot.BuilderSettings toPublishedBuilderSettings(EncounterGenerationInputs inputs) {
        EncounterBuilderInputs published = toPublishedBuilderInputs(inputs);
        return new EncounterStateSnapshot.BuilderSettings(
                published.autoDifficulty() ? "Auto" : difficultyLabel(published.difficultyLevel()),
                published.autoBalance() ? -1 : published.balanceLevel(),
                published.autoAmount() ? -1.0 : published.amountValue(),
                published.autoDiversity() ? -1 : published.diversityLevel());
    }

    private static EncounterStateSnapshot.CombatPane toPublishedCombatPane(
            CombatProjectionData combatState,
            List<PartyMemberData> missingCombatPartyMembers
    ) {
        CombatProjectionData safeState = combatState == null ? CombatProjectionData.empty() : combatState;
        return new EncounterStateSnapshot.CombatPane(
                safeState.round(),
                safeState.status(),
                safeState.cards().stream()
                        .map(card -> new EncounterStateSnapshot.CombatCard(
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
                safeState.allEnemiesDefeated(),
                missingCombatPartyMembers == null
                        ? List.of()
                        : missingCombatPartyMembers.stream()
                                .map(member -> new EncounterStateSnapshot.PartyCandidate(
                                        member.numericId(),
                                        member.name(),
                                        member.level()))
                                .toList());
    }

    private static EncounterStateSnapshot.ResolutionPane toPublishedResolutionPane(ResultStateData resultState) {
        ResultStateData safeState = resultState == null ? ResultStateData.empty() : resultState;
        return new EncounterStateSnapshot.ResolutionPane(
                safeState.enemies().stream()
                        .map(enemy -> new EncounterStateSnapshot.ResultEnemy(
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

    private static EncounterBuilderInputs toPublishedBuilderInputs(EncounterGenerationInputs inputs) {
        EncounterGenerationInputs safeInputs = inputs == null ? EncounterGenerationInputs.empty() : inputs;
        EncounterRequestedDifficulty difficulty = safeInputs.targetDifficulty();
        EncounterTuningIntent tuning = safeInputs.tuning();
        return new EncounterBuilderInputs(
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                difficulty == null || difficulty.isAuto(),
                difficulty == null
                        ? EncounterRequestedDifficulty.autoDifficulty().publishedDifficultyLevel()
                        : difficulty.publishedDifficultyLevel(),
                tuning == null || tuning.isBalanceAuto(),
                tuning == null ? EncounterTuningIntent.defaultIntent().publishedBalanceLevel() : tuning.publishedBalanceLevel(),
                tuning == null || tuning.isAmountAuto(),
                tuning == null ? EncounterTuningIntent.defaultIntent().publishedAmountValue() : tuning.publishedAmountValue(),
                tuning == null || tuning.isDiversityAuto(),
                tuning == null
                        ? EncounterTuningIntent.defaultIntent().publishedDiversityLevel()
                        : tuning.publishedDiversityLevel(),
                safeInputs.encounterTableIds());
    }

    private static EncounterTuningPreviewResult toPublishedTuningPreview(EncounterTuningPreviewData data) {
        EncounterTuningPreviewData safeData = data == null ? EncounterTuningPreviewData.storageError("") : data;
        return new EncounterTuningPreviewResult(
                toPublishedStatus(safeData.status()),
                new EncounterTuningPreviewLabels(
                        safeData.easyLabels().stream().map(EncounterPublishedStateRepositoryAdapter::toPublishedLabel).toList(),
                        safeData.mediumLabels().stream().map(EncounterPublishedStateRepositoryAdapter::toPublishedLabel).toList(),
                        safeData.hardLabels().stream().map(EncounterPublishedStateRepositoryAdapter::toPublishedLabel).toList(),
                        safeData.deadlyLabels().stream().map(EncounterPublishedStateRepositoryAdapter::toPublishedLabel).toList()),
                safeData.message());
    }

    private static EncounterGenerationStatus toPublishedStatus(EncounterTuningPreviewData.Status status) {
        return switch (status == null ? EncounterTuningPreviewData.Status.STORAGE_ERROR : status) {
            case SUCCESS -> EncounterGenerationStatus.successStatus();
            case NO_ACTIVE_PARTY -> EncounterGenerationStatus.noActivePartyStatus();
            case STORAGE_ERROR -> EncounterGenerationStatus.defaultFailure();
        };
    }

    private static EncounterTuningPreviewLabels.PreviewLabel toPublishedLabel(EncounterTuningPreviewData.PreviewLabel label) {
        return new EncounterTuningPreviewLabels.PreviewLabel(label.value(), label.label());
    }

    private static SavedEncounterPlanListResult toPublishedSavedPlans(SavedEncounterPlansLoadResult result) {
        return new SavedEncounterPlanListResult(
                result.status() == SavedEncounterPlansLoadResult.Status.SUCCESS
                        ? SavedEncounterPlanStatus.successStatus()
                        : SavedEncounterPlanStatus.storageErrorStatus(),
                result.plans().stream().map(EncounterPublishedStateRepositoryAdapter::toPublishedSummary).toList(),
                result.message());
    }

    private static SavedEncounterPlanSummary toPublishedSummary(EncounterPlanSummary summary) {
        if (summary == null) {
            return new SavedEncounterPlanSummary(0L, "", "");
        }
        return new SavedEncounterPlanSummary(
                summary.id(),
                summary.name(),
                summaryText(summary.generatedLabel(), summary.creatureCount()));
    }

    private static EncounterPlanBudgetResult toPublishedPlanBudget(EncounterPlanBudgetLoadResult result) {
        return new EncounterPlanBudgetResult(
                toPublishedPlanBudgetStatus(result.status()),
                toPublishedPlanBudgetSummary(result.summary()),
                result.message());
    }

    private static EncounterPlanBudgetStatus toPublishedPlanBudgetStatus(EncounterPlanBudgetLoadResult.Status status) {
        return switch (status == null ? EncounterPlanBudgetLoadResult.Status.STORAGE_ERROR : status) {
            case SUCCESS -> EncounterPlanBudgetStatus.SUCCESS;
            case NOT_FOUND -> EncounterPlanBudgetStatus.NOT_FOUND;
            case NO_ACTIVE_PARTY -> EncounterPlanBudgetStatus.NO_ACTIVE_PARTY;
            case INVALID_REQUEST -> EncounterPlanBudgetStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterPlanBudgetStatus.STORAGE_ERROR;
        };
    }

    private static EncounterPlanBudgetSummary toPublishedPlanBudgetSummary(EncounterPlanBudgetSummaryData summary) {
        if (summary == null) {
            return null;
        }
        return new EncounterPlanBudgetSummary(
                summary.planId(),
                summary.planName(),
                summary.generatedLabel(),
                summary.creatureCount(),
                summary.baseXp(),
                summary.adjustedXp(),
                summary.multiplier(),
                summary.difficultyLabel());
    }

    private static String partySummary(BuilderStateData state) {
        if (state.party().isEmpty()) {
            return "Party: 0";
        }
        long averageLevel = Math.round(state.party().stream()
                .mapToInt(member -> member.level())
                .average()
                .orElse(1.0));
        return "Party: " + state.party().size() + ", Lv " + averageLevel;
    }

    private static String difficultyLabel(int difficultyLevel) {
        return switch (difficultyLevel) {
            case 1 -> "Easy";
            case 3 -> "Hard";
            case 4 -> "Deadly";
            default -> "Medium";
        };
    }

    private static String summaryText(String generatedLabel, int creatureCount) {
        StringBuilder text = new StringBuilder()
                .append(Math.max(0, creatureCount))
                .append(" Kreaturen");
        String safeGeneratedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        if (!safeGeneratedLabel.isBlank()) {
            text.append(" · ").append(safeGeneratedLabel);
        }
        return text.toString();
    }

    private static EncounterTuningPreviewResult emptyTuningPreview() {
        return new EncounterTuningPreviewResult(
                EncounterGenerationStatus.STORAGE_ERROR,
                new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of()),
                "");
    }

    private static SavedEncounterPlanListResult emptySavedPlans() {
        return new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), "");
    }

    private static EncounterPlanBudgetResult emptyPlanBudget() {
        return new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.STORAGE_ERROR, null, "");
    }
}
