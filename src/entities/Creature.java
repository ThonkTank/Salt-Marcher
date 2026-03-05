package entities;

import java.util.List;

public class Creature {

    // --- Core fields (EncounterGenerator compatibility) ---
    public Long Id;
    public String Name;
    public String CreatureType;      // humanoid, dragon, undead, ...
    public ChallengeRating CR;        // encapsulates both display ("1/4") and numeric (0.25) forms
    public int XP;
    public int HP;
    public int AC;
    public int Speed;                // Walk speed in ft (used by EncounterGenerator)
    public int InitiativeBonus;
    public List<String> Biomes;
    public List<Action> Actions;     // fallback for unrecognized action_types from DB

    // --- Base identity ---
    public String Size;              // Tiny / Small / Medium / Large / Huge / Gargantuan
    public List<String> Subtypes;    // e.g. ["Goblinoid"], ["gnome", "shapeshifter"]
    public String Alignment;

    // --- AC & HP Details ---
    public String AcNotes;           // "natural armor", "leather armor, shield"
    public String HitDice;           // "2d6", "18d8+54"

    // --- Speed breakdown ---
    public int FlySpeed;
    public int SwimSpeed;
    public int ClimbSpeed;
    public int BurrowSpeed;

    // --- Ability Scores ---
    public int Str;
    public int Dex;
    public int Con;
    public int Intel;                // named 'Intel' to avoid the 'int' keyword
    public int Wis;
    public int Cha;

    public int ProficiencyBonus;

    // --- Saves & Skills (delimited strings, consistent with biomes pattern) ---
    public String SavingThrows;          // "CON:10,INT:12,WIS:9"
    public String Skills;                // "Stealth:6,Perception:3"

    // --- Damage affinities & Conditions ---
    public String DamageVulnerabilities;
    public String DamageResistances;
    public String DamageImmunities;
    public String ConditionImmunities;

    // --- Senses & Languages ---
    public String Senses;                // "darkvision:60,truesight:120"
    public int PassivePerception;
    public String Languages;

    // --- Actions by type ---
    public List<Action> Traits;
    public List<Action> BonusActions;
    public List<Action> Reactions;
    public List<Action> LegendaryActions;
    public int LegendaryActionCount;

    // --- Nested Action class ---
    public static class Action {
        public final String Name;
        public final String Description;
        public Action(String name, String description) {
            this.Name = name;
            this.Description = description;
        }
    }

    /** Pre-computed tactical role (e.g. "BRUTE", "TANK"). Null for legacy records imported before v6 schema. */
    public String Role;

    /** True once actions, biomes, and subtypes have been loaded from the DB. */
    public boolean relationsLoaded = false;
}
