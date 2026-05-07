package src.domain.encounter.session.entity;

import static src.domain.encounter.session.value.EncounterSessionValues.*;

import java.util.ArrayList;
import java.util.List;
import src.domain.encounter.session.service.CombatRosterBuilderService;
import src.domain.encounter.session.service.CombatTurnService;

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
                    CombatRosterBuilderService.defaultPlayerInitiative(index)));
        }
        for (EncounterCreatureData creature : roster) {
            int rolled = CombatRosterBuilderService.defaultMonsterInitiative(creature.initiativeBonus());
            String label = creature.count() > MULTIPLE_CREATURE_THRESHOLD
                    ? creature.name() + " x" + creature.count()
                    : creature.name();
            pendingRows.add(new InitiativeEntryData(
                    creature.id(),
                    label + " (" + CombatSessionSupport.signed(creature.initiativeBonus()) + ")",
                    CombatantKind.MONSTER,
                    rolled));
        }
        context.enterInitiative(INITIATIVE_READY_STATUS);
    }

    void confirm(
            List<InitiativeInput> initiatives,
            List<EncounterCreatureData> roster,
            CombatRoster combatRoster,
            CombatRosterBuilderService combatRosterBuilder,
            CombatTurnTracker combatTurnTracker,
            CombatTurnService combatTurns,
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
        context.enterCombat(COMBAT_RUNNING_STATUS);
    }

    List<InitiativeEntryData> entries() {
        return List.copyOf(pendingRows);
    }
}
