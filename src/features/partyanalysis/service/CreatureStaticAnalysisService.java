package features.partyanalysis.service;

import features.creatures.model.Creature;
import features.creatures.model.CreatureCapabilityTag;
import features.creatures.api.CreatureFunctionRoleClassifier;
import features.creatures.api.CreatureFunctionRoleClassifier.CreatureRoleSignals;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.ActionAnalysisRow;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.ActionRow;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;
import features.partyanalysis.service.ActionEffectivenessEvaluator.ActionRoleWeights;
import features.partyanalysis.service.ActionEffectivenessEvaluator.ParsedActionMetrics;
import features.partyanalysis.service.ActionFunctionTagger.ActionTags;
import features.spells.api.SpellOffenseProfileLookup;
import features.spells.api.SpellReadApi;
import features.partyanalysis.model.AnalysisModelVersion;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class CreatureStaticAnalysisService {
    private static final features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks
            DEFAULT_BENCHMARKS =
            features.encounter.calibration.service.EncounterCalibrationService.partyBenchmarksForAverageLevel(5, 4);

    private CreatureStaticAnalysisService() {
        throw new AssertionError("No instances");
    }

    public static void refreshForCreature(Connection conn, long creatureId) throws SQLException {
        EncounterPartyAnalysisRepository.CreatureBaseRow baseRow =
                EncounterPartyAnalysisRepository.loadCreatureBaseRow(conn, creatureId);
        Map<Long, ActionRow> actions = EncounterPartyAnalysisRepository.loadActionRowsForCreature(conn, creatureId);
        int legendaryActionBudget = baseRow == null ? 0 : Math.max(0, baseRow.legendaryActionCount());
        AnalysisSnapshot snapshot = analyzeCreatureActions(
                creatureId,
                actions.values(),
                BaseMetrics.from(baseRow),
                SpellReadApi.offenseProfileLookup(conn));
        EncounterPartyAnalysisRepository.upsertActionAnalysisRows(conn, snapshot.actionRows());
        EncounterPartyAnalysisRepository.upsertStaticRows(conn, List.of(snapshot.staticRow()));
    }

    public static CreatureStaticRow ensureStaticRow(Connection conn, long creatureId) throws SQLException {
        CreatureStaticRow existing = EncounterPartyAnalysisRepository.loadStaticRow(conn, creatureId);
        if (existing != null && existing.analysisVersion() >= AnalysisModelVersion.current()) {
            return existing;
        }
        refreshForCreature(conn, creatureId);
        return EncounterPartyAnalysisRepository.loadStaticRow(conn, creatureId);
    }

    public static CreatureStaticRow analyzeCreature(Creature creature) {
        if (creature == null || creature.Id == null) {
            throw new IllegalArgumentException("creature and creature.Id must be non-null");
        }
        List<ActionRow> actionRows = new ArrayList<>();
        long actionId = -1L;
        actionId = appendActionRows(actionRows, creature.Traits, "trait", creature.Id, actionId);
        actionId = appendActionRows(actionRows, creature.Actions, "action", creature.Id, actionId);
        actionId = appendActionRows(actionRows, creature.BonusActions, "bonus_action", creature.Id, actionId);
        actionId = appendActionRows(actionRows, creature.Reactions, "reaction", creature.Id, actionId);
        appendActionRows(actionRows, creature.LegendaryActions, "legendary_action", creature.Id, actionId);
        return analyzeCreatureActions(
                creature.Id,
                actionRows,
                BaseMetrics.from(creature),
                SpellOffenseProfileLookup.NO_OP).staticRow();
    }

    public static List<ActionRow> toActionRows(Creature creature) {
        if (creature == null || creature.Id == null) {
            throw new IllegalArgumentException("creature and creature.Id must be non-null");
        }
        List<ActionRow> actionRows = new ArrayList<>();
        long actionId = -1L;
        actionId = appendActionRows(actionRows, creature.Traits, "trait", creature.Id, actionId);
        actionId = appendActionRows(actionRows, creature.Actions, "action", creature.Id, actionId);
        actionId = appendActionRows(actionRows, creature.BonusActions, "bonus_action", creature.Id, actionId);
        actionId = appendActionRows(actionRows, creature.Reactions, "reaction", creature.Id, actionId);
        appendActionRows(actionRows, creature.LegendaryActions, "legendary_action", creature.Id, actionId);
        return actionRows;
    }

    static AnalysisSnapshot analyzeCreatureActions(
            long creatureId,
            Iterable<ActionRow> actions,
            BaseMetrics baseMetrics,
            SpellOffenseProfileLookup spellLookup) {
        StaticAccumulator accumulator = new StaticAccumulator(baseMetrics);
        List<ActionAnalysisRow> actionRows = new ArrayList<>();
        List<ActionAnalysisDraft> drafts = new ArrayList<>();
        for (ActionRow action : actions) {
            ActionAnalysisDraft draft = analyzeAction(action, spellLookup);
            drafts.add(draft);
        }
        for (ActionAnalysisDraft draft : drafts) {
            draft.setMultiattackProfile(resolveMultiattackProfile(draft.action(), drafts));
            draft.setSpellOptionsProfile(ActionProfileCodec.encodeSpellOptions(
                    draft.spellOptions().stream()
                            .map(option -> new ActionProfileCodec.EncodedSpellOption(
                                    option.poolKey(),
                                    option.spellLevel(),
                                    option.castingChannel(),
                                    option.expectedDamagePerUse(),
                                    option.maxUses()))
                            .toList()));
            actionRows.add(draft.toRow());
            accumulator.add(draft.signals(), draft.action().actionType());
        }
        return new AnalysisSnapshot(actionRows, accumulator.toStaticRow(creatureId));
    }

    private static ActionAnalysisDraft analyzeAction(ActionRow action, SpellOffenseProfileLookup spellLookup) {
        ActionTags tags = ActionFunctionTagger.tag(action);
        ParsedActionMetrics metrics = ActionEffectivenessEvaluator.parse(action, tags);
        ActionRoleWeights roleWeights = ActionEffectivenessEvaluator.evaluate(action, tags, metrics, DEFAULT_BENCHMARKS);
        ActionSignals signals = new ActionSignals(
                tags.isMelee(),
                tags.isRanged(),
                tags.isMixedMeleeRanged(),
                tags.isAoe(),
                tags.isBuff(),
                tags.isHeal(),
                tags.isControl(),
                tags.hasMobility(),
                tags.hasSummon(),
                tags.hasStealth(),
                tags.hasHide(),
                tags.hasInvisibility(),
                tags.hasObscurement(),
                tags.hasForcedMovement(),
                tags.hasAllyEnable(),
                tags.hasAllyCommand(),
                tags.hasDefense(),
                tags.hasTank(),
                tags.hasBurstSetup(),
                tags.isSpellcasting(),
                tags.isOffensiveCombatOption(),
                tags.isSupportCombatOption(),
                tags.isPassiveDefense(),
                tags.isPureUtility(),
                tags.rangedIdentityWeight(),
                tags.requiresRecharge(),
                tags.estimatedRuleLines(),
                tags.complexityPoints(),
                tags.expectedUsesPerRound(),
                metrics.actionChannel(),
                metrics.saveDc(),
                metrics.saveAbility(),
                metrics.halfDamageOnSave(),
                metrics.targetingHint(),
                metrics.baseDamage(),
                metrics.conditionalDamageFactor(),
                metrics.legendaryActionCost(),
                metrics.limitedUses(),
                metrics.rechargeMin(),
                metrics.rechargeMax(),
                metrics.recurringDamageTrait(),
                metrics.spellLevelCap(),
                roleWeights.ambusherScore(),
                roleWeights.artilleryScore(),
                roleWeights.bruteScore(),
                roleWeights.controllerScore(),
                roleWeights.leaderScore(),
                roleWeights.skirmisherScore(),
                roleWeights.soldierScore(),
                roleWeights.supportScore());
        List<SpellcastingActionInterpreter.ResolvedSpellOption> spellOptions =
                SpellcastingActionInterpreter.interpret(action, spellLookup);
        return new ActionAnalysisDraft(action, signals, spellOptions);
    }

    private static String joinCapabilityTags(Set<CreatureCapabilityTag> tags) {
        if (tags == null || tags.isEmpty()) return "";
        return tags.stream()
                .map(Enum::name)
                .sorted()
                .collect(java.util.stream.Collectors.joining(","));
    }

    private static long appendActionRows(
            List<ActionRow> target,
            Collection<Creature.Action> actions,
            String actionType,
            long creatureId,
            long nextActionId) {
        if (actions == null) {
            return nextActionId;
        }
        long actionId = nextActionId;
        for (Creature.Action action : actions) {
            if (action == null) {
                continue;
            }
            target.add(new ActionRow(
                    actionId,
                    creatureId,
                    actionType,
                    action.Name,
                    action.Description,
                    action.ToHitBonus));
            actionId--;
        }
        return actionId;
    }

    private static String resolveMultiattackProfile(ActionRow action, List<ActionAnalysisDraft> drafts) {
        if (action == null || action.name() == null
                || !action.name().toLowerCase(Locale.ROOT).contains("multiattack")) {
            return null;
        }
        String description = action.description() == null ? "" : action.description().toLowerCase(Locale.ROOT);
        List<ActionProfileCodec.MultiattackComponent> parts = new ArrayList<>();

        java.util.regex.Matcher namedMatcher = java.util.regex.Pattern.compile(
                "(\\w+|\\d+)\\s+with\\s+(?:its|his|her)?\\s*([a-z][a-z' -]+?)(?:\\s+attack)?(?=,| and|\\.|$)",
                java.util.regex.Pattern.CASE_INSENSITIVE).matcher(description);
        while (namedMatcher.find()) {
            int count = parseCount(namedMatcher.group(1));
            Long componentActionId = findActionId(namedMatcher.group(2).trim(), drafts);
            if (componentActionId != null && count > 0) {
                parts.add(new ActionProfileCodec.MultiattackComponent(componentActionId, count));
            }
        }
        if (!parts.isEmpty()) {
            return ActionProfileCodec.encodeMultiattackProfile(parts);
        }

        java.util.regex.Matcher countMatcher = java.util.regex.Pattern.compile(
                "makes?\\s+(\\w+|\\d+)\\s+attacks?",
                java.util.regex.Pattern.CASE_INSENSITIVE).matcher(description);
        if (countMatcher.find()) {
            int count = parseCount(countMatcher.group(1));
            Long strongestActionId = strongestAttackActionId(drafts);
            if (strongestActionId != null && count > 0) {
                return ActionProfileCodec.encodeMultiattackProfile(
                        List.of(new ActionProfileCodec.MultiattackComponent(strongestActionId, count)));
            }
        }
        return null;
    }

    private static Long strongestAttackActionId(List<ActionAnalysisDraft> drafts) {
        double bestDamage = 0.0;
        Long bestId = null;
        for (ActionAnalysisDraft draft : drafts) {
            if (!"action".equals(draft.action().actionType())) {
                continue;
            }
            if (draft.action().name() != null
                    && draft.action().name().toLowerCase(Locale.ROOT).contains("multiattack")) {
                continue;
            }
            if (draft.signals().baseDamage() > bestDamage) {
                bestDamage = draft.signals().baseDamage();
                bestId = draft.action().actionId();
            }
        }
        return bestId;
    }

    private static Long findActionId(String attackName, List<ActionAnalysisDraft> drafts) {
        String needle = attackName.toLowerCase(Locale.ROOT);
        for (ActionAnalysisDraft draft : drafts) {
            if (!"action".equals(draft.action().actionType())) {
                continue;
            }
            String candidate = draft.action().name() == null ? "" : draft.action().name().toLowerCase(Locale.ROOT);
            if (candidate.contains(needle) || needle.contains(candidate)) {
                return draft.action().actionId();
            }
        }
        return null;
    }

    private static int parseCount(String raw) {
        if (raw == null || raw.isBlank()) {
            return 1;
        }
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException ignored) {
            return switch (raw.toLowerCase(Locale.ROOT)) {
                case "one", "once" -> 1;
                case "two", "twice" -> 2;
                case "three" -> 3;
                case "four" -> 4;
                case "five" -> 5;
                case "six" -> 6;
                default -> 1;
            };
        }
    }

    static final class AnalysisSnapshot {
        private final List<ActionAnalysisRow> actionRows;
        private final CreatureStaticRow staticRow;

        AnalysisSnapshot(List<ActionAnalysisRow> actionRows, CreatureStaticRow staticRow) {
            this.actionRows = List.copyOf(actionRows);
            this.staticRow = staticRow;
        }

        List<ActionAnalysisRow> actionRows() {
            return actionRows;
        }

        CreatureStaticRow staticRow() {
            return staticRow;
        }
    }

    private record BaseMetrics(
            int hp,
            int ac,
            int speed,
            int flySpeed,
            int legendaryActionBudget
    ) {
        static BaseMetrics from(EncounterPartyAnalysisRepository.CreatureBaseRow row) {
            if (row == null) {
                return new BaseMetrics(0, 0, 0, 0, 0);
            }
            return new BaseMetrics(
                    Math.max(0, row.hp()),
                    Math.max(0, row.ac()),
                    Math.max(0, row.speed()),
                    Math.max(0, row.flySpeed()),
                    Math.max(0, row.legendaryActionCount()));
        }

        static BaseMetrics from(Creature creature) {
            if (creature == null) {
                return new BaseMetrics(0, 0, 0, 0, 0);
            }
            return new BaseMetrics(
                    Math.max(0, creature.HP),
                    Math.max(0, creature.AC),
                    Math.max(0, creature.Speed),
                    Math.max(0, creature.FlySpeed),
                    Math.max(0, creature.LegendaryActionCount));
        }
    }

    private record ActionSignals(
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
            double expectedUsesPerRound,
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
            Integer spellLevelCap,
            double ambusherRoleScore,
            double artilleryRoleScore,
            double bruteRoleScore,
            double controllerRoleScore,
            double leaderRoleScore,
            double skirmisherRoleScore,
            double soldierRoleScore,
            double supportRoleScore
    ) {
        ActionAnalysisRow toRow(long actionId, String multiattackProfile, String spellOptionsProfile) {
            return new ActionAnalysisRow(
                    actionId,
                    AnalysisModelVersion.current(),
                    isMelee,
                    isRanged,
                    isMixedMeleeRanged,
                    isAoe,
                    isBuff,
                    isHeal,
                    isControl,
                    hasMobility,
                    hasSummon,
                    isSpellcasting,
                    isOffensiveCombatOption,
                    isSupportCombatOption,
                    isPassiveDefense,
                    isPureUtility,
                    requiresRecharge,
                    estimatedRuleLines,
                    complexityPoints,
                    expectedUsesPerRound,
                    actionChannel,
                    saveDc,
                    saveAbility,
                    halfDamageOnSave,
                    targetingHint,
                    baseDamage,
                    conditionalDamageFactor,
                    legendaryActionCost,
                    limitedUses,
                    rechargeMin,
                    rechargeMax,
                    recurringDamageTrait,
                    spellLevelCap,
                    multiattackProfile,
                    spellOptionsProfile);
        }
    }

    private static final class ActionAnalysisDraft {
        private final ActionRow action;
        private final ActionSignals signals;
        private final List<SpellcastingActionInterpreter.ResolvedSpellOption> spellOptions;
        private String multiattackProfile;
        private String spellOptionsProfile;

        private ActionAnalysisDraft(
                ActionRow action,
                ActionSignals signals,
                List<SpellcastingActionInterpreter.ResolvedSpellOption> spellOptions) {
            this.action = action;
            this.signals = signals;
            this.spellOptions = spellOptions == null ? List.of() : List.copyOf(spellOptions);
        }

        ActionRow action() {
            return action;
        }

        ActionSignals signals() {
            return signals;
        }

        List<SpellcastingActionInterpreter.ResolvedSpellOption> spellOptions() {
            return spellOptions;
        }

        void setMultiattackProfile(String multiattackProfile) {
            this.multiattackProfile = multiattackProfile;
        }

        void setSpellOptionsProfile(String spellOptionsProfile) {
            this.spellOptionsProfile = spellOptionsProfile;
        }

        ActionAnalysisRow toRow() {
            return signals.toRow(action.actionId(), multiattackProfile, spellOptionsProfile);
        }
    }

    private static final class StaticAccumulator {
        private final BaseMetrics baseMetrics;
        private int lowestLegendaryActionCost = Integer.MAX_VALUE;
        private boolean hasStandardAction = false;
        private boolean hasBonusAction = false;
        private int hasReaction = 0;
        private int offensiveActionCount = 0;
        private int totalComplexityPoints = 0;
        private int complexFeatureCount = 0;
        private double supportSignalScore = 0.0;
        private double controlSignalScore = 0.0;
        private double mobilitySignalScore = 0.0;
        private double rangedSignalScore = 0.0;
        private double rangedIdentityScore = 0.0;
        private double meleeSignalScore = 0.0;
        private double spellcastingSignalScore = 0.0;
        private double aoeSignalScore = 0.0;
        private double healingSignalScore = 0.0;
        private double summonSignalScore = 0.0;
        private double reactionSignalScore = 0.0;
        private double stealthSignalScore = 0.0;
        private double hideSignalScore = 0.0;
        private double invisibilitySignalScore = 0.0;
        private double obscurementSignalScore = 0.0;
        private double forcedMovementSignalScore = 0.0;
        private double allyEnableSignalScore = 0.0;
        private double allyCommandSignalScore = 0.0;
        private double defenseSignalScore = 0.0;
        private double tankSignalScore = 0.0;
        private double ambusherRoleScore = 0.0;
        private double artilleryRoleScore = 0.0;
        private double bruteRoleScore = 0.0;
        private double soldierRoleScore = 0.0;
        private double controllerRoleScore = 0.0;
        private double leaderRoleScore = 0.0;
        private double skirmisherRoleScore = 0.0;
        private double supportRoleScore = 0.0;

        StaticAccumulator(BaseMetrics baseMetrics) {
            this.baseMetrics = baseMetrics == null ? new BaseMetrics(0, 0, 0, 0, 0) : baseMetrics;
        }

        void add(ActionSignals signals, String actionType) {
            if ("action".equals(actionType) && signals.expectedUsesPerRound() > 0.0) {
                hasStandardAction = true;
            }
            if ("bonus_action".equals(actionType) && signals.expectedUsesPerRound() > 0.0) {
                hasBonusAction = true;
            }
            if ("reaction".equals(actionType)) {
                hasReaction = 1;
            }
            if ("legendary_action".equals(actionType) && signals.expectedUsesPerRound() > 0.0) {
                lowestLegendaryActionCost = Math.min(lowestLegendaryActionCost, Math.max(1, signals.legendaryActionCost()));
            }
            if (signals.isOffensiveCombatOption() > 0 && signals.isPureUtility() == 0) {
                offensiveActionCount++;
            }

            totalComplexityPoints += signals.complexityPoints();
            if (signals.estimatedRuleLines() >= 4) {
                complexFeatureCount++;
            }

            double offensiveWeight = offensiveWeight(actionType, signals);
            double supportWeight = supportWeight(actionType, signals);
            double utilityWeight = signals.isPureUtility() > 0 ? 0.15 : 1.0;

            supportSignalScore += (signals.isBuff() * supportWeight) + (signals.isHeal() * supportWeight * 0.8);
            controlSignalScore += (signals.isControl() * offensiveWeight) + (signals.isAoe() * offensiveWeight * 0.35);
            mobilitySignalScore += signals.hasMobility() * (signals.isOffensiveCombatOption() > 0 ? 1.0 : 0.45);
            rangedSignalScore += (signals.isRanged() * offensiveWeight) + (signals.isMixedMeleeRanged() * offensiveWeight * 0.45);
            rangedIdentityScore += signals.rangedIdentityWeight() * offensiveWeight;
            double mixedMeleeWeight = signals.rangedIdentityWeight() >= 0.65 ? 0.20 : 0.45;
            meleeSignalScore += (signals.isMelee() * offensiveWeight) + (signals.isMixedMeleeRanged() * offensiveWeight * mixedMeleeWeight);
            spellcastingSignalScore += signals.isSpellcasting() * (signals.isOffensiveCombatOption() > 0 || signals.isSupportCombatOption() > 0 ? 1.0 : utilityWeight);
            aoeSignalScore += signals.isAoe() * offensiveWeight;
            healingSignalScore += signals.isHeal() * supportWeight;
            summonSignalScore += signals.hasSummon() * (signals.isOffensiveCombatOption() > 0 || signals.isSupportCombatOption() > 0 ? 1.0 : utilityWeight);
            reactionSignalScore += "reaction".equals(actionType) ? 1.0 : 0.0;
            stealthSignalScore += signals.hasStealth() * utilityWeight;
            hideSignalScore += signals.hasHide() * Math.max(utilityWeight, 0.75);
            invisibilitySignalScore += signals.hasInvisibility() * Math.max(utilityWeight, supportWeight);
            obscurementSignalScore += signals.hasObscurement() * Math.max(utilityWeight, supportWeight);
            if (signals.hasBurstSetup() > 0) {
                stealthSignalScore += 0.35 * Math.max(offensiveWeight, utilityWeight);
                hideSignalScore += 0.50 * Math.max(offensiveWeight, utilityWeight);
            }
            forcedMovementSignalScore += signals.hasForcedMovement() * offensiveWeight;
            allyEnableSignalScore += signals.hasAllyEnable() * Math.max(supportWeight, 0.8);
            allyCommandSignalScore += signals.hasAllyCommand() * Math.max(supportWeight, 0.6);
            defenseSignalScore += signals.hasDefense() * Math.max(supportWeight, 0.5);
            tankSignalScore += signals.hasTank() * Math.max(offensiveWeight, 0.6);
            ambusherRoleScore += signals.ambusherRoleScore() * Math.max(offensiveWeight, utilityWeight);
            artilleryRoleScore += signals.artilleryRoleScore() * offensiveWeight;
            bruteRoleScore += signals.bruteRoleScore() * offensiveWeight;
            soldierRoleScore += signals.soldierRoleScore() * offensiveWeight;
            controllerRoleScore += signals.controllerRoleScore() * Math.max(offensiveWeight, supportWeight * 0.5);
            leaderRoleScore += signals.leaderRoleScore() * Math.max(supportWeight, 0.45);
            skirmisherRoleScore += signals.skirmisherRoleScore()
                    * (signals.hasMobility() > 0 && (signals.isMelee() > 0 || signals.isMixedMeleeRanged() > 0) ? offensiveWeight * 1.2 : offensiveWeight);
            supportRoleScore += signals.supportRoleScore() * supportWeight;
        }

        CreatureStaticRow toStaticRow(long creatureId) {
            double legendaryActionUnits = achievableLegendaryActionUnits();
            double actions = (hasStandardAction ? 1.0 : 0.0) + (hasBonusAction ? 1.0 : 0.0);
            if (actions <= 0.0) {
                actions = 1.0;
            }
            if (offensiveActionCount == 0) {
                soldierRoleScore += meleeSignalScore * 0.15;
                skirmisherRoleScore += mobilitySignalScore * 0.10;
            }
            double durabilityScore = durabilityScore();
            double standoffMobilityScore = standoffMobilityScore();
            defenseSignalScore += armorDefenseScore();
            if (baseMetrics.ac() >= 17 && meleeSignalScore >= 1.0) {
                tankSignalScore += 0.6;
            }
            bruteRoleScore += durabilityScore * 1.15 + meleeSignalScore * 0.25 - supportSignalScore * 0.10;
            soldierRoleScore += durabilityScore * 0.70 + defenseSignalScore * 1.25 + tankSignalScore * 1.15;
            artilleryRoleScore += rangedIdentityScore * 0.35 + standoffMobilityScore * 0.65 + rangedSignalScore * 0.10;
            ambusherRoleScore += stealthSignalScore * 1.10
                    + hideSignalScore * 1.30
                    + invisibilitySignalScore * 1.20
                    + obscurementSignalScore * 0.80
                    + mobilitySignalScore * 0.30;
            controllerRoleScore += forcedMovementSignalScore * 0.95 + aoeSignalScore * 0.10;
            leaderRoleScore += allyEnableSignalScore * 1.30
                    + allyCommandSignalScore * 1.15
                    + summonSignalScore * 0.75
                    + complexityLeaderBonus();
            supportRoleScore += defenseSignalScore * 0.25 + healingSignalScore * 0.20;
            CreatureFunctionRoleClassifier.Classification classification = CreatureFunctionRoleClassifier.classify(
                    new CreatureRoleSignals(
                            actions + legendaryActionUnits,
                            totalComplexityPoints,
                            supportSignalScore,
                            controlSignalScore,
                            mobilitySignalScore,
                            rangedSignalScore,
                            rangedIdentityScore,
                            meleeSignalScore,
                            spellcastingSignalScore,
                            aoeSignalScore,
                            healingSignalScore,
                            summonSignalScore,
                            reactionSignalScore,
                            stealthSignalScore,
                            hideSignalScore,
                            invisibilitySignalScore,
                            obscurementSignalScore,
                            forcedMovementSignalScore,
                            allyEnableSignalScore,
                            allyCommandSignalScore,
                            defenseSignalScore,
                            tankSignalScore,
                            durabilityScore,
                            standoffMobilityScore,
                            ambusherRoleScore,
                            artilleryRoleScore,
                            bruteRoleScore,
                            soldierRoleScore,
                            controllerRoleScore,
                            leaderRoleScore,
                            skirmisherRoleScore,
                            supportRoleScore));
            return new CreatureStaticRow(
                    creatureId,
                    AnalysisModelVersion.current(),
                    classification.primaryRole(),
                    joinCapabilityTags(classification.capabilityTags()),
                    actions + legendaryActionUnits,
                    legendaryActionUnits,
                    hasReaction,
                    totalComplexityPoints,
                    complexFeatureCount,
                    supportSignalScore,
                    controlSignalScore,
                    mobilitySignalScore,
                    rangedSignalScore,
                    rangedIdentityScore,
                    meleeSignalScore,
                    spellcastingSignalScore,
                    aoeSignalScore,
                    healingSignalScore,
                    summonSignalScore,
                    reactionSignalScore,
                    stealthSignalScore,
                    hideSignalScore,
                    invisibilitySignalScore,
                    obscurementSignalScore,
                    forcedMovementSignalScore,
                    allyEnableSignalScore,
                    allyCommandSignalScore,
                    defenseSignalScore,
                    tankSignalScore,
                    ambusherRoleScore,
                    artilleryRoleScore,
                    bruteRoleScore,
                    soldierRoleScore,
                    controllerRoleScore,
                    leaderRoleScore,
                    skirmisherRoleScore,
                    supportRoleScore);
        }

        private double achievableLegendaryActionUnits() {
            if (baseMetrics.legendaryActionBudget() <= 0 || lowestLegendaryActionCost == Integer.MAX_VALUE) {
                return 0.0;
            }
            return Math.floor((double) baseMetrics.legendaryActionBudget() / lowestLegendaryActionCost);
        }

        private double durabilityScore() {
            double hpBand = Math.min(3.5, baseMetrics.hp() / 90.0);
            double acBand = Math.max(0.0, (baseMetrics.ac() - 13) / 3.0);
            return hpBand + acBand;
        }

        private double standoffMobilityScore() {
            double walk = Math.max(0.0, (baseMetrics.speed() - 30) / 20.0);
            double flight = baseMetrics.flySpeed() >= 30 ? 1.0 : 0.0;
            return walk + flight;
        }

        private double armorDefenseScore() {
            return Math.max(0.0, (baseMetrics.ac() - 15) / 2.0);
        }

        private double complexityLeaderBonus() {
            return totalComplexityPoints >= 8 ? 1.2 : totalComplexityPoints >= 5 ? 0.6 : 0.0;
        }

        private double offensiveWeight(String actionType, ActionSignals signals) {
            if (signals.isPureUtility() > 0) {
                return 0.0;
            }
            if (signals.isPassiveDefense() > 0 && signals.isOffensiveCombatOption() == 0) {
                return 0.0;
            }
            double weight = signals.isOffensiveCombatOption() > 0 ? 1.0 : 0.25;
            if ("reaction".equals(actionType)) {
                weight *= 0.55;
            } else if ("trait".equals(actionType)) {
                weight *= 0.20;
            }
            return weight;
        }

        private double supportWeight(String actionType, ActionSignals signals) {
            if (signals.isPureUtility() > 0 || signals.isPassiveDefense() > 0) {
                return 0.0;
            }
            double weight = signals.isSupportCombatOption() > 0 ? 1.0 : 0.20;
            if ("reaction".equals(actionType)) {
                weight *= 0.55;
            } else if ("trait".equals(actionType)) {
                weight *= 0.25;
            }
            return weight;
        }
    }
}
