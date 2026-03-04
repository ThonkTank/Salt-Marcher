package entities;

public class CombatantState {
    public String   Name;
    public int      CurrentHp;
    public int      MaxHp;
    public int      AC;
    public int      Initiative;
    public int      InitiativeBonus;
    public boolean  IsPlayerCharacter;
    public Creature CreatureRef; // null für PCs
}
