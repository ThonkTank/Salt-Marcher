package features.items.model;

import java.util.List;

public class Item {

    // --- Identity ---
    public Long Id;
    public String Name;
    public String Slug;                // "4-longsword", for resume/deduplication

    // --- Classification ---
    public String Category;            // "Weapon", "Armor", "Adventuring Gear", "Tool",
                                       // "Wondrous Item", "Potion", "Ring", "Rod", "Staff", "Wand", "Scroll"
    public String Subcategory;         // "Martial Melee", "Heavy Armor", null for magic items
    public boolean IsMagic;            // true = magic item

    // --- Magic item fields (null/false for mundane items) ---
    public String Rarity;              // "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"
    public boolean RequiresAttunement;
    public String AttunementCondition; // "by a spellcaster", null

    // --- Equipment fields (null/0 for pure magic items) ---
    public String Cost;                // "15 gp" (original text)
    public int CostCp;                 // 1500 (converted to copper for sort/filter)
    public double Weight;              // in lb
    public String Damage;              // "1d8 slashing", null for non-weapons
    public String Properties;          // "Versatile (1d10), Finesse", null
    public String ArmorClass;          // "18", "11 + Dex modifier", null for non-armor

    // --- Shared ---
    public String Description;
    public String Source;              // "Player's Handbook"
    public List<String> Tags;          // canonical storage: item_tags
}
