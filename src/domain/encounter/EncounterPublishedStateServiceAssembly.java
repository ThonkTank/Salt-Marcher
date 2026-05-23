package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.encounter.model.plan.model.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.model.EncounterPlanSummary;
import src.domain.encounter.model.plan.model.SavedEncounterPlansLoadResult;
import src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.generation.model.EncounterRequestedDifficulty;
import src.domain.encounter.model.generation.model.EncounterTuningIntent;
import src.domain.encounter.model.session.model.BuilderStateData;
import src.domain.encounter.model.session.model.CombatProjectionData;
import src.domain.encounter.model.session.model.EncounterSessionPublicationData;
import src.domain.encounter.model.session.model.EncounterSessionSnapshotData;
import src.domain.encounter.model.session.model.EncounterTuningPreviewData;
import src.domain.encounter.model.session.model.Mode;
import src.domain.encounter.model.session.model.PartyMemberData;
import src.domain.encounter.model.session.model.ResultStateData;
import src.domain.encounter.model.session.repository.EncounterSessionPublishedStateRepository;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;

@SuppressWarnings({
        "PMD.CouplingBetweenObjects",
        "PMD.TooManyMethods"
})
final class EncounterPublishedStateServiceAssembly {

    private final SessionPublishedState session = new SessionPublishedState();
    private final PlanPublishedState plan = new PlanPublishedState();

    EncounterSessionPublishedStateRepository sessionRepository() {
        return session;
    }

    EncounterPlanPublishedStateRepository planRepository() {
        return plan;
    }

    src.domain.encounter.published.EncounterStateModel stateModel() {
        return session.stateModel();
    }

    src.domain.encounter.published.EncounterBuilderInputsModel builderInputsModel() {
        return session.builderInputsModel();
    }

    src.domain.encounter.published.EncounterTuningPreviewModel tuningPreviewModel() {
        return session.tuningPreviewModel();
    }

    src.domain.encounter.published.SavedEncounterPlanListModel savedPlansModel() {
        return plan.savedPlansModel();
    }

    src.domain.encounter.published.EncounterPlanBudgetModel planBudgetModel() {
        return plan.planBudgetModel();
    }

    private static final class PlanPublishedState implements EncounterPlanPublishedStateRepository {

        private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";
        private static final String PLAN_BUDGET_NOT_REGISTERED = "Encounter plan budget service is not registered.";

        private final PublishedStateChannel<SavedEncounterPlanListResult> savedPlans =
                new PublishedStateChannel<>(emptySavedPlans());
        private final PublishedStateChannel<EncounterPlanBudgetResult> planBudget =
                new PublishedStateChannel<>(emptyPlanBudget());
        private final src.domain.encounter.published.SavedEncounterPlanListModel savedPlansModel =
                new src.domain.encounter.published.SavedEncounterPlanListModel(
                savedPlans::current,
                savedPlans::subscribe);
        private final src.domain.encounter.published.EncounterPlanBudgetModel planBudgetModel =
                new src.domain.encounter.published.EncounterPlanBudgetModel(
                planBudget::current,
                planBudget::subscribe);

        private src.domain.encounter.published.SavedEncounterPlanListModel savedPlansModel() {
            return savedPlansModel;
        }

        private src.domain.encounter.published.EncounterPlanBudgetModel planBudgetModel() {
            return planBudgetModel;
        }

        @Override
        public void publishSavedPlans(SavedEncounterPlansLoadResult result) {
            savedPlans.publish(result == null
                    ? storageUnavailable(PLAN_STORAGE_NOT_REGISTERED)
                    : toPublishedSavedPlans(result));
        }

        @Override
        public void publishPlanBudget(EncounterPlanBudgetLoadResult result) {
            planBudget.publish(result == null
                    ? budgetUnavailable(PLAN_BUDGET_NOT_REGISTERED)
                    : toPublishedPlanBudget(result));
        }

