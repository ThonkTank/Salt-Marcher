package features.partyanalysis.service;

import features.partyanalysis.repository.EncounterPartyAnalysisRepository.ActionRow;
import features.partyanalysis.service.ActionFunctionTagger.ActionTags;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class ActionEffectivenessEvaluator {
    private static final double BASELINE_TARGET_AC = 15.0;
    private static final double BASELINE_SAVE_BONUS = 3.0;
    private static final double DEFAULT_EFFECT_DELIVERY = 0.65;
    private static final double AOE_TARGET_MULTIPLIER = 1.6;
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
    private static final Pattern NUMERIC_BONUS_PATTERN =
            Pattern.compile("bonus to [^.,;]*?([+-]?\\d+)", Pattern.CASE_INSENSITIVE);

    private ActionEffectivenessEvaluator() {
        throw new AssertionError("No instances");
    }

    static ActionRoleWeights evaluate(ActionRow action, ActionTags tags) {
        String text = tags.joinedText();
        double availabilityFactor = tags.requiresRecharge() > 0 ? RECHARGE_FACTOR : 1.0;
        double expectedUses = tags.expectedUsesPerRound() * availabilityFactor;
        double deliveryChance = effectDeliveryChance(action.toHitBonus(), extractSaveDc(text));
        double targetMultiplier = tags.isAoe() > 0 ? AOE_TARGET_MULTIPLIER : 1.0;

        double expectedDamage = estimateDamage(text, deliveryChance, targetMultiplier, expectedUses);
        double controlEffect = estimateControlEffect(text, deliveryChance, targetMultiplier, expectedUses, tags);
        double supportEffect = estimateSupportEffect(text, expectedUses, targetMultiplier, tags);
        double mobilityEffect = tags.hasMobility() > 0 ? expectedUses * (tags.isMelee() > 0 || tags.isRanged() > 0 ? 2.5 : 1.2) : 0.0;
        double spellcastingEffect = tags.isSpellcasting() > 0 ? SPELLCASTING_UTILITY * expectedUses : 0.0;

        double soldier = expectedDamage * (tags.isMelee() > 0 ? 1.0 : 0.20)
                + controlEffect * (tags.isMelee() > 0 ? 0.25 : 0.10);
        double archer = expectedDamage * (tags.isRanged() > 0 ? 1.0 : 0.0)
                + expectedDamage * (tags.isAoe() > 0 ? 0.20 : 0.0)
                + controlEffect * (tags.isRanged() > 0 ? 0.15 : 0.0);
        double controller = controlEffect
                + expectedDamage * (tags.isAoe() > 0 ? 0.25 : 0.05)
                + spellcastingEffect;
        double skirmisher = expectedDamage * (tags.isMelee() > 0 || tags.isRanged() > 0 ? 0.55 : 0.0)
                + mobilityEffect
                + controlEffect * 0.10;
        double support = supportEffect
                + (tags.hasSummon() > 0 ? SUMMON_EQUIVALENT * expectedUses : 0.0)
                + spellcastingEffect * 0.30;

        if (tags.isBuff() > 0 && supportEffect <= 0.0) {
            support += 3.0 * expectedUses;
        }
        if (tags.isControl() > 0 && controlEffect <= 0.0) {
            controller += 4.0 * expectedUses;
        }
        if (tags.isRanged() == 0 && tags.isMelee() == 0 && expectedDamage > 0.0) {
            soldier += expectedDamage * 0.35;
            archer += expectedDamage * 0.35;
        }
        if (tags.hasMobility() > 0 && (tags.isMelee() > 0 || tags.isRanged() > 0)) {
            skirmisher += expectedDamage * 0.35;
        }

        return new ActionRoleWeights(
                Math.max(0.0, soldier),
                Math.max(0.0, archer),
                Math.max(0.0, controller),
                Math.max(0.0, skirmisher),
                Math.max(0.0, support),
                expectedDamage,
                controlEffect,
                supportEffect);
    }

    private static double estimateDamage(String text, double deliveryChance, double targetMultiplier, double expectedUses) {
        double baseDamage = extractAverageNumber(text, AVERAGE_DAMAGE_PATTERN);
        if (baseDamage <= 0.0) {
            baseDamage = extractAverageNumber(text, FLAT_DAMAGE_PATTERN);
        }
        if (baseDamage <= 0.0) {
            baseDamage = extractDiceAverage(text, DICE_DAMAGE_PATTERN);
        }
        if (baseDamage <= 0.0) return 0.0;

        double saveAdjustment = text.contains("half as much damage") ? 0.5 + (deliveryChance * 0.5) : deliveryChance;
        return baseDamage * saveAdjustment * targetMultiplier * expectedUses;
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

    private static double effectDeliveryChance(Integer toHitBonus, Integer saveDc) {
        if (toHitBonus != null) {
            return clamp((21.0 - (BASELINE_TARGET_AC - toHitBonus)) / 20.0, 0.35, 0.95);
        }
        if (saveDc != null) {
            return clamp((saveDc - BASELINE_SAVE_BONUS - 1.0) / 20.0, 0.35, 0.90);
        }
        return DEFAULT_EFFECT_DELIVERY;
    }

    private static Integer extractSaveDc(String text) {
        Matcher matcher = SAVE_DC_PATTERN.matcher(text);
        if (!matcher.find()) return null;
        return Integer.parseInt(matcher.group(1));
    }

    private static Integer extractNumericBonus(String text) {
        Matcher matcher = NUMERIC_BONUS_PATTERN.matcher(text);
        if (!matcher.find()) return null;
        return Integer.parseInt(matcher.group(1));
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

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    record ActionRoleWeights(
            double soldierScore,
            double archerScore,
            double controllerScore,
            double skirmisherScore,
            double supportScore,
            double expectedDamage,
            double controlEffect,
            double supportEffect
    ) {}
}
