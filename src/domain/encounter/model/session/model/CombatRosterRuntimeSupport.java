package src.domain.encounter.model.session.model;

import static src.domain.encounter.model.session.model.EncounterSessionValues.*;

import java.util.List;
import src.domain.encounter.model.session.model.EncounterSessionValues.Mode;

final class CombatRosterRuntimeSupport {

    private static final String PARTY_MEMBER_LOAD_FAILURE_STATUS = "SC konnte nicht geladen werden.";
    private static final String REINFORCEMENT_CREATURE_ROLE = "Reinforcement";

    private CombatRosterRuntimeSupport() {
    }

    static void addPartyMemberToCombat(
            long partyMemberId,
            int initiative,
            List<PartyMemberData> activeParty,
            EncounterSessionContext context,
            CombatRoster combatRoster,
            CombatRosterBuilder combatRosterBuilder,
            CombatTurnTracker combatTurnTracker,
            CombatTurn combatTurns
    ) {
        if (context.mode() != Mode.COMBAT) {
            return;
        }
        PartyMemberData member = CombatSessionSupport.partyMember(activeParty, partyMemberId).orElse(null);
        if (member == null) {
            context.setStatus(PARTY_MEMBER_LOAD_FAILURE_STATUS);
            return;
        }
        String activeTurnId = combatTurnTracker.activeTurnId(combatTurns, combatRoster);
        boolean added = combatRosterBuilder.addPlayerToRunningCombat(combatRoster, member.id(), member.name(), initiative);
        combatTurnTracker.restore(combatTurns, combatRoster, activeTurnId);
        context.setStatus(added
                ? member.name() + " betritt den laufenden Kampf."
                : member.name() + " ist bereits im Kampf.");
    }

    static void addReinforcement(
            CreatureDetailData creature,
            EncounterSessionContext context,
            CombatRoster combatRoster,
            CombatRosterBuilder combatRosterBuilder,
            CombatTurnTracker combatTurnTracker,
            CombatTurn combatTurns
    ) {
        String activeTurnId = combatTurnTracker.activeTurnId(combatTurns, combatRoster);
        String displayName = combatRosterBuilder.addReinforcement(
                combatRoster,
                creature,
                REINFORCEMENT_CREATURE_ROLE,
                CombatRosterBuilder.defaultMonsterInitiative(creature.initiativeBonus()));
        combatTurnTracker.restore(combatTurns, combatRoster, activeTurnId);
        context.setStatus(displayName + " betritt den laufenden Kampf.");
    }
}
