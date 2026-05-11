package src.domain.encounter.model.session.model;

import static src.domain.encounter.model.session.model.EncounterSessionValues.*;

import java.util.ArrayList;
import java.util.List;

final class CombatInitiativeTracker {

    private static final String OPEN_INITIATIVE_NEEDS_CREATURE_STATUS = "Kampfstart braucht mindestens eine Kreatur.";
    private static final String OPEN_INITIATIVE_NEEDS_PARTY_STATUS = "Kampfstart braucht aktive Party-Mitglieder.";
    private static final String INITIATIVE_READY_STATUS = "Initiativewerte pruefen und Kampf starten.";
    private static final String COMBAT_RUNNING_STATUS = "Kampf laeuft. HP und Initiative sind lokal editierbar.";
    private static final int MULTIPLE_CREATURE_THRESHOLD = 1;
    private final List<InitiativeEntryData> pendingRows = new ArrayList<>();

    void reset() {
        pendingRows.clear();
    }

    void open(EncounterSessionContext context, List<EncounterCreatureData> roster) {
        if (roster.isEmpty()) {
            context.setStatus(OPEN_INITIATIVE_NEEDS_CREATURE_STATUS);
            return;
        }
        if (!context.hasActiveParty()) {
            context.setStatus(OPEN_INITIATIVE_NEEDS_PARTY_STATUS);
            return;
        }
        pendingRows.clear();
        List<PartyMemberData> activeParty = context.activeParty();
        for (int index = 0; index < activeParty.size(); index++) {
            PartyMemberData member = activeParty.get(index);
            pendingRows.add(new InitiativeEntryData(
                    member.id(),
                    member.name() + " (Lv. " + member.level() + ")",
                    CombatantKind.playerCharacterKind(),
                    CombatRosterBuilder.defaultPlayerInitiative(index)));
        }
        for (EncounterCreatureData creature : roster) {
            int rolled = CombatRosterBuilder.defaultMonsterInitiative(creature.initiativeBonus());
            String label = creature.count() > MULTIPLE_CREATURE_THRESHOLD
                    ? creature.name() + " x" + creature.count()
                    : creature.name();
            pendingRows.add(new InitiativeEntryData(
                    creature.id(),
                    label + " (" + CombatSessionSupport.signed(creature.initiativeBonus()) + ")",
                    CombatantKind.MONSTER,
                    rolled));
        }
        context.enterMode(Mode.INITIATIVE, INITIATIVE_READY_STATUS);
    }

    void confirm(
            List<InitiativeInput> initiatives,
            List<EncounterCreatureData> roster,
            CombatRoster combatRoster,
            CombatRosterBuilder combatRosterBuilder,
            CombatTurnTracker combatTurnTracker,
            CombatTurn combatTurns,
            EncounterSessionContext context
    ) {
        combatRoster.clear();
        int fallbackIndex = 0;
        for (InitiativeInput input : CombatSessionSupport.safeInitiatives(initiatives)) {
            InitiativeEntryData entry = CombatSessionSupport.initiativeEntry(pendingRows, input.id()).orElse(null);
            if (entry == null) {
                continue;
            }
            if (entry.kind().playerCharacter()) {
                fallbackIndex = combatRosterBuilder.addPlayer(
                        combatRoster,
                        entry.id(),
                        CombatSessionSupport.nameOnly(entry.label()),
                        input.initiative(),
                        fallbackIndex);
                continue;
            }
            EncounterCreatureData creature = CombatSessionSupport.rosterCreature(roster, entry.id()).orElse(null);
            if (creature == null) {
                continue;
            }
            fallbackIndex = combatRosterBuilder.addMonsters(combatRoster, creature, input.initiative(), fallbackIndex);
        }
        combatRoster.sort();
        combatTurnTracker.beginCombat(combatTurns, combatRoster);
        context.enterMode(Mode.COMBAT, COMBAT_RUNNING_STATUS);
    }

    List<InitiativeEntryData> entries() {
        return List.copyOf(pendingRows);
    }
}