        private static SavedEncounterPlanListResult toPublishedSavedPlans(SavedEncounterPlansLoadResult result) {
            return new SavedEncounterPlanListResult(
                    result.loadedSuccessfully()
                            ? SavedEncounterPlanStatus.successStatus()
                            : SavedEncounterPlanStatus.storageErrorStatus(),
                    result.plans().stream()
                            .map(PlanProjection::toPublishedSummary)
                            .toList(),
                    result.message());
        }

        private static EncounterPlanBudgetResult toPublishedPlanBudget(EncounterPlanBudgetLoadResult result) {
            return new EncounterPlanBudgetResult(
                    toPublishedPlanBudgetStatus(result),
                    toPublishedPlanBudgetSummary(result.summary()),
                    result.message());
        }

        private static SavedEncounterPlanListResult storageUnavailable(String message) {
            return new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), message);
        }

        private static EncounterPlanBudgetResult budgetUnavailable(String message) {
            return new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.STORAGE_ERROR, null, message);
        }

        private static EncounterPlanBudgetStatus toPublishedPlanBudgetStatus(EncounterPlanBudgetLoadResult result) {
            if (result == null || result.storageFailed()) {
                return EncounterPlanBudgetStatus.STORAGE_ERROR;
            }
            if (result.loadedSuccessfully()) {
                return EncounterPlanBudgetStatus.SUCCESS;
            }
            if (result.planMissing()) {
                return EncounterPlanBudgetStatus.NOT_FOUND;
            }
            if (result.activePartyMissing()) {
                return EncounterPlanBudgetStatus.NO_ACTIVE_PARTY;
            }
            if (result.requestRejected()) {
                return EncounterPlanBudgetStatus.INVALID_REQUEST;
            }
            return EncounterPlanBudgetStatus.STORAGE_ERROR;
        }

        private static src.domain.encounter.published.EncounterPlanBudgetSummary toPublishedPlanBudgetSummary(
                src.domain.encounter.model.plan.model.EncounterPlanBudgetSummaryData summary
        ) {
            if (summary == null) {
                return null;
            }
            return new src.domain.encounter.published.EncounterPlanBudgetSummary(
                    summary.planId(),
                    summary.planName(),
                    summary.generatedLabel(),
                    summary.creatureCount(),
                    summary.baseXp(),
                    summary.adjustedXp(),
                    summary.multiplier(),
                    summary.difficultyLabel());
        }

        private static SavedEncounterPlanListResult emptySavedPlans() {
            return new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), "");
        }

        private static EncounterPlanBudgetResult emptyPlanBudget() {
            return new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.STORAGE_ERROR, null, "");
        }

    }

    private static final class SessionPublishedState implements EncounterSessionPublishedStateRepository {

        private static final String SESSION_NOT_REGISTERED = "Encounter session is not registered.";

        private final PublishedStateChannel<EncounterStateSnapshot> state =
                new PublishedStateChannel<>(EncounterStateSnapshot.empty(SESSION_NOT_REGISTERED));
        private final PublishedStateChannel<EncounterBuilderInputs> builderInputs =
                new PublishedStateChannel<>(EncounterBuilderInputs.empty());
        private final PublishedStateChannel<EncounterTuningPreviewResult> tuningPreview =
                new PublishedStateChannel<>(TuningPreviewProjection.emptyTuningPreview());
        private final src.domain.encounter.published.EncounterStateModel stateModel =
                new src.domain.encounter.published.EncounterStateModel(
                state::current,
                state::subscribe);
        private final src.domain.encounter.published.EncounterBuilderInputsModel builderInputsModel =
                new src.domain.encounter.published.EncounterBuilderInputsModel(
                builderInputs::current,
                builderInputs::subscribe);
        private final src.domain.encounter.published.EncounterTuningPreviewModel tuningPreviewModel =
                new src.domain.encounter.published.EncounterTuningPreviewModel(
                tuningPreview::current,
                tuningPreview::subscribe);

        private src.domain.encounter.published.EncounterStateModel stateModel() {
            return stateModel;
        }

        private src.domain.encounter.published.EncounterBuilderInputsModel builderInputsModel() {
            return builderInputsModel;
        }

        private src.domain.encounter.published.EncounterTuningPreviewModel tuningPreviewModel() {
            return tuningPreviewModel;
        }

        @Override
        public void publishCurrentSession(EncounterSessionPublicationData publication) {
            EncounterSessionPublicationData effective = publication == null
                    ? EncounterSessionPublicationData.unavailable(SESSION_NOT_REGISTERED)
                    : publication;
            state.publish(SessionSnapshotProjection.toPublishedSnapshot(
                    effective,
                    SESSION_NOT_REGISTERED));
            builderInputs.publish(BuilderInputsProjection.toPublishedBuilderInputs(
                    effective.builderInputs()));
            tuningPreview.publish(TuningPreviewProjection.toPublishedTuningPreview(
                    effective.tuningPreview()));
        }
    }

    private static final class SessionSnapshotProjection {

        private static EncounterStateSnapshot toPublishedSnapshot(
                EncounterSessionPublicationData publication,
                String sessionNotRegistered
        ) {
            EncounterSessionSnapshotData snapshot = publication.snapshot();
            if (snapshot == null) {
                return EncounterStateSnapshot.empty(publication.unavailableMessage().isBlank()
                        ? sessionNotRegistered
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
            BuilderStateData safeState = builderState == null ? BuilderStateData.empty() : builderState;
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
                    BuilderInputsProjection.toPublishedBuilderSettings(safeState.builderInputs()),
                    safeState.generationAdvisoryMessages(),
                    safeState.savedPlans().stream()
                            .map(PlanProjection::toPublishedSummary)
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
                            .map(removed -> new EncounterStateSnapshot.UndoNotice(
                                    removed.token(),
                                    removed.creature().name()))
                            .orElse(null));
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
    }

    private static final class BuilderInputsProjection {

        private static EncounterBuilderInputs toPublishedBuilderInputs(EncounterGenerationInputs inputs) {
            EncounterGenerationInputs safeInputs = inputs == null ? EncounterGenerationInputs.empty() : inputs;
            EncounterRequestedDifficulty difficulty = safeInputs.targetDifficulty();
            EncounterTuningIntent tuning = safeInputs.tuning();
            return new EncounterBuilderInputs(
                    safeInputs.creatureTypes(),
                    safeInputs.creatureSubtypes(),
                    safeInputs.biomes(),
                    isAutoDifficulty(difficulty),
                    publishedDifficultyLevel(difficulty),
                    isAutoBalance(tuning),
                    publishedBalanceLevel(tuning),
                    isAutoAmount(tuning),
                    publishedAmountValue(tuning),
                    isAutoDiversity(tuning),
                    publishedDiversityLevel(tuning),
                    safeInputs.encounterTableIds());
        }

        private static EncounterStateSnapshot.BuilderSettings toPublishedBuilderSettings(
                EncounterGenerationInputs inputs
        ) {
            EncounterBuilderInputs published = toPublishedBuilderInputs(inputs);
            return new EncounterStateSnapshot.BuilderSettings(
                    published.autoDifficulty() ? "Auto" : difficultyLabel(published.difficultyLevel()),
                    published.autoBalance() ? -1 : published.balanceLevel(),
                    published.autoAmount() ? -1.0 : published.amountValue(),
                    published.autoDiversity() ? -1 : published.diversityLevel());
        }

        private static boolean isAutoDifficulty(EncounterRequestedDifficulty difficulty) {
            return difficulty == null || difficulty.isAuto();
        }

        private static int publishedDifficultyLevel(EncounterRequestedDifficulty difficulty) {
            return difficulty == null
                    ? EncounterRequestedDifficulty.autoDifficulty().publishedDifficultyLevel()
                    : difficulty.publishedDifficultyLevel();
        }

        private static boolean isAutoBalance(EncounterTuningIntent tuning) {
            return tuning == null || tuning.isBalanceAuto();
        }

        private static int publishedBalanceLevel(EncounterTuningIntent tuning) {
            return tuning == null
                    ? EncounterTuningIntent.defaultIntent().publishedBalanceLevel()
                    : tuning.publishedBalanceLevel();
        }

        private static boolean isAutoAmount(EncounterTuningIntent tuning) {
            return tuning == null || tuning.isAmountAuto();
        }

        private static double publishedAmountValue(EncounterTuningIntent tuning) {
            return tuning == null
                    ? EncounterTuningIntent.defaultIntent().publishedAmountValue()
                    : tuning.publishedAmountValue();
        }

        private static boolean isAutoDiversity(EncounterTuningIntent tuning) {
            return tuning == null || tuning.isDiversityAuto();
        }

        private static int publishedDiversityLevel(EncounterTuningIntent tuning) {
            return tuning == null
                    ? EncounterTuningIntent.defaultIntent().publishedDiversityLevel()
                    : tuning.publishedDiversityLevel();
        }

        private static String difficultyLabel(int difficultyLevel) {
            return switch (difficultyLevel) {
                case 1 -> "Easy";
                case 3 -> "Hard";
                case 4 -> "Deadly";
                default -> "Medium";
            };
        }
    }

    private static final class TuningPreviewProjection {

        private static EncounterTuningPreviewResult toPublishedTuningPreview(EncounterTuningPreviewData data) {
            EncounterTuningPreviewData safeData = data == null ? EncounterTuningPreviewData.storageError("") : data;
            return new EncounterTuningPreviewResult(
                    toPublishedStatus(safeData),
                    new EncounterTuningPreviewLabels(
                            safeData.difficultyLabels().stream()
                                    .map(TuningPreviewProjection::toPublishedLabel)
                                    .toList(),
                            safeData.balanceLabels().stream()
                                    .map(TuningPreviewProjection::toPublishedLabel)
                                    .toList(),
                            safeData.amountLabels().stream()
                                    .map(TuningPreviewProjection::toPublishedLabel)
                                    .toList(),
                            safeData.diversityLabels().stream()
                                    .map(TuningPreviewProjection::toPublishedLabel)
                                    .toList()),
                    safeData.message());
        }

        private static EncounterTuningPreviewResult emptyTuningPreview() {
            return new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of()),
                    "");
        }

        private static EncounterGenerationStatus toPublishedStatus(EncounterTuningPreviewData data) {
            if (data.available()) {
                return EncounterGenerationStatus.successStatus();
            }
            if (data.activePartyMissing()) {
                return EncounterGenerationStatus.noActivePartyStatus();
            }
            return EncounterGenerationStatus.defaultFailure();
        }

        private static EncounterTuningPreviewLabels.PreviewLabel toPublishedLabel(
                EncounterTuningPreviewData.PreviewPoint label
        ) {
            return new EncounterTuningPreviewLabels.PreviewLabel(label.value(), label.label());
        }
    }

    private static final class PlanProjection {

        private static src.domain.encounter.published.SavedEncounterPlanSummary toPublishedSummary(
                EncounterPlanSummary summary
        ) {
            if (summary == null) {
                return new src.domain.encounter.published.SavedEncounterPlanSummary(0L, "", "");
            }
            return new src.domain.encounter.published.SavedEncounterPlanSummary(
                    summary.id(),
                    summary.name(),
                    summaryText(summary.generatedLabel(), summary.creatureCount()));
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
    }

    private static final class PublishedStateChannel<T> {

        private static final String LISTENER_PARAMETER = "listener";

        private final List<Consumer<T>> listeners = new ArrayList<>();
        private T current;

        private PublishedStateChannel(T current) {
            this.current = Objects.requireNonNull(current, "current");
        }

        private T current() {
            return current;
        }

        private void publish(T next) {
            current = Objects.requireNonNull(next, "next");
            for (Consumer<T> listener : List.copyOf(listeners)) {
                listener.accept(current);
            }
        }

        private Runnable subscribe(Consumer<T> listener) {
            Consumer<T> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
            listeners.add(safeListener);
            return () -> listeners.remove(safeListener);
        }
    }
}
