package services;

import entities.CombatantState;
import entities.Creature;
import entities.PlayerCharacter;
import services.EncounterGenerator.Encounter;
import services.EncounterGenerator.EncounterSlot;

import java.util.ArrayList;
import java.util.List;

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
}
