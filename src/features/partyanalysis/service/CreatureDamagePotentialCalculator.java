package features.partyanalysis.service;

import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.encounter.calibration.service.EncounterCalibrationService.SaveAbility;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.ParsedActionProfile;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class CreatureDamagePotentialCalculator {
    private static final double REACTION_AVAILABILITY = 0.5;
    private static final double REACTION_ACTION_WEIGHT = 0.5;

    private CreatureDamagePotentialCalculator() {
        throw new AssertionError("No instances");
    }

    public static DamagePotentialSummary summarize(
            Iterable<ParsedActionProfile> actions,
            int legendaryActionBudget,
            double survivabilityActions,
            EncounterPartyBenchmarks party) {
        List<ParsedActionProfile> rows = copy(actions);
        double lifetimeRounds = Math.max(1.0, survivabilityActions / Math.max(1.0, party.actionsPerRound()));
        double rounds = Math.max(1.0, Math.ceil(lifetimeRounds));
        OptionSet options = buildOptions(rows, legendaryActionBudget, rounds, party);

        EnumMap<Channel, Double> remainingSlots = initialChannelSlots(rounds, legendaryActionBudget);
        double spellDamage = allocateSpellDamage(options.spellOptions(), remainingSlots);
        double actionDamage = allocateDamage(options.offensiveOptions(), Channel.ACTION, remainingSlots);
        double bonusDamage = allocateDamage(options.offensiveOptions(), Channel.BONUS_ACTION, remainingSlots);
        double reactionDamage = allocateDamage(options.offensiveOptions(), Channel.REACTION, remainingSlots);
        double legendaryDamage = allocateDamage(options.offensiveOptions(), Channel.LEGENDARY, remainingSlots);
        double passiveDamage = allocatePassiveDamage(options.offensiveOptions(), rounds);
        double totalExpectedDamage = spellDamage + actionDamage + bonusDamage + reactionDamage + legendaryDamage + passiveDamage;
        double normalizedDamagePotential = totalExpectedDamage / Math.max(1.0, party.partyHpPool());

        double actionUnitsPerRound = 1.0;
        if (hasChannel(options.offensiveOptions(), Channel.BONUS_ACTION) || hasChannel(options.spellOptions(), Channel.BONUS_ACTION)) {
            actionUnitsPerRound += 1.0;
        }
        if (hasChannel(options.offensiveOptions(), Channel.REACTION) || hasChannel(options.spellOptions(), Channel.REACTION)) {
            actionUnitsPerRound += REACTION_ACTION_WEIGHT;
        }
        actionUnitsPerRound += legendaryActionUnits(options, legendaryActionBudget);

        return new DamagePotentialSummary(totalExpectedDamage, normalizedDamagePotential, actionUnitsPerRound);
    }

    private static OptionSet buildOptions(
            List<ParsedActionProfile> actions,
            int legendaryActionBudget,
            double rounds,
            EncounterPartyBenchmarks party) {
        List<OffensiveOption> offensiveOptions = new ArrayList<>();
        List<SpellOption> spellOptions = new ArrayList<>();
        List<SpellOption> preparedSpellOptions = new ArrayList<>();
        for (ParsedActionProfile action : actions) {
            preparedSpellOptions.addAll(decodeStoredSpellOptions(action.spellOptionsProfile()));
        }
        for (ParsedActionProfile action : actions) {
            ActionOptions actionOptions = toActionOptions(action, actions, preparedSpellOptions, legendaryActionBudget, rounds, party);
            offensiveOptions.addAll(actionOptions.offensiveOptions());
            spellOptions.addAll(actionOptions.spellOptions());
        }
        return new OptionSet(offensiveOptions, spellOptions);
    }

    private static ActionOptions toActionOptions(
            ParsedActionProfile action,
            List<ParsedActionProfile> allActions,
            List<SpellOption> preparedSpellOptions,
            int legendaryActionBudget,
            double rounds,
            EncounterPartyBenchmarks party) {
        Channel channel = channelOf(action.actionChannel());
        if (channel == null) {
            return ActionOptions.EMPTY;
        }

        List<SpellOption> spellOptions = spellOptionsForAction(action, channel, preparedSpellOptions, rounds);
        if (!spellOptions.isEmpty()) {
            return new ActionOptions(List.of(), spellOptions);
        }

        double damagePerUse = expectedDamagePerUse(action, party);
        if (hasText(action.multiattackProfile())) {
            damagePerUse = estimateMultiattackDamage(action.multiattackProfile(), allActions, party);
        } else if ("trait".equals(action.actionType()) && action.recurringDamageTrait() == 0) {
            return ActionOptions.EMPTY;
        }
        if (damagePerUse <= 0.0) {
            return ActionOptions.EMPTY;
        }

        double maxUses = switch (channel) {
            case ACTION, BONUS_ACTION -> rounds;
            case REACTION -> rounds * REACTION_AVAILABILITY;
            case LEGENDARY -> rounds * Math.max(0, legendaryActionBudget);
            case PASSIVE -> rounds;
        };
        if (action.limitedUses() != null) {
            maxUses = Math.min(maxUses, action.limitedUses());
        }
        if (action.rechargeMin() != null) {
            maxUses = Math.min(maxUses, 1.0 + Math.max(0.0, rounds - 1.0) * expectedRefreshesPerRound(action));
        }
        if (maxUses <= 0.0) {
            return ActionOptions.EMPTY;
        }
        int slotCost = channel == Channel.LEGENDARY ? Math.max(1, action.legendaryActionCost()) : 1;
        return new ActionOptions(List.of(new OffensiveOption(channel, damagePerUse, maxUses, slotCost)), List.of());
    }

    private static List<SpellOption> spellOptionsForAction(
            ParsedActionProfile action,
            Channel channel,
            List<SpellOption> preparedSpellOptions,
            double rounds) {
        String lowerName = lower(action.name());
        if ("spellcasting".equals(lowerName) || "innate spellcasting".equals(lowerName)) {
            List<SpellOption> options = new ArrayList<>();
            for (SpellOption spellOption : decodeStoredSpellOptions(action.spellOptionsProfile())) {
                Channel spellChannel = channelOfSpell(spellOption.castingChannel());
                if (spellChannel == null) {
                    continue;
                }
                double maxUses = Math.min(rounds, spellOption.maxUses());
                options.add(spellOption.withChannelAndMaxUses(spellChannel, maxUses));
            }
            return options;
        }
        if ("cast spell".equals(lowerName)) {
            int levelCap = action.spellLevelCap() == null ? -1 : action.spellLevelCap();
            return preparedSpellOptions.stream()
                    .filter(option -> levelCap < 0 || option.spellLevel() <= levelCap)
                    .map(option -> option.withChannelAndCost(channel, Math.max(1, action.legendaryActionCost())))
                    .toList();
        }
        return List.of();
    }

    private static double estimateMultiattackDamage(
            String multiattackProfile,
            List<ParsedActionProfile> allActions,
            EncounterPartyBenchmarks party) {
        double total = 0.0;
        for (ActionProfileCodec.MultiattackComponent componentRef
                : ActionProfileCodec.decodeMultiattackProfile(multiattackProfile)) {
            ParsedActionProfile component = findActionById(allActions, componentRef.actionId());
            if (component != null) {
                total += componentRef.count() * expectedDamagePerUse(component, party);
            }
        }
        return total;
    }

    private static ParsedActionProfile findActionById(List<ParsedActionProfile> actions, long actionId) {
        for (ParsedActionProfile action : actions) {
            if (action.actionId() == actionId) {
                return action;
            }
        }
        return null;
    }

    private static double expectedDamagePerUse(ParsedActionProfile action, EncounterPartyBenchmarks party) {
        if (action.baseDamage() <= 0.0) {
            return 0.0;
        }
        double deliveryChance = effectDeliveryChance(action, party);
        double damageFactor = action.halfDamageOnSave() > 0 ? (0.5 + (deliveryChance * 0.5)) : deliveryChance;
        return action.baseDamage()
                * damageFactor
                * targetMultiplier(action, party)
                * action.conditionalDamageFactor();
    }

    private static double effectDeliveryChance(ParsedActionProfile action, EncounterPartyBenchmarks party) {
        if (action.toHitBonus() != null) {
            return hitChance(action.toHitBonus(), party.targetAcStandard());
        }
        if (action.saveDc() != null) {
            SaveAbility ability = parseEnumOrNull(action.saveAbility(), SaveAbility.class);
            SaveAbility effective = ability != null ? ability : SaveAbility.DEX;
            return 1.0 - saveSuccessChance(action.saveDc(), party.saveBonus(effective));
        }
        return 0.65;
    }

    private static double targetMultiplier(ParsedActionProfile action, EncounterPartyBenchmarks party) {
        if (action.isAoe() <= 0) {
            return 1.0;
        }
        if ("LARGE_AOE".equals(action.targetingHint())) {
            return clamp(party.partySize() * 0.72, 1.5, 3.4);
        }
        return clamp(1.0 + (party.partySize() * 0.35), 1.2, 2.2);
    }

    private static double expectedRefreshesPerRound(ParsedActionProfile action) {
        int min = action.rechargeMin() == null ? 6 : action.rechargeMin();
        int max = action.rechargeMax() == null ? min : action.rechargeMax();
        if (max < min) {
            max = min;
        }
        return ((max - min) + 1.0) / 6.0;
    }

    private static EnumMap<Channel, Double> initialChannelSlots(double rounds, int legendaryActionBudget) {
        EnumMap<Channel, Double> remainingSlots = new EnumMap<>(Channel.class);
        remainingSlots.put(Channel.ACTION, rounds);
        remainingSlots.put(Channel.BONUS_ACTION, rounds);
        remainingSlots.put(Channel.REACTION, rounds * REACTION_AVAILABILITY);
        remainingSlots.put(Channel.LEGENDARY, rounds * Math.max(0, legendaryActionBudget));
        return remainingSlots;
    }

    private static double allocateSpellDamage(List<SpellOption> spellOptions, EnumMap<Channel, Double> remainingSlots) {
        if (spellOptions.isEmpty()) {
            return 0.0;
        }
        double totalDamage = 0.0;
        Map<String, Double> remainingByPool = new HashMap<>();
        List<SpellOption> candidates = spellOptions.stream()
                .sorted(Comparator.comparingDouble(SpellOption::damagePerSlot).reversed())
                .toList();
        for (SpellOption option : candidates) {
            Double remainingChannel = remainingSlots.get(option.channel());
            if (remainingChannel == null || remainingChannel <= 0.0) {
                continue;
            }
            double remainingPool = remainingPool(option, remainingByPool);
            double uses = Math.min(remainingChannel / option.slotCost(), Math.min(option.maxUses(), remainingPool));
            if (uses <= 0.0) {
                continue;
            }
            totalDamage += uses * option.expectedDamagePerUse();
            remainingSlots.put(option.channel(), remainingChannel - (uses * option.slotCost()));
            if (hasText(option.poolKey())) {
                remainingByPool.put(option.poolKey(), remainingPool - uses);
            }
        }
        return totalDamage;
    }

    private static double remainingPool(SpellOption option, Map<String, Double> remainingByPool) {
        if (!hasText(option.poolKey())) {
            return option.maxUses();
        }
        return remainingByPool.computeIfAbsent(option.poolKey(), ignored -> option.maxUses());
    }

    private static double allocateDamage(List<OffensiveOption> options, Channel channel, EnumMap<Channel, Double> remainingSlots) {
        double remainingChannelSlots = Math.max(0.0, remainingSlots.getOrDefault(channel, 0.0));
        double totalDamage = 0.0;
        List<OffensiveOption> candidates = options.stream()
                .filter(option -> option.channel() == channel)
                .sorted(Comparator.comparingDouble(OffensiveOption::damagePerSlot).reversed())
                .toList();
        for (OffensiveOption option : candidates) {
            if (remainingChannelSlots <= 0.0) {
                break;
            }
            double uses = Math.min(option.maxUses(), remainingChannelSlots / option.slotCost());
            if (uses <= 0.0) {
                continue;
            }
            totalDamage += uses * option.damagePerUse();
            remainingChannelSlots -= uses * option.slotCost();
        }
        remainingSlots.put(channel, remainingChannelSlots);
        return totalDamage;
    }

    private static double allocatePassiveDamage(List<OffensiveOption> options, double rounds) {
        double totalDamage = 0.0;
        for (OffensiveOption option : options) {
            if (option.channel() == Channel.PASSIVE) {
                totalDamage += Math.min(rounds, option.maxUses()) * option.damagePerUse();
            }
        }
        return totalDamage;
    }

    private static boolean hasChannel(List<? extends ChannelCarrier> options, Channel channel) {
        for (ChannelCarrier option : options) {
            if (option.channel() == channel) {
                return true;
            }
        }
        return false;
    }

    private static double legendaryActionUnits(OptionSet options, int legendaryActionBudget) {
        if (legendaryActionBudget <= 0) {
            return 0.0;
        }
        int minCost = Integer.MAX_VALUE;
        for (ChannelCarrier option : options.legendaryOptions()) {
            if (option.slotCost() > 0) {
                minCost = Math.min(minCost, option.slotCost());
            }
        }
        if (minCost == Integer.MAX_VALUE) {
            return 0.0;
        }
        return Math.floor((double) legendaryActionBudget / minCost);
    }

    private static List<ParsedActionProfile> copy(Iterable<ParsedActionProfile> actions) {
        List<ParsedActionProfile> rows = new ArrayList<>();
        for (ParsedActionProfile action : actions) {
            if (action != null) {
                rows.add(action);
            }
        }
        return rows;
    }

    private static List<SpellOption> decodeStoredSpellOptions(String profile) {
        List<ActionProfileCodec.EncodedSpellOption> encoded = ActionProfileCodec.decodeSpellOptions(profile);
        if (encoded.isEmpty()) {
            return List.of();
        }
        List<SpellOption> options = new ArrayList<>();
        for (ActionProfileCodec.EncodedSpellOption option : encoded) {
            options.add(new SpellOption(
                    option.poolKey(),
                    option.spellLevel(),
                    option.castingChannel(),
                    option.expectedDamagePerUse(),
                    option.maxUses() == null ? Double.POSITIVE_INFINITY : option.maxUses(),
                    Channel.ACTION,
                    1));
        }
        return options;
    }

    private static Channel channelOf(String raw) {
        if (!hasText(raw)) {
            return null;
        }
        return switch (raw) {
            case "ACTION" -> Channel.ACTION;
            case "BONUS_ACTION" -> Channel.BONUS_ACTION;
            case "REACTION" -> Channel.REACTION;
            case "LEGENDARY" -> Channel.LEGENDARY;
            case "PASSIVE" -> Channel.PASSIVE;
            default -> null;
        };
    }

    private static Channel channelOfSpell(String raw) {
        if (!hasText(raw)) {
            return Channel.ACTION;
        }
        return switch (raw) {
            case "action" -> Channel.ACTION;
            case "bonus_action" -> Channel.BONUS_ACTION;
            case "reaction" -> Channel.REACTION;
            default -> Channel.ACTION;
        };
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String lower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
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

    private static <E extends Enum<E>> E parseEnumOrNull(String raw, Class<E> enumType) {
        if (!hasText(raw)) {
            return null;
        }
        try {
            return Enum.valueOf(enumType, raw.trim());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    public record DamagePotentialSummary(
            double totalExpectedDamage,
            double normalizedDamagePotential,
            double actionUnitsPerRound
    ) {}

    private record OffensiveOption(
            Channel channel,
            double damagePerUse,
            double maxUses,
            int slotCost
    ) implements ChannelCarrier {
        double damagePerSlot() {
            return damagePerUse / Math.max(1, slotCost);
        }
    }

    private record SpellOption(
            String poolKey,
            int spellLevel,
            String castingChannel,
            double expectedDamagePerUse,
            double maxUses,
            Channel channel,
            int slotCost
    ) implements ChannelCarrier {
        SpellOption withChannelAndMaxUses(Channel channel, double maxUses) {
            return new SpellOption(poolKey, spellLevel, castingChannel, expectedDamagePerUse, maxUses, channel, 1);
        }

        SpellOption withChannelAndCost(Channel channel, int slotCost) {
            return new SpellOption(poolKey, spellLevel, castingChannel, expectedDamagePerUse, maxUses, channel, slotCost);
        }

        double damagePerSlot() {
            return expectedDamagePerUse / Math.max(1, slotCost);
        }
    }

    private interface ChannelCarrier {
        Channel channel();

        int slotCost();
    }

    private record ActionOptions(
            List<OffensiveOption> offensiveOptions,
            List<SpellOption> spellOptions
    ) {
        private static final ActionOptions EMPTY = new ActionOptions(List.of(), List.of());
    }

    private record OptionSet(
            List<OffensiveOption> offensiveOptions,
            List<SpellOption> spellOptions
    ) {
        List<ChannelCarrier> legendaryOptions() {
            List<ChannelCarrier> options = new ArrayList<>();
            for (OffensiveOption option : offensiveOptions) {
                if (option.channel() == Channel.LEGENDARY) {
                    options.add(option);
                }
            }
            for (SpellOption option : spellOptions) {
                if (option.channel() == Channel.LEGENDARY) {
                    options.add(option);
                }
            }
            return options;
        }
    }

    private enum Channel {
        ACTION,
        BONUS_ACTION,
        REACTION,
        LEGENDARY,
        PASSIVE
    }
}
