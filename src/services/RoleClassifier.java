package services;

import entities.Creature;

import java.util.List;
import java.util.Locale;

/**
 * Klassifiziert Kreaturen in taktische Rollen anhand vorhandener Stat-Block-Felder.
 * Rein statisch, kein DB-Zugriff — arbeitet nur auf dem bereits geladenen Creature-Objekt.
 */
public class RoleClassifier {

    public enum MonsterRole {
        BRUTE, ARTILLERY, CONTROLLER, SKIRMISHER, TANK, LEADER
    }

    // DMG-Richtwerte: erwartete HP und AC pro CR-Stufe
    private static final int[][] CR_BENCHMARKS = {
        // { expectedHP, expectedAC }
        {   3, 13 }, // CR 0
        {   7, 13 }, // CR 1/8
        {  14, 13 }, // CR 1/4
        {  21, 13 }, // CR 1/2
        {  33, 13 }, // CR 1
        {  52, 13 }, // CR 2
        {  67, 13 }, // CR 3
        {  82, 14 }, // CR 4
        {  97, 15 }, // CR 5
        { 112, 15 }, // CR 6
        { 127, 15 }, // CR 7
        { 144, 16 }, // CR 8
        { 161, 16 }, // CR 9
        { 178, 17 }, // CR 10
        { 195, 17 }, // CR 11
        { 210, 17 }, // CR 12
        { 225, 18 }, // CR 13
        { 240, 18 }, // CR 14
        { 255, 18 }, // CR 15
        { 270, 18 }, // CR 16
        { 285, 19 }, // CR 17
        { 300, 19 }, // CR 18
        { 315, 19 }, // CR 19
        { 330, 19 }, // CR 20
        { 345, 19 }, // CR 21
        { 400, 19 }, // CR 22
        { 420, 19 }, // CR 23
        { 445, 19 }, // CR 24
        { 470, 19 }, // CR 25
        { 495, 19 }, // CR 26
        { 520, 19 }, // CR 27
        { 545, 19 }, // CR 28
        { 580, 19 }, // CR 29
        { 625, 19 }, // CR 30
    };

    private static final String[] RANGED_KEYWORDS = {
        "ranged weapon attack", "ranged spell attack", "ft. line", "ft. cone",
        "ft. radius", "ft. cube"
    };

    private static final String[] CONDITION_KEYWORDS = {
        "poisoned", "frightened", "restrained", "stunned", "paralyzed",
        "charmed", "blinded", "incapacitated", "petrified"
    };

    private static final String[] LEADER_KEYWORDS = {
        "allies", "heal", "aura", "command", "inspire", "bolster", "rally"
    };

    public static MonsterRole classify(Creature c) {
        int[] scores = scoreAllRoles(c);
        int bestIdx = 0;
        for (int i = 1; i < scores.length; i++) {
            if (scores[i] > scores[bestIdx]) bestIdx = i;
        }
        return MonsterRole.values()[bestIdx];
    }

