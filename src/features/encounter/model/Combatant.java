package features.encounter.model;

/**
 * Base class for all combat participants. Subclasses: {@link MonsterCombatant}, {@link PcCombatant}.
 * Common state (name, initiative, initiativeBonus) lives here; monster-specific fields
 * (HP, AC, CreatureRef snapshot) are on MonsterCombatant only.
 */
public abstract class Combatant {
    private String name;
    private int initiative;
    private int initiativeBonus;

    public final String getName() {
        return name;
    }

    public final void rename(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name must be non-blank");
        }
        this.name = name;
    }

    public final int getInitiative() {
        return initiative;
    }

    public final void setInitiative(int initiative) {
        this.initiative = initiative;
    }

    public final int getInitiativeBonus() {
        return initiativeBonus;
    }

    public final void setInitiativeBonus(int initiativeBonus) {
        this.initiativeBonus = initiativeBonus;
    }

    public abstract boolean isAlive();
}
