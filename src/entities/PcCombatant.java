package entities;

/** Combat state for a player character. HP and AC are managed by the player; isAlive() is always true. */
public class PcCombatant extends Combatant {
    @Override
    public boolean isAlive() { return true; }
}
