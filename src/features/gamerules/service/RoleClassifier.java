package features.gamerules.service;

import features.creaturecatalog.model.Creature;
import features.gamerules.model.MonsterRole;

import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Classifies creatures into tactical roles based on existing stat block fields.
 * Purely static, no DB access — operates only on the already-loaded Creature object.
 * Safe to call from any thread.
 */
public final class RoleClassifier {
    private RoleClassifier() {
        throw new AssertionError("No instances");
    }

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

        int expectedHP = DndMath.expectedHpBenchmark(c.CR);
        int expectedAC = DndMath.expectedAcBenchmark(c.CR);

        // Collect all action/trait lists for keyword scanning (no string concatenation)
        List<Creature.Action>[] actionLists = collectActionLists(c);
        List<Creature.Action>[] traitLists = new List[]{ c.Traits };

        // --- BRUTE: high HP, high STR, lower AC ---
        if (c.Str >= 18) addScore(scores, MonsterRole.BRUTE, 3);
        if (c.HP > expectedHP * 1.2) addScore(scores, MonsterRole.BRUTE, 2);
        if (c.AC < expectedAC - 1) addScore(scores, MonsterRole.BRUTE, 1);
        if (containsAnyInLists(actionLists, "multiattack")) addScore(scores, MonsterRole.BRUTE, 1);

        // --- ARTILLERY: ranged attacks, high DEX, lower HP ---
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

        // --- SKIRMISHER: high speed, high DEX ---
        if (c.Speed >= 40 && c.Dex >= 14) addScore(scores, MonsterRole.SKIRMISHER, 3);
        else if (c.Speed >= 40 || (c.Dex >= 16 && c.FlySpeed > 0)) addScore(scores, MonsterRole.SKIRMISHER, 2);
        if (c.FlySpeed > 0) addScore(scores, MonsterRole.SKIRMISHER, 1);
        if (c.HP < expectedHP * 0.8) addScore(scores, MonsterRole.SKIRMISHER, 1);
        if (containsAnyInLists(actionLists, "disengage", "dash", "teleport")) addScore(scores, MonsterRole.SKIRMISHER, 1);

        // --- TANK: high AC, defensive profile ---
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
                    if (containsKeywordIgnoreCase(a.Name, kw) || containsKeywordIgnoreCase(a.Description, kw)) {
                        return true;
                    }
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
                    if (containsKeywordIgnoreCase(a.Name, kw) || containsKeywordIgnoreCase(a.Description, kw)) {
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

    /**
     * Matches single-word keywords on token boundaries to avoid false positives
     * (for example "save" should not match "savage").
     */
    private static boolean containsKeywordIgnoreCase(String text, String keyword) {
        if (text == null || keyword == null) return false;
        if (keyword.indexOf(' ') >= 0 || keyword.indexOf('.') >= 0) {
            return containsIgnoreCase(text, keyword);
        }
        return containsWholeWordIgnoreCase(text, keyword);
    }

    private static boolean containsWholeWordIgnoreCase(String text, String keyword) {
        int tLen = text.length();
        int kLen = keyword.length();
        if (kLen == 0 || kLen > tLen) return false;
        for (int i = 0; i <= tLen - kLen; i++) {
            if (!text.regionMatches(true, i, keyword, 0, kLen)) continue;
            boolean leftBoundary = i == 0 || !Character.isLetterOrDigit(text.charAt(i - 1));
            int end = i + kLen;
            boolean rightBoundary = end == tLen || !Character.isLetterOrDigit(text.charAt(end));
            if (leftBoundary && rightBoundary) return true;
        }
        return false;
    }

}
