package src.domain.encounter.model.session;

import java.util.ArrayList;
import java.util.List;

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

    public boolean containsId(CombatantId combatantId) {
        for (Combatant combatant : combatants) {
            if (combatantId != null && combatant.id().equals(combatantId.value())) {
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
