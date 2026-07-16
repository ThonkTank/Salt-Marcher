package src.domain.encounter;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.EncounterBudgetSummary;
import src.domain.encounter.model.generation.EncounterGenerationInputs;
import src.domain.encounter.model.generation.EncounterDifficultyThresholds;
import src.domain.encounter.model.generation.EncounterRequestedDifficulty;
import src.domain.encounter.model.generation.EncounterTuningIntent;
import src.domain.encounter.model.generation.helper.EncounterDifficultyMathHelper;
import src.domain.encounter.model.plan.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.EncounterPlanBudgetSummaryData;
import src.domain.encounter.model.plan.EncounterPlanSummary;
import src.domain.encounter.model.plan.SavedEncounterPlansLoadResult;
import src.domain.encounter.model.session.BuilderStateData;
import src.domain.encounter.model.session.CombatProjectionData;
import src.domain.encounter.model.session.EncounterSessionPublicationData;
import src.domain.encounter.model.session.EncounterSessionSnapshotData;
import src.domain.encounter.model.session.EncounterTuningPreviewData;
import src.domain.encounter.model.session.Mode;
import src.domain.encounter.model.session.PartyMemberData;
import src.domain.encounter.model.session.ResultStateData;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterPlanBudgetSummary;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;

final class EncounterProjection {

    private EncounterProjection() {
    }

