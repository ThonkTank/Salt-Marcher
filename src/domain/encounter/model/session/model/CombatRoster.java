package src.domain.encounter.model.session.model;

import java.util.ArrayList;
import java.util.List;
import src.domain.encounter.model.session.model.Combatant;

public final class CombatRoster {

    private final List<Combatant> combatants = new ArrayList<>();

    public void clear() {
        combatants.clear();
    }

    public void add(Combatant combatant) {
        combatants.add(combatant);
    }

    public List<Combatant> combatants() {
        return List.copyOf(combatants);
    }

    public boolean containsId(String combatantId) {
        for (Combatant combatant : combatants) {
            if (combatant.id().equals(combatantId)) {
                return true;
            }
        }
        return false;
    }

    public void replaceAll(List<Combatant> updatedCombatants) {
        combatants.clear();
        combatants.addAll(updatedCombatants);
    }

    public void sort() {
        combatants.sort(Combatant::compareByTurnOrder);
    }
}
