package features.partyanalysis.service;

import features.encounter.calibration.service.EncounterCalibrationService;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.encounter.calibration.service.EncounterCalibrationService.SaveAbility;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.ActionRow;
import features.partyanalysis.service.ActionFunctionTagger.ActionTags;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class ActionEffectivenessEvaluator {
    private static final EncounterPartyBenchmarks DEFAULT_BENCHMARKS =
            EncounterCalibrationService.partyBenchmarksForAverageLevel(5, 4);
    private static final double DEFAULT_EFFECT_DELIVERY = 0.65;
    private static final double RECHARGE_FACTOR = 0.75;
    private static final double CONTROL_POINT_VALUE = 6.0;
    private static final double SUMMON_EQUIVALENT = 6.0;
    private static final double SPELLCASTING_UTILITY = 1.2;

    private static final Pattern AVERAGE_DAMAGE_PATTERN =
            Pattern.compile("(\\d+)\\s*\\([^)]*\\)\\s*[a-z]+\\s+damage", Pattern.CASE_INSENSITIVE);
    private static final Pattern FLAT_DAMAGE_PATTERN =
            Pattern.compile("(?:hit:|takes|take|deals)\\s*(\\d+)\\s+[a-z]+\\s+damage", Pattern.CASE_INSENSITIVE);
    private static final Pattern DICE_DAMAGE_PATTERN =
            Pattern.compile("(\\d+)d(\\d+)(?:\\s*([+-])\\s*(\\d+))?\\s*[a-z]+\\s+damage", Pattern.CASE_INSENSITIVE);
    private static final Pattern AVERAGE_HEAL_PATTERN =
            Pattern.compile("(\\d+)\\s*\\([^)]*\\)\\s*(?:temporary\\s+)?hit points?", Pattern.CASE_INSENSITIVE);
    private static final Pattern FLAT_HEAL_PATTERN =
            Pattern.compile("(?:regain|heals?|gains?)\\s*(\\d+)\\s*(?:temporary\\s+)?hit points?", Pattern.CASE_INSENSITIVE);
    private static final Pattern DICE_HEAL_PATTERN =
            Pattern.compile("(\\d+)d(\\d+)(?:\\s*([+-])\\s*(\\d+))?\\s*(?:temporary\\s+)?hit points?", Pattern.CASE_INSENSITIVE);
    private static final Pattern SAVE_DC_PATTERN =
            Pattern.compile("dc\\s*(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern SAVE_ABILITY_PATTERN =
            Pattern.compile("\\b(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\\s+saving throw\\b",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern NUMERIC_BONUS_PATTERN =
            Pattern.compile("bonus to [^.,;]*?([+-]?\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern LIMITED_USE_PATTERN =
            Pattern.compile("(\\d+)\\s*/\\s*(?:day|long rest|short rest)", Pattern.CASE_INSENSITIVE);
    private static final Pattern RECHARGE_PATTERN =
            Pattern.compile("recharge\\s*(\\d)(?:\\s*[--]\\s*(\\d))?", Pattern.CASE_INSENSITIVE);
    private static final Pattern LEGENDARY_COST_PATTERN =
            Pattern.compile("costs\\s*(\\d+)\\s*actions?", Pattern.CASE_INSENSITIVE);

    private ActionEffectivenessEvaluator() {
        throw new AssertionError("No instances");
    }

    static ActionRoleWeights evaluate(ActionRow action, ActionTags tags) {
        return evaluate(action, tags, parse(action, tags), DEFAULT_BENCHMARKS);
    }

    static ActionRoleWeights evaluate(ActionRow action, ActionTags tags, EncounterPartyBenchmarks party) {
        return evaluate(action, tags, parse(action, tags), party);
    }

    static ParsedActionMetrics parse(ActionRow action, ActionTags tags) {
        String text = tags.joinedText();
        Integer saveDc = extractSaveDc(text);
        SaveAbility saveAbility = extractSaveAbility(text);
        boolean halfOnSuccess = text.contains("half as much damage");
        String targetingHint = targetingHint(text, tags);
        Integer[] rechargeWindow = parseRechargeWindow(text);
        return new ParsedActionMetrics(
                inferActionChannel(action),
                saveDc,
                saveAbility == null ? null : saveAbility.name(),
                halfOnSuccess ? 1 : 0,
                targetingHint,
                extractBaseDamage(text),
                conditionalDamageFactor(text),
                parseLegendaryCost(action, text),
                parseLimitedUses(text),
                rechargeWindow[0],
                rechargeWindow[1],
                isRecurringDamageTrait(action, text) ? 1 : 0,
                parseCastSpellLevelCap(text));
    }

    static ActionRoleWeights evaluate(
            ActionRow action,
            ActionTags tags,
            ParsedActionMetrics metrics,
            EncounterPartyBenchmarks party) {
        String text = tags.joinedText();
        double availabilityFactor = tags.requiresRecharge() > 0 ? RECHARGE_FACTOR : 1.0;
        double expectedUses = tags.expectedUsesPerRound() * availabilityFactor;
        DeliveryEstimate delivery = deliveryEstimate(action, metrics, text, party);
        double targetMultiplier = targetMultiplier(metrics.targetingHint(), tags.isAoe(), party);
        double expectedDamage = estimateDamage(metrics, delivery, targetMultiplier, 1.0) * expectedUses;
        double controlEffect = estimateControlEffect(text, delivery.deliveryChance(), targetMultiplier, expectedUses, tags);
        double supportEffect = estimateSupportEffect(text, expectedUses, targetMultiplier, tags);
        double mobilityEffect = tags.hasMobility() > 0 ? expectedUses * (tags.isMelee() > 0 || tags.isRanged() > 0 ? 2.5 : 1.2) : 0.0;
        double spellcastingEffect = tags.isSpellcasting() > 0 ? SPELLCASTING_UTILITY * expectedUses : 0.0;
        double stealthEffect = (tags.hasStealth() + tags.hasHide() + tags.hasInvisibility() + tags.hasObscurement()) * expectedUses;
        double burstSetupEffect = tags.hasBurstSetup() > 0 ? 5.0 * expectedUses : 0.0;
        double allyEnableEffect = (tags.hasAllyEnable() * 5.5 + tags.hasAllyCommand() * 4.0) * expectedUses;
        double defenseEffect = (tags.hasDefense() * 3.5 + tags.hasTank() * 4.0) * expectedUses;
        double forcedMovementEffect = tags.hasForcedMovement() > 0 ? 4.0 * delivery.deliveryChance() * expectedUses : 0.0;

        double ambusher = expectedDamage * (tags.hasStealth() > 0 || tags.hasHide() > 0 || tags.hasInvisibility() > 0 ? 0.95 : 0.10)
                + stealthEffect * 1.15
                + burstSetupEffect
                + mobilityEffect * 0.20
                + (tags.isControl() > 0 ? 0.15 * controlEffect : 0.0);
        double artillery = expectedDamage * ((tags.isRanged() > 0 || tags.isMixedMeleeRanged() > 0) ? (0.90 + (tags.rangedIdentityWeight() * 0.35)) : 0.0)
                + expectedDamage * (tags.isAoe() > 0 ? 0.08 : 0.0)
                + mobilityEffect * 0.12
                + forcedMovementEffect * 0.08
                - supportEffect * 0.08;
        double brute = expectedDamage * (tags.isMelee() > 0 || tags.isMixedMeleeRanged() > 0 ? 1.05 : 0.15)
                + delivery.deliveryChance() * 4.0 * expectedUses
                + (tags.isAoe() > 0 ? expectedDamage * 0.04 : 0.0)
                - mobilityEffect * 0.10
                - supportEffect * 0.15;
        double controller = controlEffect * 1.15
                + expectedDamage * (tags.isAoe() > 0 ? 0.35 : 0.02)
                + forcedMovementEffect
                + spellcastingEffect
                + (tags.isAoe() > 0 ? 1.0 * expectedUses : 0.0);
        double leader = supportEffect * 0.75
                + allyEnableEffect * 1.15
                + (tags.hasSummon() > 0 ? SUMMON_EQUIVALENT * expectedUses : 0.0)
                + spellcastingEffect * 0.20
                + (tags.estimatedRuleLines() >= 4 ? 1.0 * expectedUses : 0.0);
        double skirmisher = expectedDamage * (tags.isMelee() > 0 || tags.isRanged() > 0 ? 0.65 : 0.0)
                + mobilityEffect * 1.15
                + stealthEffect * 0.30
                + controlEffect * 0.06;
        double support = supportEffect * 1.10
                + (tags.hasSummon() > 0 ? SUMMON_EQUIVALENT * expectedUses : 0.0)
                + allyEnableEffect * 0.35
                + spellcastingEffect * 0.25;
        double soldier = expectedDamage * (tags.isMelee() > 0 ? 1.00 : 0.12)
                + defenseEffect
                + controlEffect * (tags.isMelee() > 0 ? 0.12 : 0.04);

        if (tags.isBuff() > 0 && supportEffect <= 0.0) {
            support += 3.0 * expectedUses;
        }
        if (tags.isControl() > 0 && controlEffect <= 0.0) {
            controller += 4.0 * expectedUses;
        }
        if (tags.hasAllyEnable() > 0 || tags.hasAllyCommand() > 0) {
            leader += 3.5 * expectedUses;
            support += 1.5 * expectedUses;
        }
        if (tags.hasStealth() > 0 || tags.hasHide() > 0 || tags.hasInvisibility() > 0 || tags.hasObscurement() > 0) {
            ambusher += expectedDamage * 0.35;
        }
        if (tags.hasBurstSetup() > 0) {
            ambusher += expectedDamage * 0.45;
            skirmisher += expectedDamage * 0.12;
        }
        if (tags.hasDefense() > 0 || tags.hasTank() > 0) {
            soldier += 2.5 * expectedUses;
        }
        if (tags.isRanged() == 0 && tags.isMelee() == 0 && expectedDamage > 0.0) {
            soldier += expectedDamage * 0.20;
            artillery += expectedDamage * 0.15;
        }
        if (tags.hasMobility() > 0 && (tags.isMelee() > 0 || tags.isRanged() > 0)) {
            skirmisher += expectedDamage * 0.45;
        }
        if (tags.isAoe() > 0 && tags.isRanged() > 0) {
            controller += expectedDamage * 0.10;
            artillery -= expectedDamage * 0.05;
        }
        if (tags.isBuff() > 0 || tags.isHeal() > 0) {
            soldier -= expectedDamage * 0.04;
            artillery -= expectedDamage * 0.05;
            brute -= expectedDamage * 0.10;
        }

        return new ActionRoleWeights(
                Math.max(0.0, ambusher),
                Math.max(0.0, artillery),
                Math.max(0.0, brute),
                Math.max(0.0, controller),
                Math.max(0.0, leader),
                Math.max(0.0, skirmisher),
                Math.max(0.0, soldier),
                Math.max(0.0, support),
                expectedDamage,
                controlEffect,
                supportEffect);
    }

    static double expectedDamagePerUse(ActionRow action, ActionTags tags) {
        return expectedDamagePerUse(action, tags, parse(action, tags), DEFAULT_BENCHMARKS);
    }

    static double expectedDamagePerUse(ActionRow action, ActionTags tags, EncounterPartyBenchmarks party) {
        return expectedDamagePerUse(action, tags, parse(action, tags), party);
    }

    static double expectedDamagePerUse(
            ActionRow action,
            ActionTags tags,
            ParsedActionMetrics metrics,
            EncounterPartyBenchmarks party) {
        DeliveryEstimate delivery = deliveryEstimate(action, metrics, tags.joinedText(), party);
        double targetMultiplier = targetMultiplier(metrics.targetingHint(), tags.isAoe(), party);
        return estimateDamage(metrics, delivery, targetMultiplier, 1.0);
    }

    private static double estimateDamage(
            ParsedActionMetrics metrics,
            DeliveryEstimate delivery,
            double targetMultiplier,
            double expectedUses) {
        double baseDamage = metrics.baseDamage();
        if (baseDamage <= 0.0) return 0.0;
        return baseDamage * delivery.expectedDamageFactor()
                * targetMultiplier
                * metrics.conditionalDamageFactor()
                * expectedUses;
    }

    private static double estimateControlEffect(String text,
                                                double deliveryChance,
                                                double targetMultiplier,
                                                double expectedUses,
                                                ActionTags tags) {
        double severity = 0.0;
        severity += text.contains("stunned") ? 1.7 : 0.0;
        severity += text.contains("paralyzed") ? 1.8 : 0.0;
        severity += text.contains("petrified") ? 2.0 : 0.0;
        severity += text.contains("incapacitated") ? 1.3 : 0.0;
        severity += text.contains("restrained") ? 1.1 : 0.0;
        severity += text.contains("grappled") ? 0.9 : 0.0;
        severity += text.contains("frightened") ? 0.9 : 0.0;
        severity += text.contains("charmed") ? 0.8 : 0.0;
        severity += text.contains("blinded") ? 1.0 : 0.0;
        severity += text.contains("prone") ? 0.6 : 0.0;
        if (severity <= 0.0 && tags.isControl() > 0) {
            severity = 0.8;
        }
        return severity * CONTROL_POINT_VALUE * deliveryChance * targetMultiplier * expectedUses;
    }

    private static double estimateSupportEffect(String text,
                                                double expectedUses,
                                                double targetMultiplier,
                                                ActionTags tags) {
        double healing = extractAverageNumber(text, AVERAGE_HEAL_PATTERN);
        if (healing <= 0.0) {
            healing = extractAverageNumber(text, FLAT_HEAL_PATTERN);
        }
        if (healing <= 0.0) {
            healing = extractDiceAverage(text, DICE_HEAL_PATTERN);
        }

        double buffEquivalent = 0.0;
        if (text.contains("advantage")) buffEquivalent += 5.0;
        if (text.contains("temporary hit points")) buffEquivalent += healing * 0.65;
        Integer numericBonus = extractNumericBonus(text);
        if (numericBonus != null) {
            buffEquivalent += Math.max(0, numericBonus) * 2.5;
        }
        if (containsAny(text, "leadership", "inspire", "allies", "command", "rally", "bolster")) {
            buffEquivalent += 4.0;
        }
        if (tags.hasSummon() > 0) {
            buffEquivalent += SUMMON_EQUIVALENT;
        }
        if (tags.isAoe() > 0 && (tags.isBuff() > 0 || tags.isHeal() > 0)) {
            buffEquivalent *= targetMultiplier;
            healing *= targetMultiplier;
        }

        return (healing + buffEquivalent) * expectedUses;
    }

    private static DeliveryEstimate deliveryEstimate(
            ActionRow action,
            ParsedActionMetrics metrics,
            String text,
            EncounterPartyBenchmarks party) {
        double deliveryChance = effectDeliveryChance(
                action.toHitBonus(),
                metrics.saveDc(),
                parseEnumOrNull(metrics.saveAbility(), SaveAbility.class),
                text,
                party);
        boolean halfOnSuccess = metrics.halfDamageOnSave() > 0;
        return new DeliveryEstimate(deliveryChance, halfOnSuccess ? (0.5 + (deliveryChance * 0.5)) : deliveryChance);
    }

    private static double effectDeliveryChance(
            Integer toHitBonus,
            Integer saveDc,
            SaveAbility saveAbility,
            String text,
            EncounterPartyBenchmarks party) {
        if (toHitBonus != null) {
            return hitChance(toHitBonus, party.targetAcStandard());
        }
        if (saveDc != null) {
            double successChance = saveSuccessChance(saveDc, party.saveBonus(saveAbility != null ? saveAbility : fallbackSaveAbility(text)));
            return 1.0 - successChance;
        }
        return DEFAULT_EFFECT_DELIVERY;
    }

    private static double targetMultiplier(String targetingHint, int isAoe, EncounterPartyBenchmarks party) {
        if (isAoe <= 0) {
            return 1.0;
        }
        if ("LARGE_AOE".equals(targetingHint)) {
            return clamp(party.partySize() * 0.72, 1.5, 3.4);
        }
        return clamp(1.0 + (party.partySize() * 0.35), 1.2, 2.2);
    }

    private static String targetingHint(String text, ActionTags tags) {
        if (tags.isAoe() <= 0) {
            return "SINGLE";
        }
        String lower = text.toLowerCase(Locale.ROOT);
        if (containsAny(lower, "20-foot", "30-foot", "40-foot", "60-foot", "radius", "sphere", "cylinder")) {
            return "LARGE_AOE";
        }
        return "SMALL_AOE";
    }

    private static Integer extractSaveDc(String text) {
        Matcher matcher = SAVE_DC_PATTERN.matcher(text);
        if (!matcher.find()) return null;
        return Integer.parseInt(matcher.group(1));
    }

    private static SaveAbility extractSaveAbility(String text) {
        Matcher matcher = SAVE_ABILITY_PATTERN.matcher(text);
        if (!matcher.find()) {
            return null;
        }
        return switch (matcher.group(1).toLowerCase(Locale.ROOT)) {
            case "strength", "str" -> SaveAbility.STR;
            case "dexterity", "dex" -> SaveAbility.DEX;
            case "constitution", "con" -> SaveAbility.CON;
            case "intelligence", "int" -> SaveAbility.INT;
            case "wisdom", "wis" -> SaveAbility.WIS;
            case "charisma", "cha" -> SaveAbility.CHA;
            default -> null;
        };
    }

    private static Integer extractNumericBonus(String text) {
        Matcher matcher = NUMERIC_BONUS_PATTERN.matcher(text);
        if (!matcher.find()) return null;
        return Integer.parseInt(matcher.group(1));
    }

    private static double extractBaseDamage(String text) {
        double baseDamage = extractAverageNumber(text, AVERAGE_DAMAGE_PATTERN);
        if (baseDamage <= 0.0) {
            baseDamage = extractAverageNumber(text, FLAT_DAMAGE_PATTERN);
        }
        if (baseDamage <= 0.0) {
            baseDamage = extractDiceAverage(text, DICE_DAMAGE_PATTERN);
        }
        return baseDamage;
    }

    private static double extractAverageNumber(String text, Pattern pattern) {
        Matcher matcher = pattern.matcher(text);
        double total = 0.0;
        while (matcher.find()) {
            total += Double.parseDouble(matcher.group(1));
        }
        return total;
    }

    private static double extractDiceAverage(String text, Pattern pattern) {
        Matcher matcher = pattern.matcher(text);
        double total = 0.0;
        while (matcher.find()) {
            int count = Integer.parseInt(matcher.group(1));
            int sides = Integer.parseInt(matcher.group(2));
            double average = count * ((sides + 1) / 2.0);
            String sign = matcher.group(3);
            String modifier = matcher.group(4);
            if (sign != null && modifier != null) {
                int value = Integer.parseInt(modifier);
                average += "-".equals(sign) ? -value : value;
            }
            total += average;
        }
        return total;
    }

    private static boolean containsAny(String haystack, String... needles) {
        String lower = haystack.toLowerCase(Locale.ROOT);
        for (String needle : needles) {
            if (lower.contains(needle)) return true;
        }
        return false;
    }

    private static SaveAbility fallbackSaveAbility(String text) {
        String lower = text == null ? "" : text.toLowerCase(Locale.ROOT);
        if (containsAny(lower, "mind", "psychic", "frightened", "charmed")) return SaveAbility.WIS;
        if (containsAny(lower, "poison", "disease", "necrotic", "paralyzed")) return SaveAbility.CON;
        if (containsAny(lower, "line", "cone", "fire", "lightning", "explodes")) return SaveAbility.DEX;
        return SaveAbility.DEX;
    }

    private static double conditionalDamageFactor(String text) {
        String lower = text == null ? "" : text.toLowerCase(Locale.ROOT);
        double factor = 1.0;
        if (containsAny(lower, "if the target is", "if it fails by 5 or more", "while grappled", "until the grapple ends")) {
            factor *= 0.6;
        }
        if (containsAny(lower, "at the start of", "at the end of", "on a later turn", "next turn")) {
            factor *= 0.7;
        }
        return factor;
    }

    private static String inferActionChannel(ActionRow action) {
        if (action == null) {
            return null;
        }
        String description = action.description() == null ? "" : action.description();
        if ("legendary_action".equals(action.actionType())) {
            return "LEGENDARY";
        }
        String lower = description.toLowerCase(Locale.ROOT);
        if (lower.contains("as a reaction")) {
            return "REACTION";
        }
        if (lower.contains("as a bonus action")) {
            return "BONUS_ACTION";
        }
        if (lower.contains("as an action")) {
            return "ACTION";
        }
        return switch (action.actionType()) {
            case "action" -> "ACTION";
            case "bonus_action" -> "BONUS_ACTION";
            case "reaction" -> "REACTION";
            case "legendary_action" -> "LEGENDARY";
            case "trait" -> "PASSIVE";
            default -> null;
        };
    }

    private static int parseLegendaryCost(ActionRow action, String text) {
        if (action == null || !"legendary_action".equals(action.actionType())) {
            return 1;
        }
        Matcher matcher = LEGENDARY_COST_PATTERN.matcher(text);
        if (!matcher.find()) {
            return 1;
        }
        return Math.max(1, Integer.parseInt(matcher.group(1)));
    }

    private static Integer parseLimitedUses(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher matcher = LIMITED_USE_PATTERN.matcher(text);
        if (!matcher.find()) {
            return null;
        }
        return Integer.parseInt(matcher.group(1));
    }

    private static Integer[] parseRechargeWindow(String text) {
        if (text == null || text.isBlank()) {
            return new Integer[]{null, null};
        }
        Matcher matcher = RECHARGE_PATTERN.matcher(text);
        if (!matcher.find()) {
            return new Integer[]{null, null};
        }
        Integer min = Integer.parseInt(matcher.group(1));
        Integer max = matcher.group(2) == null ? min : Integer.parseInt(matcher.group(2));
        return new Integer[]{min, max};
    }

    private static boolean isRecurringDamageTrait(ActionRow action, String text) {
        if (action == null || !"trait".equals(action.actionType())) {
            return false;
        }
        String lower = text == null ? "" : text.toLowerCase(Locale.ROOT);
        return lower.contains("starts its turn")
                || lower.contains("start of each turn")
                || lower.contains("at the start of")
                || lower.contains("ends its turn")
                || lower.contains("when a creature enters")
                || lower.contains("when a creature touches")
                || lower.contains("hits it with a melee attack");
    }

    private static Integer parseCastSpellLevelCap(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher matcher = Pattern.compile(
                "casts? a spell of (\\d+)(?:st|nd|rd|th) level or lower",
                Pattern.CASE_INSENSITIVE).matcher(text);
        if (!matcher.find()) {
            return null;
        }
        return Integer.parseInt(matcher.group(1));
    }

    private static <E extends Enum<E>> E parseEnumOrNull(String raw, Class<E> enumType) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(enumType, raw);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private static double hitChance(double attackBonus, double targetAc) {
        double needed = targetAc - attackBonus;
        double raw = (21.0 - needed) / 20.0;
        return clamp(raw, 0.05, 0.95);
    }

    private static double saveSuccessChance(int saveDc, double saveBonus) {
        double needed = saveDc - saveBonus;
        double raw = (21.0 - needed) / 20.0;
        return clamp(raw, 0.05, 0.95);
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    record ActionRoleWeights(
            double ambusherScore,
            double artilleryScore,
            double bruteScore,
            double controllerScore,
            double leaderScore,
            double skirmisherScore,
            double soldierScore,
            double supportScore,
            double expectedDamage,
            double controlEffect,
            double supportEffect
    ) {}

    record ParsedActionMetrics(
            String actionChannel,
            Integer saveDc,
            String saveAbility,
            int halfDamageOnSave,
            String targetingHint,
            double baseDamage,
            double conditionalDamageFactor,
            int legendaryActionCost,
            Integer limitedUses,
            Integer rechargeMin,
            Integer rechargeMax,
            int recurringDamageTrait,
            Integer spellLevelCap
    ) {}

    private record DeliveryEstimate(
            double deliveryChance,
            double expectedDamageFactor
    ) {}
}
