package entities;

/** Combat state for a monster. Tracks HP, AC, and the source Creature for stat-block display. */
public class MonsterCombatant extends Combatant {
    public int CurrentHp;
    public int MaxHp;
    public int AC;
    public Creature CreatureRef;

    @Override
    public boolean isAlive() { return CurrentHp > 0; }
}
