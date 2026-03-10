package features.spells.model;

import java.util.List;

public class Spell {

    // --- Identity ---
    public Long Id;
    public String Name;
    public String Slug;
    public String Source;

    // --- Canonical spell metadata ---
    public int Level;
    public String School;
    public String CastingTime;
    public String RangeText;
    public String DurationText;
    public boolean Ritual;
    public boolean Concentration;
    public String ComponentsText;
    public String MaterialComponentText;
    public String ClassesText;
    public String AttackOrSaveText;
    public String DamageEffectText;

    // --- Description ---
    public String Description;
    public String HigherLevelsText;

    // --- Derived analysis fields ---
    public String CastingChannel; // action, bonus_action, reaction, long_cast, special
    public String TargetProfile; // single, small_aoe, large_aoe, utility
    public String DeliveryType; // attack, save, auto, utility
    public boolean IsOffensive;
    public double ExpectedDamageSingle;
    public double ExpectedDamageSmallAoe;
    public double ExpectedDamageLargeAoe;

    // --- Normalized collections ---
    public List<String> Classes;
    public List<String> DamageTypes;
    public List<String> Tags;
}
