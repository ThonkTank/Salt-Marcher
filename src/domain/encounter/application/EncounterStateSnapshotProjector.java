package src.domain.encounter.application;

import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.session.value.EncounterSessionValues.BuilderStateData;
import src.domain.encounter.session.value.EncounterSessionValues.CombatProjectionData;
import src.domain.encounter.session.value.EncounterSessionValues.Mode;
import src.domain.encounter.session.value.EncounterSessionValues.ResultStateData;
import src.domain.encounter.session.value.EncounterSessionValues.Snapshot;

public final class EncounterStateSnapshotProjector {

    private EncounterStateSnapshotProjector() {
    }

    public static EncounterStateSnapshot toPublishedSnapshot(Snapshot snapshot) {
        if (snapshot == null) {
            return EncounterStateSnapshot.empty("");
        }
        return new EncounterStateSnapshot(
                toPublishedMode(snapshot.mode()),
                toPublishedBuilderPane(snapshot.builderState()),
                new EncounterStateSnapshot.InitiativePane(snapshot.initiativeState().entries().stream()
                        .map(entry -> new EncounterStateSnapshot.InitiativeRow(
                                entry.id(),
                                entry.label(),
                                entry.kind().label(),
                                entry.initiative()))
                        .toList()),
                toPublishedCombatPane(snapshot.combatState(), snapshot.missingCombatPartyMembers()),
                toPublishedResolutionPane(snapshot.resultState()),
                snapshot.status());
    }

    public static EncounterBuilderInputs toPublishedBuilderInputs(Snapshot snapshot) {
        Snapshot safeSnapshot = snapshot == null ? new Snapshot(null, null, null, null, null, "", null) : snapshot;
        return EncounterBuilderInputsBoundaryTranslator.toPublished(safeSnapshot.builderState().builderInputs());
    }

    private static EncounterStateSnapshot.Mode toPublishedMode(Mode mode) {
        Mode effective = mode == null ? Mode.BUILDER : mode;
        return switch (effective) {
            case BUILDER -> EncounterStateSnapshot.Mode.BUILDER;
            case INITIATIVE -> EncounterStateSnapshot.Mode.INITIATIVE;
            case COMBAT -> EncounterStateSnapshot.Mode.COMBAT;
            case RESULTS -> EncounterStateSnapshot.Mode.RESULTS;
        };
    }

    private static EncounterStateSnapshot.BuilderPane toPublishedBuilderPane(BuilderStateData builderState) {
        BuilderStateData safeState = builderState == null ? new Snapshot(null, null, null, null, null, "", null).builderState() : builderState;
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
                        .map(plan -> new EncounterStateSnapshot.PlanChoice(
                                plan.id(),
                                plan.name(),
                                plan.generatedLabel(),
                                plan.creatureCount()))
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

    private static EncounterStateSnapshot.BuilderSettings toPublishedBuilderSettings(
            src.domain.encounter.generation.value.EncounterGenerationInputs inputs
    ) {
        EncounterBuilderInputs published = EncounterBuilderInputsBoundaryTranslator.toPublished(inputs);
        return new EncounterStateSnapshot.BuilderSettings(
                published.autoDifficulty() ? "Auto" : difficultyLabel(published.difficultyLevel()),
                published.autoBalance() ? -1 : published.balanceLevel(),
                published.autoAmount() ? -1.0 : published.amountValue(),
                published.autoDiversity() ? -1 : published.diversityLevel());
    }

    private static EncounterStateSnapshot.CombatPane toPublishedCombatPane(
            CombatProjectionData combatState,
            java.util.List<src.domain.encounter.session.value.EncounterSessionValues.PartyMemberData> missingCombatPartyMembers
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
                        ? java.util.List.of()
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
