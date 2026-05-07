package src.view.statetabs.encounter;

import src.domain.encounter.published.EncounterStateSnapshot;

final class EncounterStateProjectionMapper {

    private EncounterStateProjectionMapper() {
    }

    static EncounterStateContributionModel.Mode toMode(EncounterStateSnapshot.Mode source) {
        EncounterStateSnapshot.Mode effective = source == null ? EncounterStateSnapshot.Mode.BUILDER : source;
        return EncounterStateContributionModel.Mode.valueOf(effective.name());
    }

    static EncounterStateContributionModel.BuilderState toBuilderState(
            EncounterStateSnapshot.BuilderPane source,
            String statusMessage
    ) {
        EncounterStateSnapshot.BuilderPane safeSource = source == null
                ? EncounterStateSnapshot.BuilderPane.empty()
                : source;
        EncounterStateSnapshot.ThresholdMeter difficulty = safeSource.thresholds();
        return new EncounterStateContributionModel.BuilderState(
                safeSource.partySummary(),
                safeSource.templateTitle(),
                new EncounterStateContributionModel.DifficultySummary(
                        difficulty.easyThreshold(),
                        difficulty.mediumThreshold(),
                        difficulty.hardThreshold(),
                        difficulty.deadlyThreshold(),
                        difficulty.adjustedXp(),
                        difficulty.difficultyLabel()),
                statusMessage,
                safeSource.generationHints(),
                safeSource.savedPlanChoices().stream()
                        .map(EncounterStateProjectionMapper::toSavedPlan)
                        .toList(),
                toBuilderSettings(safeSource.currentSettings()),
                safeSource.rosterCards().stream()
                        .map(EncounterStateProjectionMapper::toRosterCard)
                        .toList(),
                safeSource.rosterEmpty(),
                safeSource.startCombatEnabled(),
                safeSource.previousAlternativeEnabled(),
                safeSource.nextAlternativeEnabled(),
                safeSource.savePlanEnabled(),
                safeSource.clearHistoryEnabled(),
                safeSource.undoNotice() == null
                        ? null
                        : new EncounterStateContributionModel.UndoRemoveView(
                                safeSource.undoNotice().undoToken(),
                                safeSource.undoNotice().creatureName()));
    }

    static EncounterStateContributionModel.InitiativeStateView toInitiativeState(
            EncounterStateSnapshot.InitiativePane source
    ) {
        EncounterStateSnapshot.InitiativePane safeSource = source == null
                ? EncounterStateSnapshot.InitiativePane.empty()
                : source;
        return new EncounterStateContributionModel.InitiativeStateView(safeSource.rows().stream()
                .map(entry -> new EncounterStateContributionModel.InitiativeEntryView(
                        entry.combatantId(),
                        entry.displayLabel(),
                        entry.kindLabel(),
                        entry.initiativeValue()))
                .toList());
    }

    static EncounterStateContributionModel.CombatStateView toCombatState(
            EncounterStateSnapshot.CombatPane source
    ) {
        EncounterStateSnapshot.CombatPane safeSource = source == null
                ? EncounterStateSnapshot.CombatPane.empty()
                : source;
        return new EncounterStateContributionModel.CombatStateView(
                safeSource.roundIndex(),
                safeSource.combatStatus(),
                safeSource.combatCards().stream()
                        .map(card -> new EncounterStateContributionModel.CombatCardView(
                                card.combatantId(),
                                card.displayName(),
                                card.playerCharacter(),
                                card.activeTurn(),
                                card.alive(),
                                card.currentHp(),
                                card.maxHp(),
                                card.armorClass(),
                                card.initiativeValue(),
                                card.count(),
                                card.detailText()))
                        .toList(),
                safeSource.allEnemiesDefeated(),
                safeSource.addablePartyMembers().stream()
                        .map(member -> new EncounterStateContributionModel.PartyMemberCandidate(
                                member.partyMemberId(),
                                member.displayName(),
                                member.level()))
                        .toList());
    }

    static EncounterStateContributionModel.ResultStateView toResultState(
            EncounterStateSnapshot.ResolutionPane source
    ) {
        EncounterStateSnapshot.ResolutionPane safeSource = source == null
                ? EncounterStateSnapshot.ResolutionPane.empty()
                : source;
        return new EncounterStateContributionModel.ResultStateView(
                safeSource.enemyResults().stream()
                        .map(enemy -> new EncounterStateContributionModel.ResultEnemyView(
                                enemy.displayName(),
                                enemy.statusLabel(),
                                enemy.hpLoss(),
                                enemy.xp(),
                                enemy.defeatedByDefault(),
                                enemy.loot()))
                        .toList(),
                safeSource.defeatedCount(),
                safeSource.eligibleXp(),
                safeSource.perPlayerXp(),
                safeSource.goldSummary(),
                safeSource.lootDetail(),
                safeSource.awardStatus(),
                safeSource.xpAwarded(),
                safeSource.canAwardXp(),
                safeSource.partySize());
    }

    private static EncounterStateContributionModel.SavedEncounterPlanView toSavedPlan(EncounterStateSnapshot.PlanChoice plan) {
        return new EncounterStateContributionModel.SavedEncounterPlanView(
                plan.planId(),
                plan.displayName(),
                plan.generatedName(),
                plan.totalCreatureCount());
    }

    private static EncounterStateContributionModel.RosterCardView toRosterCard(EncounterStateSnapshot.RosterCard creature) {
        return new EncounterStateContributionModel.RosterCardView(
                creature.creatureId(),
                creature.displayName(),
                creature.challengeRating(),
                creature.xpTotal(),
                creature.armorClass(),
                creature.creatureType(),
                creature.encounterRole(),
                creature.count());
    }

    private static EncounterStateContributionModel.BuilderSettings toBuilderSettings(
            EncounterStateSnapshot.BuilderSettings builderInputs
    ) {
        EncounterStateSnapshot.BuilderSettings safeInputs = builderInputs == null
                ? EncounterStateSnapshot.BuilderSettings.defaultSettings()
                : builderInputs;
        return new EncounterStateContributionModel.BuilderSettings(
                safeInputs.difficultyLabel(),
                safeInputs.balanceLevel(),
                safeInputs.amountValue(),
                safeInputs.diversityLevel());
    }
}
