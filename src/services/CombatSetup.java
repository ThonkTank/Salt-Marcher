package services;

import entities.Combatant;
import entities.Creature;
import entities.MonsterCombatant;
import entities.PcCombatant;
import entities.PlayerCharacter;
import entities.Encounter;
import entities.EncounterSlot;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

public class CombatSetup {

    private static int rollInitiative(Creature c) {
        return ThreadLocalRandom.current().nextInt(1, 21) + c.InitiativeBonus;
    }

    private static MonsterCombatant monsterCombatantFrom(Creature c) {
        MonsterCombatant mc   = new MonsterCombatant();
        mc.CreatureRef        = c;
        mc.Name               = c.Name;
        mc.MaxHp              = c.HP;
        mc.CurrentHp          = c.HP;
        mc.AC                 = c.AC;
        mc.InitiativeBonus    = c.InitiativeBonus;
        mc.Initiative         = rollInitiative(c);
        return mc;
    }

    public static List<Combatant> buildCombatants(
            List<PlayerCharacter> party,
            List<Integer> pcInitiatives,
            Encounter encounter) {

        List<Combatant> combatants = new ArrayList<>();

        // PCs mit manueller Initiative
        for (int i = 0; i < party.size(); i++) {
            PlayerCharacter pc = party.get(i);
            PcCombatant cs     = new PcCombatant();
            cs.Name            = pc.Name + " (Lv." + pc.Level + ")";
            cs.Initiative      = pcInitiatives.get(i);
            combatants.add(cs);
        }

        // Monster mit gewürfelter Initiative
        for (EncounterSlot slot : encounter.slots()) {
            if (slot.creature == null) continue;
            for (int i = 1; i <= slot.count; i++) {
                MonsterCombatant mc = monsterCombatantFrom(slot.creature);
                if (slot.count > 1) mc.Name = slot.creature.Name + " #" + i;
                combatants.add(mc);
            }
        }

        // Nach Initiative sortieren — Gleichstand: PCs gewinnen
        combatants.sort((a, b) -> {
            if (b.Initiative != a.Initiative) return b.Initiative - a.Initiative;
            return Boolean.compare(b instanceof PcCombatant, a instanceof PcCombatant);
        });

        return combatants;
    }

    /** Compute difficulty stats from alive monster combatants. */
    public static XpCalculator.DifficultyStats computeLiveStats(
            List<Combatant> combatants, int partySize, int avgLevel) {
        return XpCalculator.computeStats(
                EncounterGenerator.adjustedXpFromCombatants(combatants), partySize, avgLevel);
    }

    /**
     * Returns a unique display name for a creature being added to an existing combatant list.
     * Appends " #N" when another combatant of the same creature already exists.
     */
    public static String uniqueNameFor(Creature creature, List<Combatant> combatants) {
        long count = combatants.stream()
                .filter(c -> c instanceof MonsterCombatant mc && mc.CreatureRef != null
                        && mc.CreatureRef.Id.equals(creature.Id))
                .count();
        return count > 0 ? creature.Name + " #" + (count + 1) : creature.Name;
    }

    /**
     * Creates a single reinforcement combatant with auto-rolled initiative.
     * @param creature the creature to add
     * @return a new MonsterCombatant ready to insert into the turn order
     */
    public static MonsterCombatant createReinforcement(Creature creature) {
        return monsterCombatantFrom(creature);
    }
}
