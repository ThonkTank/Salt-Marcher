package features.encounter.service.combat;

import features.encounter.model.Combatant;
import features.creaturecatalog.model.Creature;
import features.encounter.model.EncounterCreatureSnapshot;
import features.encounter.model.MonsterCombatant;
import features.encounter.model.PcCombatant;
import features.party.model.PlayerCharacter;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterSlot;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import features.encounter.service.EncounterCreatureMapper;
import features.gamerules.service.XpCalculator;

public final class CombatSetup {
    private CombatSetup() {}

    private static int rollInitiative(EncounterCreatureSnapshot c) {
        return ThreadLocalRandom.current().nextInt(1, 21) + c.getInitiativeBonus();
    }

    private static MonsterCombatant monsterCombatantFrom(EncounterCreatureSnapshot c, int initiative) {
        return new MonsterCombatant(
                c.getName(),
                initiative,
                c.getInitiativeBonus(),
                c.getHp(),
                c.getHp(),
                c.getAc(),
                c);
    }

    private static MonsterCombatant monsterCombatantFrom(EncounterCreatureSnapshot c) {
        return monsterCombatantFrom(c, rollInitiative(c));
    }

    /**
     * Builds the full combatant list for a combat encounter.
     * Monsters are always instantiated individually; mob turns are derived later as a runtime
     * projection in CombatTrackerPane from Creature-ID + initiative.
     *
     * @param monsterInitiatives list of pre-rolled initiatives, one value per encounter slot
     *                           in slot-iteration order (same order as shown in InitiativePane).
     *                           Every creature in the same slot receives the same initiative.
     *                           Pass null to auto-roll every slot.
     */
    public static List<Combatant> buildCombatants(
            List<PlayerCharacter> party,
            List<Integer> pcInitiatives,
            Encounter encounter,
            List<Integer> monsterInitiatives) {

        List<Combatant> combatants = new ArrayList<>();

        // PCs mit manueller Initiative
        for (int i = 0; i < party.size(); i++) {
            PlayerCharacter pc = party.get(i);
            PcCombatant cs     = new PcCombatant();
            cs.rename(pc.Name + " (Lv." + pc.Level + ")");
            cs.setInitiative(pcInitiatives.get(i));
            combatants.add(cs);
        }

        // Monster — always individual combatants. Runtime mob grouping is handled by CombatTrackerPane.
        int slotIdx = 0;
        for (EncounterSlot slot : encounter.slots()) {
            int initiative = (monsterInitiatives != null && slotIdx < monsterInitiatives.size())
                    ? monsterInitiatives.get(slotIdx)
                    : rollInitiative(slot.getCreature());
            slotIdx++;
            for (int i = 1; i <= slot.getCount(); i++) {
                MonsterCombatant mc = monsterCombatantFrom(slot.getCreature(), initiative);
                if (slot.getCount() > 1) mc.rename(slot.getCreature().getName() + " #" + i);
                combatants.add(mc);
            }
        }

        // Nach Initiative sortieren — Gleichstand: PCs gewinnen
        combatants.sort(CombatOrdering.BY_INITIATIVE_PC_FIRST);

        return combatants;
    }

    /** Compute difficulty stats from alive monster combatants. */
    public static XpCalculator.DifficultyStats computeLiveStats(
            List<Combatant> combatants, int partySize, int avgLevel) {
        return XpCalculator.computeStatsFromCombatants(combatants, partySize, avgLevel);
    }

    /**
     * Returns a unique display name for a creature being added to an existing combatant list.
     * Appends " #N" when another combatant of the same creature already exists.
     */
    public static String uniqueNameFor(Creature creature, List<Combatant> combatants) {
        EncounterCreatureSnapshot snapshot = EncounterCreatureMapper.toSnapshot(creature);
        return uniqueNameFor(snapshot, combatants);
    }

    public static String uniqueNameFor(EncounterCreatureSnapshot creature, List<Combatant> combatants) {
        if (creature == null) throw new IllegalArgumentException("creature must be non-null");
        long count = combatants.stream()
                .filter(c -> c instanceof MonsterCombatant mc && mc.getCreatureRef() != null
                        && mc.getCreatureRef().getId().equals(creature.getId()))
                .count();
        return count > 0 ? creature.getName() + " #" + (count + 1) : creature.getName();
    }

    /**
     * Creates a single reinforcement combatant with auto-rolled initiative.
     * @param creature the creature to add
     * @return a new MonsterCombatant ready to insert into the turn order
     */
    public static MonsterCombatant createReinforcement(Creature creature) {
        return createReinforcement(EncounterCreatureMapper.toSnapshot(creature));
    }

    public static MonsterCombatant createReinforcement(EncounterCreatureSnapshot creature) {
        return monsterCombatantFrom(creature);
    }
}
