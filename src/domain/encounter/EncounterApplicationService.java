package src.domain.encounter;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.application.ApplyEncounterSessionUseCase;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.model.session.repository.EncounterSessionRepository;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.application.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.model.generation.helper.EncounterDifficultyMathHelper;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.generation.model.EncounterRequestedDifficulty;
import src.domain.encounter.model.generation.model.EncounterTuningIntent;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.reference.repository.EncounterTableCandidateRepository;
import src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository;
import src.domain.encounter.model.session.repository.EncounterSessionPublishedStateRepository;
import src.domain.encounter.model.session.model.EncounterSession;
import src.domain.encounter.model.session.model.EncounterSessionSnapshotData;
import src.domain.encounter.model.session.model.EncounterSessionValues;
import src.domain.encounter.model.session.model.EncounterSessionValues.BuilderStateData;
import src.domain.encounter.model.session.model.EncounterSessionValues.CombatProjectionData;
import src.domain.encounter.model.session.model.EncounterSessionValues.InitiativeInput;
import src.domain.encounter.model.session.model.EncounterSessionValues.Mode;
import src.domain.encounter.model.session.model.EncounterSessionValues.PartyMemberData;
import src.domain.encounter.model.session.model.EncounterSessionValues.ResultStateData;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;
import src.domain.encounter.model.session.model.EncounterSessionCommand;
import src.domain.encounter.model.plan.model.EncounterPlanSummary;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.SavedEncounterPlanSummary;

/**
 * Public encounter facade that owns command publication and same-context model
 * refresh for the encounter feature.
 */
public final class EncounterApplicationService {

    private static final long INITIAL_PLAN_ID = 0L;

    private final @Nullable ApplyEncounterSessionUseCase applySessionUseCase;
    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;
    private final @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase;
    private final @Nullable LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase;
    private final EncounterSessionPublishedStateRepository sessionPublishedStateRepository;
    private final EncounterPlanPublishedStateRepository planPublishedStateRepository;

    public EncounterApplicationService(
            @Nullable EncounterPartyFactsRepository party,
            @Nullable EncounterCreatureRepository creatures,
            @Nullable EncounterTableCandidateRepository encounterTables,
            @Nullable EncounterPlanRepository encounterPlans,
            EncounterPlanPublishedStateRepository planPublishedStateRepository,
            EncounterSessionPublishedStateRepository sessionPublishedStateRepository
    ) {
        this.loadBudgetUseCase = party == null ? null : new LoadEncounterBudgetUseCase(party);
        SaveEncounterPlanUseCase savePlanUseCase = encounterPlans == null ? null : new SaveEncounterPlanUseCase(encounterPlans);
        LoadSavedEncounterPlanUseCase loadSavedPlanUseCase =
                encounterPlans == null ? null : new LoadSavedEncounterPlanUseCase(encounterPlans);
        this.listSavedPlansUseCase =
                encounterPlans == null ? null : new ListSavedEncounterPlansUseCase(encounterPlans);
        this.loadPlanBudgetUseCase = EncounterUseCaseFactory.createPlanBudgetUseCase(
                party,
                creatures,
                encounterPlans);
        this.applySessionUseCase = EncounterUseCaseFactory.createApplySessionUseCase(
                party,
                creatures,
                encounterTables,
                savePlanUseCase,
                loadSavedPlanUseCase,
                listSavedPlansUseCase,
                loadBudgetUseCase);
        this.planPublishedStateRepository =
                Objects.requireNonNull(planPublishedStateRepository, "planPublishedStateRepository");
        this.sessionPublishedStateRepository =
                Objects.requireNonNull(sessionPublishedStateRepository, "sessionPublishedStateRepository");
        PublishedStateWriter.publishCurrentSession(
                sessionPublishedStateRepository,
                currentSession(),
                loadBudgetUseCase);
        PublishedStateWriter.publishSavedPlans(
                planPublishedStateRepository,
                listSavedPlansUseCase);
        PublishedStateWriter.publishPlanBudget(
                planPublishedStateRepository,
                loadPlanBudgetUseCase,
                INITIAL_PLAN_ID);
    }

