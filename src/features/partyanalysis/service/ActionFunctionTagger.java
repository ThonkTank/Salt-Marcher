package features.partyanalysis.service;

import features.partyanalysis.repository.EncounterPartyAnalysisRepository.ActionRow;

import java.util.Locale;

final class ActionFunctionTagger {
    private ActionFunctionTagger() {
        throw new AssertionError("No instances");
    }

    static ActionTags tag(ActionRow action) {
        String name = text(action.name());
        String description = text(action.description());
        String joined = (name + " " + description).toLowerCase(Locale.ROOT);

        int isMelee = containsAny(joined, "melee weapon attack", "reach ") ? 1 : 0;
        int isRanged = containsAny(joined, "ranged weapon attack", "ranged spell attack", "range ") ? 1 : 0;
        int isAoe = containsAny(joined, "cone", "radius", "line", "cube", "sphere", "each creature") ? 1 : 0;
        int isBuff = containsAny(joined, "advantage", "bonus to", "gains", "allies", "inspire", "leadership") ? 1 : 0;
        int isHeal = containsAny(joined, "regain", "heals", "hit points", "temporary hit points") ? 1 : 0;
        int isControl = containsAny(joined,
                "stunned", "restrained", "grappled", "frightened", "charmed", "paralyzed", "prone", "blinded") ? 1 : 0;
        int hasMobility = containsAny(joined, "teleport", "dash", "move up to", "disengage", "fly") ? 1 : 0;
        int hasSummon = containsAny(joined, "summon", "conjure", "creates") ? 1 : 0;
        int isSpellcasting = containsAny(joined,
                "spellcasting", "innate spellcasting", "spell attack", "cantrip", "spell save dc") ? 1 : 0;
        int recharge = containsAny(joined, "recharge") ? 1 : 0;

        int lineCount = estimateLineCount(description);
        int complexity = estimateComplexity(lineCount, isAoe, isBuff, isHeal, isControl, hasMobility, hasSummon, recharge);

        double expectedUses = "legendary_action".equals(action.actionType())
                ? 1.0
                : "bonus_action".equals(action.actionType()) || "reaction".equals(action.actionType())
                ? 0.6
                : 1.0;

        return new ActionTags(
                joined,
                isMelee,
                isRanged,
                isAoe,
                isBuff,
                isHeal,
                isControl,
                hasMobility,
                hasSummon,
                isSpellcasting,
                recharge,
                lineCount,
                complexity,
                expectedUses);
    }

    private static boolean containsAny(String haystack, String... needles) {
        for (String needle : needles) {
            if (haystack.contains(needle)) return true;
        }
        return false;
    }

    private static int estimateLineCount(String text) {
        if (text == null || text.isBlank()) return 1;
        int explicitLines = text.split("\\R").length;
        int byLength = (int) Math.ceil(text.length() / 120.0);
        return Math.max(1, Math.max(explicitLines, byLength));
    }

    private static int estimateComplexity(int lines,
                                          int isAoe,
                                          int isBuff,
                                          int isHeal,
                                          int isControl,
                                          int hasMobility,
                                          int hasSummon,
                                          int requiresRecharge) {
        int complexity = Math.max(1, lines / 2);
        complexity += isAoe + isBuff + isHeal + isControl + hasMobility + hasSummon;
        complexity += requiresRecharge;
        return complexity;
    }

    private static String text(String value) {
        return value == null ? "" : value;
    }

    record ActionTags(
            String joinedText,
            int isMelee,
            int isRanged,
            int isAoe,
            int isBuff,
            int isHeal,
            int isControl,
            int hasMobility,
            int hasSummon,
            int isSpellcasting,
            int requiresRecharge,
            int estimatedRuleLines,
            int complexityPoints,
            double expectedUsesPerRound
    ) {}
}
