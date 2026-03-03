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
            cs.Ac                = 0;
            cs.MaxHp             = 0;
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
                cs.Ac                = slot.creature.AC;
                cs.InitiativeBonus   = slot.creature.InitiativeBonus;
                cs.Initiative        = (int) (Math.random() * 20) + 1
                        + slot.creature.InitiativeBonus;
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
        Map<Long, EncounterSlot> slotMap = new LinkedHashMap<>();
        for (CombatantState cs : combatants) {
            if (cs.IsPlayerCharacter || cs.CreatureRef == null) continue;
            if (cs.CurrentHp > 0) {
                Long id = cs.CreatureRef.Id;
                EncounterSlot slot = slotMap.computeIfAbsent(id, k -> {
                    EncounterSlot s = new EncounterSlot();
                    s.creature = cs.CreatureRef;
                    s.count = 0;
                    return s;
                });
                slot.count++;
            }
        }
        List<EncounterSlot> liveSlots = new ArrayList<>(slotMap.values());
        return XpCalculator.computeStats(
                EncounterGenerator.adjustedXp(liveSlots), partySize, avgLevel);
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
        cs.Ac                = creature.AC;
        cs.InitiativeBonus   = creature.InitiativeBonus;
        cs.Initiative        = (int) (Math.random() * 20) + 1 + creature.InitiativeBonus;
        return cs;
    }
}
