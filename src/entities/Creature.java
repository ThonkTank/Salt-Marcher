package entities;

import java.util.List;

public class Creature {

    // --- Bestehende Felder (EncounterGenerator-Kompatibilität) ---
    public Long Id;
    public String Name;
    public String CreatureType;      // humanoid, dragon, undead, ...
    public String CR;                // "1/4", "1/2", "14" (war int)
    public int XP;
    public int HP;
    public int AC;
    public int Speed;                // Walk-Speed in ft (für EncounterGenerator)
    public int InitiativeBonus;
    public List<String> Biomes;
    public List<Action> Actions;     // fallback for unrecognized action_types from DB

    // --- Basis-Identität ---
    public String Size;              // Tiny / Small / Medium / Large / Huge / Gargantuan
    public List<String> Subtypes;    // z.B. ["Goblinoid"], ["gnome", "shapeshifter"]
    public String Alignment;

    // --- AC & HP Details ---
    public String AcNotes;           // "natural armor", "leather armor, shield"
    public String HitDice;           // "2d6", "18d8+54"

    // --- Geschwindigkeit aufgeschlüsselt ---
    public int FlySpeed;
    public int SwimSpeed;
    public int ClimbSpeed;
    public int BurrowSpeed;

    // --- Ability Scores ---
    public int Str;
    public int Dex;
    public int Con;
    public int Intel;                // 'int' ist Java-Keyword
    public int Wis;
    public int Cha;

    public int ProficiencyBonus;

    // --- Saves & Skills (delimited strings, konsistent mit biomes-Muster) ---
    public String SavingThrows;          // "CON:10,INT:12,WIS:9"
    public String Skills;                // "Stealth:6,Perception:3"

    // --- Damage-Affinitäten & Conditions ---
    public String DamageVulnerabilities;
    public String DamageResistances;
    public String DamageImmunities;
    public String ConditionImmunities;

    // --- Sinne & Sprachen ---
    public String Senses;                // "darkvision:60,truesight:120"
    public int PassivePerception;
    public String Languages;

    // --- Aktionen nach Typ ---
    public List<Action> Traits;
    public List<Action> BonusActions;
    public List<Action> Reactions;
    public List<Action> LegendaryActions;
    public int LegendaryActionCount;

    // --- Nested Action class ---
    public static class Action {
        public String Name;
        public String Description;
    }
}