    public void applyState(ApplyEncounterStateCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            PublishedStateWriter.publishCurrentSession(
                    sessionPublishedStateRepository,
                    null,
                    loadBudgetUseCase);
            return;
        }
        EncounterSession session = useCase.apply(EncounterStateCommandTranslation.toInternalCommand(command));
        PublishedStateWriter.publishCurrentSession(
                sessionPublishedStateRepository,
                session,
                loadBudgetUseCase);
        if (command == null || command.action().republishesSavedPlans()) {
            PublishedStateWriter.publishSavedPlans(
                    planPublishedStateRepository,
                    listSavedPlansUseCase);
        }
    }

    public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            PublishedStateWriter.publishCurrentSession(
                    sessionPublishedStateRepository,
                    null,
                    loadBudgetUseCase);
            return;
        }
        UpdateEncounterBuilderInputsCommand effective = command == null
                ? new UpdateEncounterBuilderInputsCommand(src.domain.encounter.published.EncounterBuilderInputs.empty())
                : command;
        EncounterSession session = useCase.apply(EncounterSessionCommand.updateBuilderInputs(
                EncounterBuilderInputsTranslation.toInternal(effective.inputs())));
        PublishedStateWriter.publishCurrentSession(
                sessionPublishedStateRepository,
                session,
                loadBudgetUseCase);
    }

    public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
        PublishedStateWriter.publishPlanBudget(
                planPublishedStateRepository,
                loadPlanBudgetUseCase,
                command == null ? 0L : command.planId());
    }

    private @Nullable EncounterSession currentSession() {
        return applySessionUseCase == null ? null : applySessionUseCase.session();
    }

    private static final class EncounterUseCaseFactory {

        private static @Nullable LoadEncounterPlanBudgetUseCase createPlanBudgetUseCase(
                @Nullable EncounterPartyFactsRepository party,
                @Nullable EncounterCreatureRepository creatures,
                @Nullable EncounterPlanRepository encounterPlans
        ) {
            return party == null || creatures == null || encounterPlans == null
                    ? null
                    : new LoadEncounterPlanBudgetUseCase(encounterPlans, party, creatures);
        }

        private static @Nullable ApplyEncounterSessionUseCase createApplySessionUseCase(
                @Nullable EncounterPartyFactsRepository party,
                @Nullable EncounterCreatureRepository creatures,
                @Nullable EncounterTableCandidateRepository encounterTables,
                @Nullable SaveEncounterPlanUseCase savePlanUseCase,
                @Nullable LoadSavedEncounterPlanUseCase loadSavedPlanUseCase,
                @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase,
                @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase
        ) {
            if (party == null || creatures == null) {
                return null;
            }
            EncounterGenerationUseCase generator = new EncounterGenerationUseCase(party, creatures, encounterTables);
            return new ApplyEncounterSessionUseCase(new EncounterSessionRepository(
                    party,
                    creatures,
                    generator,
                    loadBudgetUseCase,
                    savePlanUseCase,
                    loadSavedPlanUseCase,
                    listSavedPlansUseCase));
        }
    }

    private static final class EncounterBudgetTranslation {

        private EncounterBudgetTranslation() {
        }

        private static EncounterTuningPreviewLabels tuningPreviewLabels(EncounterDifficultyMathHelper.BudgetSummary budget) {
            int averageLevel = budget == null ? 1 : Math.max(1, Math.min(20, budget.averagePartyLevel()));
            int partySize = budget == null || budget.activePartyLevels().isEmpty()
                    ? 1
                    : Math.max(1, budget.activePartyLevels().size());
            return new EncounterTuningPreviewLabels(
                    List.of(
                            previewLabel(1.0, difficultyRangeLabel(EncounterRequestedDifficulty.EASY, averageLevel, partySize)),
                            previewLabel(2.0, difficultyRangeLabel(EncounterRequestedDifficulty.MEDIUM, averageLevel, partySize)),
                            previewLabel(3.0, difficultyRangeLabel(EncounterRequestedDifficulty.HARD, averageLevel, partySize)),
                            previewLabel(4.0, difficultyRangeLabel(EncounterRequestedDifficulty.DEADLY, averageLevel, partySize))),
                    List.of(
                            previewLabel(1.0, "Extreme++"),
                            previewLabel(2.0, "Extreme+"),
                            previewLabel(3.0, "Neutral"),
                            previewLabel(4.0, "Durchschnitt+"),
                            previewLabel(5.0, "Durchschnitt++")),
                    List.of(
                            previewLabel(1.0, "Boss++"),
                            previewLabel(2.0, "Boss+"),
                            previewLabel(3.0, "Ausgeglichen"),
                            previewLabel(4.0, "Minions+"),
                            previewLabel(5.0, "Minions++")),
                    List.of(
                            previewLabel(1.0, "1 Typ"),
                            previewLabel(2.0, "2 Typen"),
                            previewLabel(3.0, "3 Typen"),
                            previewLabel(4.0, "4 Typen")));
        }

        private static EncounterTuningPreviewLabels.PreviewLabel previewLabel(double value, String label) {
            return new EncounterTuningPreviewLabels.PreviewLabel(value, label);
        }

        private static String difficultyRangeLabel(EncounterRequestedDifficulty band, int averageLevel, int partySize) {
            DifficultyPreviewRange range = difficultyPreviewRange(band, averageLevel, partySize);
            return range.lowerAdjustedXp() + "-" + range.upperAdjustedXp() + " XP";
        }

        private static DifficultyPreviewRange difficultyPreviewRange(
                EncounterRequestedDifficulty band,
                int averageLevel,
                int partySize
        ) {
            EncounterDifficultyMathHelper.Thresholds thresholds = thresholdsForAverageParty(averageLevel, partySize);
            int deadly125 = (int) Math.round(thresholds.deadly() * 1.25);
            EncounterRequestedDifficulty effectiveBand = band == null ? EncounterRequestedDifficulty.MEDIUM : band;
            if (effectiveBand == EncounterRequestedDifficulty.EASY) {
                return new DifficultyPreviewRange(
                        thresholds.easy(),
                        Math.max(thresholds.easy(), thresholds.medium() - 1));
            }
            if (effectiveBand == EncounterRequestedDifficulty.HARD) {
                return new DifficultyPreviewRange(
                        thresholds.hard(),
                        Math.max(thresholds.hard(), thresholds.deadly() - 1));
            }
            if (effectiveBand == EncounterRequestedDifficulty.DEADLY) {
                return new DifficultyPreviewRange(
                        thresholds.deadly(),
                        Math.max(thresholds.deadly(), deadly125));
            }
            return new DifficultyPreviewRange(
                    thresholds.medium(),
                    Math.max(thresholds.medium(), thresholds.hard() - 1));
        }

        private static EncounterDifficultyMathHelper.Thresholds thresholdsForAverageParty(int averageLevel, int partySize) {
            int level = Math.max(1, Math.min(20, averageLevel));
            int size = Math.max(1, partySize);
            List<Integer> partyLevels = new java.util.ArrayList<>(size);
            for (int index = 0; index < size; index++) {
                partyLevels.add(level);
            }
            return EncounterDifficultyMathHelper.thresholdsFor(partyLevels);
        }

        private record DifficultyPreviewRange(int lowerAdjustedXp, int upperAdjustedXp) {
        }
    }

    private static final class EncounterBuilderInputsTranslation {

        private EncounterBuilderInputsTranslation() {
        }

        private static EncounterGenerationInputs toInternal(EncounterBuilderInputs inputs) {
            EncounterBuilderInputs safeInputs = inputs == null ? EncounterBuilderInputs.empty() : inputs;
            return new EncounterGenerationInputs(
                    safeInputs.creatureTypes(),
                    safeInputs.creatureSubtypes(),
                    safeInputs.biomes(),
                    EncounterRequestedDifficulty.fromPublishedDifficulty(
                            safeInputs.autoDifficulty(),
                            safeInputs.difficultyLevel()),
                    EncounterTuningIntent.fromPublishedValues(
                            safeInputs.autoBalance(),
                            safeInputs.balanceLevel(),
                            safeInputs.autoAmount(),
                            safeInputs.amountValue(),
                            safeInputs.autoDiversity(),
                            safeInputs.diversityLevel()),
                    safeInputs.encounterTableIds());
        }

        private static EncounterBuilderInputs toPublished(EncounterGenerationInputs inputs) {
            EncounterGenerationInputs safeInputs = inputs == null ? EncounterGenerationInputs.empty() : inputs;
            EncounterRequestedDifficulty difficulty = safeInputs.targetDifficulty();
            EncounterTuningIntent tuning = safeInputs.tuning();
            return new EncounterBuilderInputs(
                    safeInputs.creatureTypes(),
                    safeInputs.creatureSubtypes(),
                    safeInputs.biomes(),
                    isAutoDifficulty(difficulty),
                    difficulty == null
                            ? EncounterRequestedDifficulty.autoDifficulty().publishedDifficultyLevel()
                            : difficulty.publishedDifficultyLevel(),
                    isAutoBalance(tuning),
                    tuning == null ? EncounterTuningIntent.defaultIntent().publishedBalanceLevel() : tuning.publishedBalanceLevel(),
                    isAutoAmount(tuning),
                    tuning == null ? EncounterTuningIntent.defaultIntent().publishedAmountValue() : tuning.publishedAmountValue(),
                    isAutoDiversity(tuning),
                    tuning == null
                            ? EncounterTuningIntent.defaultIntent().publishedDiversityLevel()
                            : tuning.publishedDiversityLevel(),
                    safeInputs.encounterTableIds());
        }

        private static boolean isAutoDifficulty(EncounterRequestedDifficulty difficulty) {
            return difficulty == null || difficulty.isAuto();
        }

        private static boolean isAutoBalance(EncounterTuningIntent tuning) {
            return tuning == null || tuning.isBalanceAuto();
        }

        private static boolean isAutoAmount(EncounterTuningIntent tuning) {
            return tuning == null || tuning.isAmountAuto();
        }

        private static boolean isAutoDiversity(EncounterTuningIntent tuning) {
            return tuning == null || tuning.isDiversityAuto();
        }
    }

    private static final class EncounterPlanTranslation {

        private static final String CREATURES_SUFFIX = " Kreaturen";

        private EncounterPlanTranslation() {
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

        private static String summaryText(String generatedLabel, int creatureCount) {
            StringBuilder text = new StringBuilder()
                    .append(Math.max(0, creatureCount))
                    .append(CREATURES_SUFFIX);
            String safeGeneratedLabel = generatedLabel == null ? "" : generatedLabel.trim();
            if (!safeGeneratedLabel.isBlank()) {
                text.append(" · ").append(safeGeneratedLabel);
            }
            return text.toString();
        }
    }

    private static final class EncounterStateCommandTranslation {

        private EncounterStateCommandTranslation() {
        }

        private static EncounterSessionCommand toInternalCommand(@Nullable ApplyEncounterStateCommand command) {
            if (command == null) {
                return EncounterSessionCommand.refresh();
            }
            return new EncounterSessionCommand(
                    toInternalAction(command.action()),
                    Optional.empty(),
                    EncounterBuilderInputsTranslation.toInternal(null),
                    command.creatureId(),
                    command.planId(),
                    command.delta(),
                    command.undoToken(),
                    toInternalInitiatives(command.initiativeValues()),
                    command.combatantId(),
                    command.initiative(),
                    command.partyMemberId(),
                    command.amount(),
                    command.healing());
        }

        private static EncounterSessionCommand.Action toInternalAction(ApplyEncounterStateCommand.Action action) {
            ApplyEncounterStateCommand.Action effective = action == null
                    ? ApplyEncounterStateCommand.Action.REFRESH
                    : action;
            return EncounterSessionCommand.Action.valueOf(effective.name());
        }

        private static List<InitiativeInput> toInternalInitiatives(List<ApplyEncounterStateCommand.InitiativeValue> values) {
            if (values == null) {
                return List.of();
            }
            return values.stream()
                    .map(value -> new InitiativeInput(value.id(), value.initiative()))
                    .toList();
        }
    }

    private static final class EncounterStateSnapshotPublication {

        private EncounterStateSnapshotPublication() {
        }

        private static EncounterStateSnapshot toPublishedSnapshot(EncounterSession session) {
            if (session == null) {
                return EncounterStateSnapshot.empty("");
            }
            EncounterSessionSnapshotData snapshot = session.snapshot();
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

        private static EncounterBuilderInputs toPublishedBuilderInputs(EncounterSession session) {
            return session == null
                    ? EncounterBuilderInputs.empty()
                    : EncounterBuilderInputsTranslation.toPublished(session.builderInputs());
        }

        private static EncounterStateSnapshot.Mode toPublishedMode(int mode) {
            int effective = mode;
            return switch (effective) {
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
                            .map(EncounterPlanTranslation::toPublishedSummary)
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
            EncounterBuilderInputs published = EncounterBuilderInputsTranslation.toPublished(inputs);
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
    }

    private static final class PublishedStateWriter {

        private static final String TUNING_PREVIEW_LOAD_FAILED = "Encounter tuning preview could not be loaded.";
        private static final String TUNING_PREVIEW_NOT_REGISTERED = "Encounter tuning preview service is not registered.";
        private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";
        private static final String PLAN_BUDGET_LOAD_FAILED = "Encounter plan budget could not be loaded.";
        private static final String PLAN_BUDGET_NOT_REGISTERED = "Encounter plan budget service is not registered.";

        private static void publishCurrentSession(
                EncounterSessionPublishedStateRepository repository,
                @Nullable EncounterSession session,
                @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase
        ) {
            repository.publishCurrentSession(
                    session == null ? src.domain.encounter.published.EncounterStateSnapshot.empty("Encounter session is not registered.")
                            : EncounterStateSnapshotPublication.toPublishedSnapshot(session),
                    session == null ? EncounterBuilderInputs.empty()
                            : EncounterStateSnapshotPublication.toPublishedBuilderInputs(session),
                    toTuningPreviewResult(loadBudgetResult(loadBudgetUseCase)));
        }

        private static void publishSavedPlans(
                EncounterPlanPublishedStateRepository repository,
                @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase
        ) {
            repository.publishSavedPlans(
                    listSavedPlansUseCase == null
                            ? new src.domain.encounter.published.SavedEncounterPlanListResult(
                                    src.domain.encounter.published.SavedEncounterPlanStatus.storageErrorStatus(),
                                    List.of(),
                                    PLAN_STORAGE_NOT_REGISTERED)
                            : toSavedPlansResult(listSavedPlansUseCase.execute()));
        }

        private static void publishPlanBudget(
                EncounterPlanPublishedStateRepository repository,
                @Nullable LoadEncounterPlanBudgetUseCase useCase,
                long planId
        ) {
            if (useCase == null) {
                repository.publishPlanBudget(new src.domain.encounter.published.EncounterPlanBudgetResult(
                        src.domain.encounter.published.EncounterPlanBudgetStatus.STORAGE_ERROR,
                        null,
                        PLAN_BUDGET_NOT_REGISTERED));
                return;
            }
            try {
                repository.publishPlanBudget(toPlanBudgetResult(useCase.execute(planId)));
            } catch (IllegalStateException exception) {
                repository.publishPlanBudget(new src.domain.encounter.published.EncounterPlanBudgetResult(
                        src.domain.encounter.published.EncounterPlanBudgetStatus.STORAGE_ERROR,
                        null,
                        PLAN_BUDGET_LOAD_FAILED));
            }
        }

        private static LoadEncounterBudgetUseCase.Result loadBudgetResult(
                @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase
        ) {
            if (loadBudgetUseCase == null) {
                return new LoadEncounterBudgetUseCase.Result(
                        EncounterPartyFactsRepository.Status.STORAGE_ERROR,
                        emptyBudgetSummary(),
                        TUNING_PREVIEW_NOT_REGISTERED);
            }
            try {
                return loadBudgetUseCase.execute();
            } catch (IllegalStateException exception) {
                return new LoadEncounterBudgetUseCase.Result(
                        EncounterPartyFactsRepository.Status.STORAGE_ERROR,
                        emptyBudgetSummary(),
                        TUNING_PREVIEW_LOAD_FAILED);
            }
        }

        private static src.domain.encounter.published.SavedEncounterPlanListResult toSavedPlansResult(
                ListSavedEncounterPlansUseCase.Result result
        ) {
            if (result == null) {
                return new src.domain.encounter.published.SavedEncounterPlanListResult(
                        src.domain.encounter.published.SavedEncounterPlanStatus.STORAGE_ERROR,
                        List.of(),
                        PLAN_STORAGE_NOT_REGISTERED);
            }
            return new src.domain.encounter.published.SavedEncounterPlanListResult(
                    result.status().loadedSuccessfully()
                            ? src.domain.encounter.published.SavedEncounterPlanStatus.successStatus()
                            : src.domain.encounter.published.SavedEncounterPlanStatus.storageErrorStatus(),
                    result.plans().stream().map(EncounterPlanTranslation::toPublishedSummary).toList(),
                    result.message());
        }

        private static src.domain.encounter.published.EncounterPlanBudgetResult toPlanBudgetResult(
                LoadEncounterPlanBudgetUseCase.Result result
        ) {
            if (result == null) {
                return new src.domain.encounter.published.EncounterPlanBudgetResult(
                        src.domain.encounter.published.EncounterPlanBudgetStatus.STORAGE_ERROR,
                        null,
                        PLAN_BUDGET_NOT_REGISTERED);
            }
            LoadEncounterPlanBudgetUseCase.PlanBudgetSummary summary = result.summary();
            return new src.domain.encounter.published.EncounterPlanBudgetResult(
                    src.domain.encounter.published.EncounterPlanBudgetStatus.valueOf(result.status().name()),
                    summary == null
                            ? null
                            : new src.domain.encounter.published.EncounterPlanBudgetSummary(
                                    summary.planId(),
                                    summary.name(),
                                    summary.generatedLabel(),
                                    summary.creatureCount(),
                                    summary.totalBaseXp(),
                                    summary.adjustedXp(),
                                    summary.xpMultiplier(),
                                    summary.difficultyLabel()),
                    result.message());
        }

        private static src.domain.encounter.published.EncounterTuningPreviewResult toTuningPreviewResult(
                LoadEncounterBudgetUseCase.Result result
        ) {
            if (result == null) {
                return new src.domain.encounter.published.EncounterTuningPreviewResult(
                        src.domain.encounter.published.EncounterGenerationStatus.STORAGE_ERROR,
                        EncounterBudgetTranslation.tuningPreviewLabels(emptyBudgetSummary()),
                        TUNING_PREVIEW_NOT_REGISTERED);
            }
            return new src.domain.encounter.published.EncounterTuningPreviewResult(
                    toEncounterGenerationStatus(result.status()),
                    EncounterBudgetTranslation.tuningPreviewLabels(
                            result.budget() == null ? emptyBudgetSummary() : result.budget()),
                    result.message());
        }

        private static src.domain.encounter.published.EncounterGenerationStatus toEncounterGenerationStatus(
                EncounterPartyFactsRepository.Status status
        ) {
            if (status == null) {
                return src.domain.encounter.published.EncounterGenerationStatus.STORAGE_ERROR;
            }
            return switch (status) {
                case SUCCESS -> src.domain.encounter.published.EncounterGenerationStatus.successStatus();
                case NO_ACTIVE_PARTY -> src.domain.encounter.published.EncounterGenerationStatus.noActivePartyStatus();
                case STORAGE_ERROR -> src.domain.encounter.published.EncounterGenerationStatus.defaultFailure();
            };
        }

        private static EncounterDifficultyMathHelper.BudgetSummary emptyBudgetSummary() {
            return new EncounterDifficultyMathHelper.BudgetSummary(List.of(), 1, 0, 0, 0, 0, 0, 0, 0);
        }
    }
}
