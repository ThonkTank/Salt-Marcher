package entities;

/**
 * Base class for all combat participants. Subclasses: {@link MonsterCombatant}, {@link PcCombatant}.
 * Common fields (Name, Initiative, InitiativeBonus) live here; monster-specific fields
 * (HP, AC, CreatureRef) are on MonsterCombatant only.
 */
public abstract class Combatant {
    public String Name;
    public int Initiative;
    public int InitiativeBonus;

    public abstract boolean isAlive();
}
