package src.domain.encounter;

import java.util.List;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterGenerationTuning;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.encounter.session.entity.EncounterSession;

final class EncounterSessionSnapshotMapper {

    private EncounterSessionSnapshotMapper() {
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
                        java.util.Optional.empty())
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
