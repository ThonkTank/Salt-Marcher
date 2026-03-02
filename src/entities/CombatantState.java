package entities;

public class CombatantState {
    public String   Name;
    public int      CurrentHp, MaxHp, Ac, Initiative, InitiativeBonus;
    public boolean  IsPlayerCharacter;
    public Creature CreatureRef; // null für PCs
}
