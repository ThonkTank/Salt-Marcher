package src.domain.encounter.model.session.model;

import src.domain.encounter.model.session.model.EncounterSessionValues.Mode;

final class CombatSessionLifecycleSupport {

    static final String RESULTS_READY_STATUS = "Kampfergebnis bereit.";
    static final String RETURNED_TO_BUILDER_STATUS = "Kampfergebnis geschlossen. Combat Planner bereit.";

    private CombatSessionLifecycleSupport() {
    }

    static void reset(
            CombatRoster combatRoster,
            CombatInitiativeTracker combatInitiative,
            CombatTurnTracker combatTurnTracker,
            CombatResolutionTracker combatResolution
    ) {
        combatRoster.clear();
        combatInitiative.reset();
        combatTurnTracker.reset();
        combatResolution.reset();
    }

    static void endCombat(
            CombatRosterMutation combatRosterMutations,
            CombatRoster combatRoster,
            CombatResolutionTracker combatResolution,
            int activePartySize,
            boolean hasActiveParty,
            EncounterSessionContext context
    ) {
        combatResolution.endCombat(combatRosterMutations, combatRoster, activePartySize, hasActiveParty);
        context.enterMode(Mode.RESULTS, RESULTS_READY_STATUS);
    }

    static void returnToBuilder(
            CombatRoster combatRoster,
            CombatInitiativeTracker combatInitiative,
            CombatTurnTracker combatTurnTracker,
            CombatResolutionTracker combatResolution,
            EncounterSessionContext context
    ) {
        reset(combatRoster, combatInitiative, combatTurnTracker, combatResolution);
        context.enterMode(Mode.BUILDER, RETURNED_TO_BUILDER_STATUS);
    }

    static void mutateHp(
            String combatantId,
            int amount,
            boolean healing,
            CombatRosterMutation combatRosterMutations,
            CombatRoster combatRoster,
            CombatTurn combatTurns,
            CombatTurnTracker combatTurnTracker
    ) {
        if (!combatRosterMutations.mutateHp(
                combatRoster,
                combatTurns.turnEntry(combatRoster.combatants(), combatantId),
                Math.max(0, amount),
                healing)) {
            return;
        }
        combatTurnTracker.restore(combatTurns, combatRoster, combatTurnTracker.activeTurnId(combatTurns, combatRoster));
    }
}
