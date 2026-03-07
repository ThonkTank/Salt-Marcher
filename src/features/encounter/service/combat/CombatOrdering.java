package features.encounter.service.combat;

import features.encounter.model.Combatant;
import features.encounter.model.PcCombatant;

import java.util.Comparator;

/** Shared ordering rules for combatant initiative lists. */
public final class CombatOrdering {
    private CombatOrdering() {}

    public static final Comparator<Combatant> BY_INITIATIVE_PC_FIRST = (a, b) -> {
        if (b.getInitiative() != a.getInitiative()) return b.getInitiative() - a.getInitiative();
        return Boolean.compare(b instanceof PcCombatant, a instanceof PcCombatant);
    };
}
