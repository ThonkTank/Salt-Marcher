package services;

import entities.Creature;
import entities.MonsterRole;

import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Classifies creatures into tactical roles based on existing stat block fields.
 * Purely static, no DB access — operates only on the already-loaded Creature object.
 * Safe to call from any thread.
 */
public class RoleClassifier {

    // DMG benchmarks: expected HP and AC per CR tier
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
        Map<MonsterRole, Integer> scores = scoreAllRoles(c);
        MonsterRole best = MonsterRole.BRUTE;
        int bestScore = Integer.MIN_VALUE;
        for (var entry : scores.entrySet()) {
            if (entry.getValue() > bestScore) {
                bestScore = entry.getValue();
                best = entry.getKey();
            }
        }
        return best;
    }

    /**
     * Returns a score map keyed by MonsterRole — no ordinal coupling.
     */
    public static Map<MonsterRole, Integer> scoreAllRoles(Creature c) {
        EnumMap<MonsterRole, Integer> scores = new EnumMap<>(MonsterRole.class);
        for (MonsterRole role : MonsterRole.values()) scores.put(role, 0);

        int crIdx = DndMath.crToIndex(c.CR);
        if (crIdx < 0 || crIdx >= CR_BENCHMARKS.length) {
            System.err.println("RoleClassifier.scoreAllRoles(): crToIndex out of bounds: " + crIdx + " for CR " + c.CR);
            crIdx = 0;
        }
        int expectedHP = CR_BENCHMARKS[crIdx][0];
        int expectedAC = CR_BENCHMARKS[crIdx][1];

        // Collect all action/trait lists for keyword scanning (no string concatenation)
        List<Creature.Action>[] actionLists = collectActionLists(c);
        List<Creature.Action>[] traitLists = new List[]{ c.Traits };

        // --- BRUTE: Hohe HP, hoher STR, niedriger AC ---
        if (c.Str >= 18) addScore(scores, MonsterRole.BRUTE, 3);
        if (c.HP > expectedHP * 1.2) addScore(scores, MonsterRole.BRUTE, 2);
        if (c.AC < expectedAC - 1) addScore(scores, MonsterRole.BRUTE, 1);
        if (containsAnyInLists(actionLists, "multiattack")) addScore(scores, MonsterRole.BRUTE, 1);

        // --- ARTILLERY: Fernkampf, hoher DEX, niedrige HP ---
        if (c.Dex >= 16 && containsAnyInLists(actionLists, RANGED_KEYWORDS)) addScore(scores, MonsterRole.ARTILLERY, 3);
        else if (containsAnyInLists(actionLists, RANGED_KEYWORDS)) addScore(scores, MonsterRole.ARTILLERY, 2);
        if (c.HP < expectedHP * 0.8) addScore(scores, MonsterRole.ARTILLERY, 1);
        if (c.FlySpeed > 0) addScore(scores, MonsterRole.ARTILLERY, 1);

        // --- CONTROLLER: Spellcasting, Conditions ---
        if (containsAnyInLists(traitLists, "spellcasting", "innate spellcasting")) addScore(scores, MonsterRole.CONTROLLER, 3);
        int conditionCount = countMatchesInLists(actionLists, CONDITION_KEYWORDS);
        if (conditionCount >= 2) addScore(scores, MonsterRole.CONTROLLER, 3);
        else if (conditionCount == 1) addScore(scores, MonsterRole.CONTROLLER, 2);
        if (containsAnyInLists(actionLists, "saving throw", "save")) addScore(scores, MonsterRole.CONTROLLER, 1);

        // --- SKIRMISHER: Hoher Speed, hoher DEX ---
        if (c.Speed >= 40 && c.Dex >= 14) addScore(scores, MonsterRole.SKIRMISHER, 3);
        else if (c.Speed >= 40 || (c.Dex >= 16 && c.FlySpeed > 0)) addScore(scores, MonsterRole.SKIRMISHER, 2);
        if (c.FlySpeed > 0) addScore(scores, MonsterRole.SKIRMISHER, 1);
        if (c.HP < expectedHP * 0.8) addScore(scores, MonsterRole.SKIRMISHER, 1);
        if (containsAnyInLists(actionLists, "disengage", "dash", "teleport")) addScore(scores, MonsterRole.SKIRMISHER, 1);

        // --- TANK: Hoher AC, defensiv ---
        if (c.AC >= expectedAC + 2 && c.Str >= 14) addScore(scores, MonsterRole.TANK, 3);
        else if (c.AC >= expectedAC + 1) addScore(scores, MonsterRole.TANK, 2);
        if (c.AcNotes != null && c.AcNotes.toLowerCase(Locale.ROOT).contains("shield")) addScore(scores, MonsterRole.TANK, 1);
        if (containsAnyInLists(actionLists, "multiattack")) addScore(scores, MonsterRole.TANK, 1);
        if (c.HP >= expectedHP) addScore(scores, MonsterRole.TANK, 1);

        // --- LEADER: Legendary, Support, Buffs ---
        if (c.LegendaryActionCount > 0) addScore(scores, MonsterRole.LEADER, 2);
        int leaderCount = countMatchesInLists(actionLists, LEADER_KEYWORDS)
                        + countMatchesInLists(traitLists, LEADER_KEYWORDS);
        if (leaderCount >= 2) addScore(scores, MonsterRole.LEADER, 3);
        else if (leaderCount == 1) addScore(scores, MonsterRole.LEADER, 2);
        if (containsAnyInLists(traitLists, "leadership", "pack tactics")) addScore(scores, MonsterRole.LEADER, 1);

        return scores;
    }

    private static void addScore(EnumMap<MonsterRole, Integer> scores, MonsterRole role, int delta) {
        scores.merge(role, delta, Integer::sum);
    }

    // --- Helper methods ---

    @SuppressWarnings("unchecked")
    private static List<Creature.Action>[] collectActionLists(Creature c) {
        return new List[]{ c.Actions, c.BonusActions, c.LegendaryActions, c.Reactions };
    }

    /** Checks if any action name or description in the given lists contains any keyword (case-insensitive). */
    private static boolean containsAnyInLists(List<Creature.Action>[] lists, String... keywords) {
        for (List<Creature.Action> actions : lists) {
            if (actions == null) continue;
            for (Creature.Action a : actions) {
                for (String kw : keywords) {
                    if (containsIgnoreCase(a.Name, kw) || containsIgnoreCase(a.Description, kw)) return true;
                }
            }
        }
        return false;
    }

    /** Counts how many distinct keywords appear in any action name or description (case-insensitive). */
    private static int countMatchesInLists(List<Creature.Action>[] lists, String[] keywords) {
        int count = 0;
        for (String kw : keywords) {
            outer:
            for (List<Creature.Action> actions : lists) {
                if (actions == null) continue;
                for (Creature.Action a : actions) {
                    if (containsIgnoreCase(a.Name, kw) || containsIgnoreCase(a.Description, kw)) {
                        count++;
                        break outer;
                    }
                }
            }
        }
        return count;
    }

    private static boolean containsIgnoreCase(String text, String keyword) {
        if (text == null || keyword == null) return false;
        int tLen = text.length();
        int kLen = keyword.length();
        if (kLen > tLen) return false;
        for (int i = 0; i <= tLen - kLen; i++) {
            if (text.regionMatches(true, i, keyword, 0, kLen)) return true;
        }
        return false;
    }

}
