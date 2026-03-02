package entities;

public class Item {

    // --- Identität ---
    public Long Id;
    public String Name;
    public String Slug;                // "4-longsword", für Resume/Deduplizierung

    // --- Klassifizierung ---
    public String Category;            // "Weapon", "Armor", "Adventuring Gear", "Tool",
                                       // "Wondrous Item", "Potion", "Ring", "Rod", "Staff", "Wand", "Scroll"
    public String Subcategory;         // "Martial Melee", "Heavy Armor", null bei Magic Items
    public boolean IsMagic;            // true = Magic Item

    // --- Magic-Item-Felder (null/false bei mundane) ---
    public String Rarity;              // "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"
    public boolean RequiresAttunement;
    public String AttunementCondition; // "by a spellcaster", null

    // --- Equipment-Felder (null/0 bei reinen Magic Items) ---
    public String Cost;                // "15 gp" (Original-Text)
    public int CostCp;                // 1500 (umgerechnet in Copper für Sort/Filter)
    public double Weight;              // in lb
    public String Damage;              // "1d8 slashing", null bei Non-Weapons
    public String Properties;          // "Versatile (1d10), Finesse", null
    public String ArmorClass;          // "18", "11 + Dex modifier", null bei Non-Armor

    // --- Shared ---
    public String Description;
    public String Source;              // "Player's Handbook"
    public String Tags;                // "Combat, Damage, Utility"
}