    static EncounterStateSnapshot stateSnapshot(
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
                mode(snapshot.mode()),
                builderPane(builderState),
                new EncounterStateSnapshot.InitiativePane(snapshot.initiativeEntries().stream()
                        .map(entry -> new EncounterStateSnapshot.InitiativeRow(
                                entry.id(),
                                entry.label(),
                                entry.kind().label(),
                                entry.initiative()))
                        .toList()),
                combatPane(combatState, snapshot.missingCombatPartyMembers()),
                resolutionPane(snapshot.resultState()),
                snapshot.status());
    }

    static EncounterBuilderInputs builderInputs(EncounterGenerationInputs inputs) {
        EncounterGenerationInputs safeInputs = inputs == null ? EncounterGenerationInputs.empty() : inputs;
        EncounterRequestedDifficulty difficulty = safeInputs.targetDifficulty();
        EncounterTuningIntent tuning = safeInputs.tuning();
        EncounterRequestedDifficulty safeDifficulty =
                difficulty == null ? EncounterRequestedDifficulty.autoDifficulty() : difficulty;
        EncounterTuningIntent safeTuning = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        return new EncounterBuilderInputs(
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                difficulty == null || difficulty.isAuto(),
                safeDifficulty.publishedDifficultyLevel(),
                tuning == null || tuning.isBalanceAuto(),
                safeTuning.publishedBalanceLevel(),
                tuning == null || tuning.isAmountAuto(),
                safeTuning.publishedAmountValue(),
                tuning == null || tuning.isDiversityAuto(),
                safeTuning.publishedDiversityLevel(),
                safeInputs.encounterTableIds(),
                safeInputs.worldFactionIds(),
                safeInputs.worldLocationId());
    }

    static EncounterTuningPreviewResult tuningPreview(EncounterTuningPreviewData data) {
        EncounterTuningPreviewData safeData = data == null ? EncounterTuningPreviewData.storageError("") : data;
        return new EncounterTuningPreviewResult(
                tuningPreviewStatus(safeData),
                new EncounterTuningPreviewLabels(
                        safeData.difficultyLabels().stream().map(EncounterProjection::previewLabel).toList(),
                        safeData.balanceLabels().stream().map(EncounterProjection::previewLabel).toList(),
                        safeData.amountLabels().stream().map(EncounterProjection::previewLabel).toList(),
                        safeData.diversityLabels().stream().map(EncounterProjection::previewLabel).toList()),
                safeData.message());
    }

    static EncounterTuningPreviewResult emptyTuningPreview() {
        return new EncounterTuningPreviewResult(
                EncounterGenerationStatus.STORAGE_ERROR,
                new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of()),
                "");
    }

    static SavedEncounterPlanListResult savedPlans(SavedEncounterPlansLoadResult result) {
        return new SavedEncounterPlanListResult(
                result.loadedSuccessfully() ? SavedEncounterPlanStatus.SUCCESS : SavedEncounterPlanStatus.STORAGE_ERROR,
                result.plans().stream().map(EncounterProjection::savedPlanSummary).toList(),
                result.message());
    }

    static SavedEncounterPlanListResult storageUnavailableSavedPlans(String message) {
        return new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), message);
    }

    static SavedEncounterPlanListResult emptySavedPlans() {
        return new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), "");
    }

    static EncounterPlanBudgetResult planBudget(EncounterPlanBudgetLoadResult result) {
        return new EncounterPlanBudgetResult(planBudgetStatus(result), planBudgetSummary(result.summary()), result.message());
    }

    static EncounterPlanBudgetResult budgetUnavailable(String message) {
        return new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.STORAGE_ERROR, null, message);
    }

    static EncounterPlanBudgetResult emptyPlanBudget() {
        return new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.STORAGE_ERROR, null, "");
    }

    static EncounterTuningPreviewData tuningPreviewData(EncounterPlanGateway.BudgetResult result) {
        if (result == null) {
            EncounterTuningPreviewData labels = tuningPreviewLabels(emptyBudgetSummary());
            return EncounterTuningPreviewData.storageError(
                    labels.difficultyLabels(),
                    labels.balanceLabels(),
                    labels.amountLabels(),
                    labels.diversityLabels(),
                    "Encounter tuning preview service is not registered.");
        }
        EncounterTuningPreviewData labels = tuningPreviewLabels(
                result.budget() == null ? emptyBudgetSummary() : result.budget());
        return tuningPreviewData(result.status(), labels, result.message());
    }

    private static EncounterStateSnapshot.Mode mode(int mode) {
        return switch (mode) {
            case Mode.INITIATIVE -> EncounterStateSnapshot.Mode.INITIATIVE;
            case Mode.COMBAT -> EncounterStateSnapshot.Mode.COMBAT;
            case Mode.RESULTS -> EncounterStateSnapshot.Mode.RESULTS;
            default -> EncounterStateSnapshot.Mode.BUILDER;
        };
    }

    private static EncounterStateSnapshot.BuilderPane builderPane(BuilderStateData builderState) {
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
                builderSettings(safeState.builderInputs()),
                safeState.generationAdvisoryMessages(),
                safeState.roster().stream()
                        .map(creature -> new EncounterStateSnapshot.RosterCard(
                                creature.creatureId(),
                                creature.worldNpcId(),
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
                safeState.hasUnsavedRosterChanges(),
                safeState.canClearGenerationHistory(),
                safeState.pendingUndo()
                        .map(removed -> new EncounterStateSnapshot.UndoNotice(
                                removed.token(),
                                removed.creature().name()))
                        .orElse(null));
    }

    private static EncounterStateSnapshot.BuilderSettings builderSettings(
            src.domain.encounter.model.generation.EncounterGenerationInputs inputs
    ) {
        EncounterBuilderInputs published = builderInputs(inputs);
        return new EncounterStateSnapshot.BuilderSettings(
                published.autoDifficulty() ? "Auto" : difficultyLabel(published.difficultyLevel()),
                published.autoBalance() ? -1 : published.balanceLevel(),
                published.autoAmount() ? -1.0 : published.amountValue(),
                published.autoDiversity() ? -1 : published.diversityLevel());
    }

    private static EncounterStateSnapshot.CombatPane combatPane(
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
                                card.worldNpcId(),
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

    private static EncounterStateSnapshot.ResolutionPane resolutionPane(ResultStateData resultState) {
        ResultStateData safeState = resultState == null ? ResultStateData.empty() : resultState;
        return new EncounterStateSnapshot.ResolutionPane(
                safeState.enemies().stream()
                        .map(enemy -> new EncounterStateSnapshot.ResultEnemy(
                                enemy.name(),
                                enemy.creatureId(),
                                enemy.worldNpcId(),
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

    private static EncounterGenerationStatus tuningPreviewStatus(EncounterTuningPreviewData data) {
        if (data.available()) {
            return EncounterGenerationStatus.successStatus();
        }
        if (data.activePartyMissing()) {
            return EncounterGenerationStatus.noActivePartyStatus();
        }
        return EncounterGenerationStatus.defaultFailure();
    }

    private static EncounterTuningPreviewLabels.PreviewLabel previewLabel(
            EncounterTuningPreviewData.PreviewPoint label
    ) {
        return new EncounterTuningPreviewLabels.PreviewLabel(label.value(), label.label());
    }

    private static SavedEncounterPlanSummary savedPlanSummary(EncounterPlanSummary summary) {
        if (summary == null) {
            return new SavedEncounterPlanSummary(0L, "", "");
        }
        return new SavedEncounterPlanSummary(summary.id(), summary.name(), summaryText(
                summary.generatedLabel(),
                summary.creatureCount()));
    }

    private static EncounterPlanBudgetStatus planBudgetStatus(EncounterPlanBudgetLoadResult result) {
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

    private static @Nullable EncounterPlanBudgetSummary planBudgetSummary(
            @Nullable EncounterPlanBudgetSummaryData summary
    ) {
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

    private static EncounterTuningPreviewData tuningPreviewData(
            src.domain.encounter.model.session.PartyBudgetFacts.Status status,
            EncounterTuningPreviewData labels,
            String message
    ) {
        if (status == null) {
            return EncounterTuningPreviewData.storageError(
                    labels.difficultyLabels(),
                    labels.balanceLabels(),
                    labels.amountLabels(),
                    labels.diversityLabels(),
                    message);
        }
        return switch (status) {
            case SUCCESS -> EncounterTuningPreviewData.available(
                    labels.difficultyLabels(),
                    labels.balanceLabels(),
                    labels.amountLabels(),
                    labels.diversityLabels(),
                    message);
            case NO_ACTIVE_PARTY -> EncounterTuningPreviewData.noActiveParty(
                    labels.difficultyLabels(),
                    labels.balanceLabels(),
                    labels.amountLabels(),
                    labels.diversityLabels(),
                    message);
            case STORAGE_ERROR -> EncounterTuningPreviewData.storageError(
                    labels.difficultyLabels(),
                    labels.balanceLabels(),
                    labels.amountLabels(),
                    labels.diversityLabels(),
                    message);
        };
    }

    private static EncounterTuningPreviewData tuningPreviewLabels(EncounterBudgetSummary budget) {
        int averageLevel = budget == null ? 1 : Math.max(1, Math.min(20, budget.averagePartyLevel()));
        int partySize = budget == null || budget.activePartyLevels().isEmpty()
                ? 1
                : Math.max(1, budget.activePartyLevels().size());
        return EncounterTuningPreviewData.available(
                List.of(
                        previewPoint(1.0, difficultyRangeLabel(EncounterRequestedDifficulty.EASY, averageLevel, partySize)),
                        previewPoint(2.0, difficultyRangeLabel(EncounterRequestedDifficulty.MEDIUM, averageLevel, partySize)),
                        previewPoint(3.0, difficultyRangeLabel(EncounterRequestedDifficulty.HARD, averageLevel, partySize)),
                        previewPoint(4.0, difficultyRangeLabel(EncounterRequestedDifficulty.DEADLY, averageLevel, partySize))),
                List.of(
                        previewPoint(1.0, "Extreme++"),
                        previewPoint(2.0, "Extreme+"),
                        previewPoint(3.0, "Neutral"),
                        previewPoint(4.0, "Durchschnitt+"),
                        previewPoint(5.0, "Durchschnitt++")),
                List.of(
                        previewPoint(1.0, "Boss++"),
                        previewPoint(2.0, "Boss+"),
                        previewPoint(3.0, "Ausgeglichen"),
                        previewPoint(4.0, "Minions+"),
                        previewPoint(5.0, "Minions++")),
                List.of(
                        previewPoint(1.0, "1 Typ"),
                        previewPoint(2.0, "2 Typen"),
                        previewPoint(3.0, "3 Typen"),
                        previewPoint(4.0, "4 Typen")),
                "");
    }

    private static EncounterTuningPreviewData.PreviewPoint previewPoint(double value, String label) {
        return new EncounterTuningPreviewData.PreviewPoint(value, label);
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
        EncounterDifficultyThresholds thresholds = thresholdsForAverageParty(averageLevel, partySize);
        int deadly125 = (int) Math.round(thresholds.deadly() * 1.25);
        EncounterRequestedDifficulty effectiveBand = band == null ? EncounterRequestedDifficulty.MEDIUM : band;
        if (effectiveBand == EncounterRequestedDifficulty.EASY) {
            return new DifficultyPreviewRange(thresholds.easy(), Math.max(thresholds.easy(), thresholds.medium() - 1));
        }
        if (effectiveBand == EncounterRequestedDifficulty.HARD) {
            return new DifficultyPreviewRange(thresholds.hard(), Math.max(thresholds.hard(), thresholds.deadly() - 1));
        }
        if (effectiveBand == EncounterRequestedDifficulty.DEADLY) {
            return new DifficultyPreviewRange(thresholds.deadly(), Math.max(thresholds.deadly(), deadly125));
        }
        return new DifficultyPreviewRange(thresholds.medium(), Math.max(thresholds.medium(), thresholds.hard() - 1));
    }

    private static EncounterDifficultyThresholds thresholdsForAverageParty(int averageLevel, int partySize) {
        int level = Math.max(1, Math.min(20, averageLevel));
        int size = Math.max(1, partySize);
        List<Integer> partyLevels = new java.util.ArrayList<>(size);
        for (int index = 0; index < size; index++) {
            partyLevels.add(Integer.valueOf(level));
        }
        return EncounterDifficultyMathHelper.thresholdsFor(partyLevels);
    }

    private static EncounterBudgetSummary emptyBudgetSummary() {
        return new EncounterBudgetSummary(List.of(), 1, 0, 0, 0, 0, 0, 0, 0);
    }

    private static String partySummary(BuilderStateData state) {
        if (state.party().isEmpty()) {
            return "Party: 0";
        }
        long averageLevel = Math.round(state.party().stream()
                .mapToInt(PartyMemberData::level)
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
        StringBuilder text = new StringBuilder().append(Math.max(0, creatureCount)).append(" Kreaturen");
        String safeGeneratedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        if (!safeGeneratedLabel.isBlank()) {
            text.append(" · ").append(safeGeneratedLabel);
        }
        return text.toString();
    }

    private record DifficultyPreviewRange(int lowerAdjustedXp, int upperAdjustedXp) {
    }
}