    /**
     * Gibt Score-Array zurück: [BRUTE, ARTILLERY, CONTROLLER, SKIRMISHER, TANK, LEADER]
     */
    public static int[] scoreAllRoles(Creature c) {
        int[] scores = new int[MonsterRole.values().length];
        int crIdx = crToIndex(c.CR);
        int expectedHP = CR_BENCHMARKS[crIdx][0];
        int expectedAC = CR_BENCHMARKS[crIdx][1];

        // Alle Action-Texte sammeln für Keyword-Suche
        String allActionText = collectActionText(c);
        String allTraitText = collectTraitText(c);

        // --- BRUTE: Hohe HP, hoher STR, niedriger AC ---
        if (c.Str >= 18) scores[0] += 3;
        if (c.HP > expectedHP * 1.2) scores[0] += 2;
        if (c.AC < expectedAC - 1) scores[0] += 1;
        if (containsAny(allActionText, "multiattack")) scores[0] += 1;

        // --- ARTILLERY: Fernkampf, hoher DEX, niedrige HP ---
        if (c.Dex >= 16 && containsAny(allActionText, RANGED_KEYWORDS)) scores[1] += 3;
        else if (containsAny(allActionText, RANGED_KEYWORDS)) scores[1] += 2;
        if (c.HP < expectedHP * 0.8) scores[1] += 1;
        if (c.FlySpeed > 0) scores[1] += 1;

        // --- CONTROLLER: Spellcasting, Conditions ---
        if (containsAny(allTraitText, "spellcasting", "innate spellcasting")) scores[2] += 3;
        int conditionCount = countMatches(allActionText, CONDITION_KEYWORDS);
        if (conditionCount >= 2) scores[2] += 3;
        else if (conditionCount == 1) scores[2] += 2;
        if (containsAny(allActionText, "saving throw", "save")) scores[2] += 1;

        // --- SKIRMISHER: Hoher Speed, hoher DEX ---
        if (c.Speed >= 40 && c.Dex >= 14) scores[3] += 3;
        else if (c.Speed >= 40 || (c.Dex >= 16 && c.FlySpeed > 0)) scores[3] += 2;
        if (c.FlySpeed > 0) scores[3] += 1;
        if (c.HP < expectedHP * 0.8) scores[3] += 1;
        if (containsAny(allActionText, "disengage", "dash", "teleport")) scores[3] += 1;

        // --- TANK: Hoher AC, defensiv ---
        if (c.AC >= expectedAC + 2 && c.Str >= 14) scores[4] += 3;
        else if (c.AC >= expectedAC + 1) scores[4] += 2;
        if (c.AcNotes != null && c.AcNotes.toLowerCase(Locale.ROOT).contains("shield")) scores[4] += 1;
        if (containsAny(allActionText, "multiattack")) scores[4] += 1;
        if (c.HP >= expectedHP) scores[4] += 1;

        // --- LEADER: Legendary, Support, Buffs ---
        if (c.LegendaryActionCount > 0) scores[5] += 2;
        int leaderCount = countMatches(allActionText + " " + allTraitText, LEADER_KEYWORDS);
        if (leaderCount >= 2) scores[5] += 3;
        else if (leaderCount == 1) scores[5] += 2;
        if (containsAny(allTraitText, "leadership", "pack tactics")) scores[5] += 1;

        return scores;
    }

    // --- Hilfsmethoden ---

    private static int crToIndex(String cr) {
        double val = EncounterTemplate.crToNumber(cr);
        // Indices 0-3 are fractional CRs (0, 1/8, 1/4, 1/2); integer CRs start at index 4.
        if (val <= 0)    return 0;
        if (val < 0.25)  return 1;
        if (val < 0.5)   return 2;
        if (val < 1.0)   return 3;
        return Math.min((int) val + 4, CR_BENCHMARKS.length - 1);
    }

    private static String collectActionText(Creature c) {
        StringBuilder sb = new StringBuilder();
        appendActions(sb, c.Actions);
        appendActions(sb, c.BonusActions);
        appendActions(sb, c.LegendaryActions);
        appendActions(sb, c.Reactions);
        return sb.toString().toLowerCase(Locale.ROOT);
    }

    private static String collectTraitText(Creature c) {
        StringBuilder sb = new StringBuilder();
        appendActions(sb, c.Traits);
        return sb.toString().toLowerCase(Locale.ROOT);
    }

    private static void appendActions(StringBuilder sb, List<Creature.Action> actions) {
        if (actions == null) return;
        for (Creature.Action a : actions) {
            if (a.Name != null) { sb.append(a.Name); sb.append(' '); }
            if (a.Description != null) { sb.append(a.Description); sb.append(' '); }
        }
    }

    private static boolean containsAny(String text, String... keywords) {
        for (String kw : keywords) {
            if (text.contains(kw)) return true;
        }
        return false;
    }

    private static int countMatches(String text, String[] keywords) {
        int count = 0;
        for (String kw : keywords) {
            if (text.contains(kw)) count++;
        }
        return count;
    }
}
