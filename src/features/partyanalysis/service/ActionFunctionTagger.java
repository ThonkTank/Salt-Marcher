package features.partyanalysis.service;

import features.partyanalysis.repository.EncounterPartyAnalysisRepository.ActionRow;

import java.util.Locale;
import java.util.regex.Pattern;

final class ActionFunctionTagger {
    private static final String[] STRONG_RANGED_NAME_HINTS = {
            "archer", "arrow", "ballista", "bolt", "bow", "crossbow", "dart", "firearm",
            "longbow", "musket", "pistol", "rifle", "shortbow", "shoot", "shot", "sling"
    };
    private static final String[] LIGHT_RANGED_NAME_HINTS = {
            "dagger", "knife", "net", "poison dart", "shuriken", "throwing"
    };
    private static final String[] BRUISER_THROW_HINTS = {
            "boulder", "greatclub", "handaxe", "hurl", "javelin", "rock", "spear", "stone"
    };
    private static final String[] SUPPORT_SPELL_NAMES = {
            "aid", "beacon of hope", "bless", "enhance ability", "guidance", "haste", "heroism",
            "pass without trace", "prayer of healing", "protection from evil and good",
            "sanctuary", "shield of faith", "warding bond"
    };
    private static final String[] HEALING_SPELL_NAMES = {
            "cure wounds", "healing word", "heal", "lesser restoration", "mass cure wounds",
            "mass healing word", "power word heal", "regenerate", "revivify"
    };
    private static final String[] CONTROL_SPELL_NAMES = {
            "banishment", "black tentacles", "blindness/deafness", "calm emotions", "charm person",
            "command", "confusion", "entangle", "fear", "hold monster", "hold person",
            "hypnotic pattern", "hideous laughter", "sleep", "slow", "silence", "stinking cloud",
            "wall of force", "web", "gust of wind", "dust devil", "sleet storm", "spirit guardians",
            "control water", "ray of enfeeblement"
    };
    private static final String[] MOBILITY_SPELL_NAMES = {
            "dimension door", "expeditious retreat", "fly", "freedom of movement", "haste",
            "invisibility", "levitate", "misty step", "pass without trace", "teleport",
            "thunder step", "tree stride"
    };
    private static final String[] SUMMON_SPELL_NAMES = {
            "animate dead", "conjure", "find familiar", "spiritual weapon", "summon"
    };
    private static final Pattern HABITAT_SUFFIX_PATTERN =
            Pattern.compile("\\s*habitat:\\s*.*$", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern MELEE_OR_RANGED_PATTERN =
            Pattern.compile("\\bmelee or ranged (?:weapon|spell) attack\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern ALLY_TARGET_PATTERN =
            Pattern.compile("\\b(allies|ally|friendly creature|friendly creatures|another creature you can see)\\b",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern DEFENSIVE_SAVE_ADVANTAGE_PATTERN =
            Pattern.compile("advantage on [^.]*saving throws", Pattern.CASE_INSENSITIVE);
    private static final Pattern DEFENSIVE_PRONE_PATTERN =
            Pattern.compile("(would knock it prone|can't be knocked prone|cannot be knocked prone)",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern PASSIVE_UTILITY_PATTERN =
            Pattern.compile("(can scent|can smell|detects?|knows the location|can sense|passive)",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern MULTI_TARGET_OFFENSE_PATTERN =
            Pattern.compile("(each creature|each enemy|up to \\d+ creatures|creatures? of .* choice|all creatures)",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern AOE_SHAPE_PATTERN =
            Pattern.compile("(cone|radius|line|cube|sphere|cylinder)", Pattern.CASE_INSENSITIVE);
    private static final Pattern OFFENSIVE_CONTROL_PATTERN =
            Pattern.compile("(target .*?(restrained|grappled|frightened|charmed|paralyzed|prone|blinded|stunned|petrified|incapacitated)"
                    + "|becomes? .*?(restrained|grappled|frightened|charmed|paralyzed|prone|blinded|stunned|petrified|incapacitated)"
                    + "|can't take reactions|speed becomes 0)", Pattern.CASE_INSENSITIVE);
    private static final Pattern OFFENSIVE_MOBILITY_PATTERN =
            Pattern.compile("(teleport|move up to|moves up to|without provoking|disengage|fly through|burrow through)",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern STEALTH_PATTERN =
            Pattern.compile("\\b(stealth|stealthy|sneak|sneaky|hidden|unseen)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern HIDE_PATTERN =
            Pattern.compile("\\b(hide|hides|hidden from view|take the hide action)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern INVISIBILITY_PATTERN =
            Pattern.compile("\\b(invisible|becomes invisible|turns invisible|is invisible)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern OBSCUREMENT_PATTERN =
            Pattern.compile("(darkness|heavily obscured|obscured|fog cloud|shadowy|magical darkness|smoke)", Pattern.CASE_INSENSITIVE);
    private static final Pattern FORCED_MOVEMENT_PATTERN =
            Pattern.compile("(pushed?\\s+\\d+|pushed? up to|pulled?\\s+\\d+|knocked? back|moved? up to \\d+ feet|move[s]? the target|speed becomes 0|speed is reduced to 0|can't move|cannot move)",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern ALLY_ENABLE_PATTERN =
            Pattern.compile("(willing creature|ally|allies|friendly creature)[^.]*?(use its reaction|use their reaction|make one attack|move up to|switch places|teleport)",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern ALLY_COMMAND_PATTERN =
            Pattern.compile("(leadership|command(?:er)?|rally|war cry|bolster|inspire|captain's command|marshal)",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern DEFENSE_PATTERN =
            Pattern.compile("(resistance to|immune to|advantage on [^.]*saving throws|bonus to ac|disadvantage on attack rolls|protected by|warded)",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern TANK_PATTERN =
            Pattern.compile("(creatures? within .* disadvantage|must target|marks? the target|intercept|bodyguard|guardian|sentinel|protection)",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern BURST_SETUP_PATTERN =
            Pattern.compile("(assassinate|sneak attack|critical hit|surprised creature|has advantage on attack rolls|hide action as a bonus action|shadow stealth)",
                    Pattern.CASE_INSENSITIVE);

    private ActionFunctionTagger() {
        throw new AssertionError("No instances");
    }

    static ActionTags tag(ActionRow action) {
        String name = text(action.name());
        String description = sanitizeDescription(text(action.description()));
        String joined = (name + " " + description).toLowerCase(Locale.ROOT);
        boolean spellcastingBlock = containsAny(name.toLowerCase(Locale.ROOT), "spellcasting", "cast spell")
                || containsAny(joined, "spell save dc", "spell attacks", "cantrips (at will)", "1st level (");
        boolean mixedMeleeRanged = MELEE_OR_RANGED_PATTERN.matcher(joined).find();
        boolean supportSpellNames = containsSpellName(joined, SUPPORT_SPELL_NAMES);
        boolean healingSpellNames = containsSpellName(joined, HEALING_SPELL_NAMES);
        boolean controlSpellNames = containsSpellName(joined, CONTROL_SPELL_NAMES);
        boolean mobilitySpellNames = containsSpellName(joined, MOBILITY_SPELL_NAMES);
        boolean summonSpellNames = containsSpellName(joined, SUMMON_SPELL_NAMES);

        int isMelee = mixedMeleeRanged
                ? 0
                : containsAny(joined, "melee weapon attack", "melee spell attack", "reach ") ? 1 : 0;
        int isRanged = mixedMeleeRanged
                ? 0
                : containsAny(joined, "ranged weapon attack", "ranged spell attack") ? 1 : 0;
        int isMixedMeleeRanged = mixedMeleeRanged ? 1 : 0;
        int isAoe = isOffensiveAoe(joined) ? 1 : 0;
        int isBuff = isCombatSupport(joined) || supportSpellNames ? 1 : 0;
        int isHeal = containsAny(joined, "regain", "heals", "hit points", "temporary hit points") || healingSpellNames ? 1 : 0;
        int isControl = isCombatControl(joined) || controlSpellNames ? 1 : 0;
        int hasMobility = isCombatMobility(joined) || mobilitySpellNames ? 1 : 0;
        int hasSummon = containsAny(joined, "summon", "conjure", "creates") || summonSpellNames ? 1 : 0;
        int hasStealth = STEALTH_PATTERN.matcher(joined).find() ? 1 : 0;
        int hasHide = HIDE_PATTERN.matcher(joined).find() ? 1 : 0;
        int hasInvisibility = INVISIBILITY_PATTERN.matcher(joined).find() ? 1 : 0;
        int hasObscurement = OBSCUREMENT_PATTERN.matcher(joined).find() ? 1 : 0;
        int hasForcedMovement = FORCED_MOVEMENT_PATTERN.matcher(joined).find() ? 1 : 0;
        int hasAllyEnable = ALLY_ENABLE_PATTERN.matcher(joined).find() ? 1 : 0;
        int hasAllyCommand = ALLY_COMMAND_PATTERN.matcher(joined).find() ? 1 : 0;
        int hasDefense = (DEFENSE_PATTERN.matcher(joined).find() || isPassiveDefense(joined)) ? 1 : 0;
        int hasTank = TANK_PATTERN.matcher(joined).find() ? 1 : 0;
        int hasBurstSetup = BURST_SETUP_PATTERN.matcher(joined).find() ? 1 : 0;
        int isSpellcasting = containsAny(joined,
                "spellcasting", "innate spellcasting", "spell attack", "cantrip", "spell save dc") ? 1 : 0;
        double rangedIdentityWeight = rangedIdentityWeight(name.toLowerCase(Locale.ROOT), joined, isRanged, isMixedMeleeRanged);
        int recharge = containsAny(joined, "recharge") ? 1 : 0;
        int isPassiveDefense = isPassiveDefense(joined) ? 1 : 0;
        int isPureUtility = isPureUtility(joined, isMelee, isRanged, isMixedMeleeRanged, isAoe, isBuff, isHeal, isControl, hasMobility, hasSummon) ? 1 : 0;
        int isOffensiveCombatOption = isOffensiveCombatOption(joined, action.actionType(), isMelee, isRanged, isMixedMeleeRanged, isAoe, isControl) ? 1 : 0;
        int isSupportCombatOption = (isBuff > 0 || isHeal > 0 || hasSummon > 0) && isPureUtility == 0 ? 1 : 0;

        int lineCount = estimateLineCount(description);
        int complexity = estimateComplexity(lineCount, isAoe, isBuff, isHeal, isControl, hasMobility, hasSummon, recharge);

        double expectedUses = "trait".equals(action.actionType())
                ? 0.0
                : "legendary_action".equals(action.actionType())
                ? 1.0
                : "bonus_action".equals(action.actionType()) || "reaction".equals(action.actionType())
                ? 0.6
                : 1.0;

        return new ActionTags(
                joined,
                isMelee,
                isRanged,
                isMixedMeleeRanged,
                isAoe,
                isBuff,
                isHeal,
                isControl,
                hasMobility,
                hasSummon,
                hasStealth,
                hasHide,
                hasInvisibility,
                hasObscurement,
                hasForcedMovement,
                hasAllyEnable,
                hasAllyCommand,
                hasDefense,
                hasTank,
                hasBurstSetup,
                isSpellcasting,
                isOffensiveCombatOption,
                isSupportCombatOption,
                isPassiveDefense,
                isPureUtility,
                rangedIdentityWeight,
                recharge,
                lineCount,
                complexity,
                expectedUses);
    }

    private static boolean isOffensiveAoe(String joined) {
        return MULTI_TARGET_OFFENSE_PATTERN.matcher(joined).find()
                || (AOE_SHAPE_PATTERN.matcher(joined).find()
                && (containsAny(joined, "damage", "saving throw", "hit:") || OFFENSIVE_CONTROL_PATTERN.matcher(joined).find()));
    }

    private static boolean isCombatSupport(String joined) {
        if (DEFENSIVE_SAVE_ADVANTAGE_PATTERN.matcher(joined).find() || DEFENSIVE_PRONE_PATTERN.matcher(joined).find()) {
            return false;
        }
        return ALLY_TARGET_PATTERN.matcher(joined).find()
                && containsAny(joined, "advantage", "bonus to", "gains", "inspire", "leadership", "temporary hit points", "regain");
    }

    private static boolean isCombatControl(String joined) {
        if (DEFENSIVE_PRONE_PATTERN.matcher(joined).find()) {
            return false;
        }
        return OFFENSIVE_CONTROL_PATTERN.matcher(joined).find();
    }

    private static boolean isCombatMobility(String joined) {
        return OFFENSIVE_MOBILITY_PATTERN.matcher(joined).find();
    }

    private static boolean isPassiveDefense(String joined) {
        return DEFENSIVE_SAVE_ADVANTAGE_PATTERN.matcher(joined).find()
                || DEFENSIVE_PRONE_PATTERN.matcher(joined).find()
                || containsAny(joined, "resistance to", "immune to", "immunity to", "advantage on saving throws");
    }

    private static boolean isPureUtility(
            String joined,
            int isMelee,
            int isRanged,
            int isMixedMeleeRanged,
            int isAoe,
            int isBuff,
            int isHeal,
            int isControl,
            int hasMobility,
            int hasSummon) {
        if (PASSIVE_UTILITY_PATTERN.matcher(joined).find()) {
            return true;
        }
        return isMelee == 0
                && isRanged == 0
                && isMixedMeleeRanged == 0
                && isAoe == 0
                && isBuff == 0
                && isHeal == 0
                && isControl == 0
                && hasSummon == 0
                && hasMobility == 0;
    }

    private static boolean isOffensiveCombatOption(
            String joined,
            String actionType,
            int isMelee,
            int isRanged,
            int isMixedMeleeRanged,
            int isAoe,
            int isControl) {
        if ("trait".equals(actionType) && !containsAny(joined, "hit:", "damage", "saving throw", "attack")) {
            return false;
        }
        return isMelee > 0
                || isRanged > 0
                || isMixedMeleeRanged > 0
                || isAoe > 0
                || isControl > 0
                || containsAny(joined, "hit:", "damage", "saving throw", "attack");
    }

    private static boolean containsAny(String haystack, String... needles) {
        for (String needle : needles) {
            if (haystack.contains(needle)) return true;
        }
        return false;
    }

    private static boolean containsSpellName(String haystack, String[] spellNames) {
        for (String spellName : spellNames) {
            if (haystack.contains(spellName)) {
                return true;
            }
        }
        return false;
    }

    private static double rangedIdentityWeight(String name, String joined, int isRanged, int isMixedMeleeRanged) {
        if (isRanged == 0 && isMixedMeleeRanged == 0) {
            return 0.0;
        }
        boolean strongRanged = containsAny(name, STRONG_RANGED_NAME_HINTS) || containsAny(joined, STRONG_RANGED_NAME_HINTS);
        boolean lightRanged = containsAny(name, LIGHT_RANGED_NAME_HINTS) || containsAny(joined, LIGHT_RANGED_NAME_HINTS);
        boolean bruiserThrow = containsAny(name, BRUISER_THROW_HINTS) || containsAny(joined, BRUISER_THROW_HINTS);

        if (strongRanged && !bruiserThrow) {
            return isMixedMeleeRanged > 0 ? 0.95 : 1.0;
        }
        if (lightRanged && !bruiserThrow) {
            return isMixedMeleeRanged > 0 ? 0.65 : 0.75;
        }
        if (bruiserThrow) {
            return isMixedMeleeRanged > 0 ? 0.10 : 0.25;
        }
        if (isMixedMeleeRanged > 0) {
            return 0.30;
        }
        return isRanged > 0 ? 0.55 : 0.0;
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

    private static String sanitizeDescription(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return HABITAT_SUFFIX_PATTERN.matcher(value).replaceAll("").trim();
    }

    record ActionTags(
            String joinedText,
            int isMelee,
            int isRanged,
            int isMixedMeleeRanged,
            int isAoe,
            int isBuff,
            int isHeal,
            int isControl,
            int hasMobility,
            int hasSummon,
            int hasStealth,
            int hasHide,
            int hasInvisibility,
            int hasObscurement,
            int hasForcedMovement,
            int hasAllyEnable,
            int hasAllyCommand,
            int hasDefense,
            int hasTank,
            int hasBurstSetup,
            int isSpellcasting,
            int isOffensiveCombatOption,
            int isSupportCombatOption,
            int isPassiveDefense,
            int isPureUtility,
            double rangedIdentityWeight,
            int requiresRecharge,
            int estimatedRuleLines,
            int complexityPoints,
            double expectedUsesPerRound
    ) {}
}
