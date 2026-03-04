package services;

import entities.CombatantState;
import entities.Creature;
import entities.PlayerCharacter;
import services.EncounterGenerator.Encounter;
import services.EncounterGenerator.EncounterSlot;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class CombatSetup {

    private static int rollInitiative(Creature c) {
        return (int) (Math.random() * 20) + 1 + c.InitiativeBonus;
    }

    public static List<CombatantState> buildCombatants(
            List<PlayerCharacter> party,
            List<Integer> pcInitiatives,
            Encounter encounter) {

        List<CombatantState> combatants = new ArrayList<>();

        // PCs mit manueller Initiative
        for (int i = 0; i < party.size(); i++) {
            PlayerCharacter pc = party.get(i);
            CombatantState cs  = new CombatantState();
            cs.Name              = pc.Name + " (Lv." + pc.Level + ")";
            cs.IsPlayerCharacter = true;
            cs.Initiative        = pcInitiatives.get(i);
            // PC stats (AC, MaxHp) are not tracked; the UI displays the character sheet instead
            cs.AC                = 0; // 0 = unknown/managed externally by convention
            cs.MaxHp             = 0; // 0 = unknown/managed externally by convention
            cs.CurrentHp         = 0;
            combatants.add(cs);
        }

        // Monster mit gewürfelter Initiative
        for (EncounterSlot slot : encounter.slots) {
            if (slot.creature == null) continue;
            for (int i = 1; i <= slot.count; i++) {
                CombatantState cs = new CombatantState();
                cs.CreatureRef       = slot.creature;
                cs.Name              = slot.count > 1
                        ? slot.creature.Name + " #" + i
                        : slot.creature.Name;
                cs.IsPlayerCharacter = false;
                cs.MaxHp             = slot.creature.HP;
                cs.CurrentHp         = slot.creature.HP;
                cs.AC                = slot.creature.AC;
                cs.InitiativeBonus   = slot.creature.InitiativeBonus;
                cs.Initiative        = rollInitiative(slot.creature);
                combatants.add(cs);
            }
        }

        // Nach Initiative sortieren — Gleichstand: PCs gewinnen
        combatants.sort((a, b) -> {
            if (b.Initiative != a.Initiative) return b.Initiative - a.Initiative;
            return Boolean.compare(b.IsPlayerCharacter, a.IsPlayerCharacter);
        });

        return combatants;
    }

    /** Compute difficulty stats from alive monster combatants. */
    public static XpCalculator.DifficultyStats computeLiveStats(
            List<CombatantState> combatants, int partySize, int avgLevel) {
        Map<Long, Creature> creatureMap = new LinkedHashMap<>();
        Map<Long, Integer> countMap = new LinkedHashMap<>();
        for (CombatantState cs : combatants) {
            if (cs.IsPlayerCharacter || cs.CreatureRef == null) continue;
            if (cs.CurrentHp > 0) {
                Long id = cs.CreatureRef.Id;
                creatureMap.putIfAbsent(id, cs.CreatureRef);
                countMap.put(id, countMap.getOrDefault(id, 0) + 1);
            }
        }
        List<Creature> creatures = new ArrayList<>(creatureMap.values());
        List<Integer> counts = new ArrayList<>();
        for (Creature c : creatures) {
            counts.add(countMap.get(c.Id));
        }
        return XpCalculator.computeStats(
                EncounterGenerator.adjustedXpFromCounts(creatures, counts), partySize, avgLevel);
    }

    /**
     * Creates a single reinforcement combatant with auto-rolled initiative.
     * @param creature the creature to add
     * @return a new CombatantState ready to insert into the turn order
     */
    public static CombatantState createReinforcement(Creature creature) {
        CombatantState cs = new CombatantState();
        cs.CreatureRef       = creature;
        cs.Name              = creature.Name;
        cs.IsPlayerCharacter = false;
        cs.MaxHp             = creature.HP;
        cs.CurrentHp         = creature.HP;
        cs.AC                = creature.AC;
        cs.InitiativeBonus   = creature.InitiativeBonus;
        cs.Initiative        = rollInitiative(creature);
        return cs;
    }
}
