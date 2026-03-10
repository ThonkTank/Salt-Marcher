package features.partyanalysis.service;

import features.creatures.model.Creature;
import features.partyanalysis.model.CreatureCapabilityTag;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.ActionAnalysisRow;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.ActionRow;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;
import features.partyanalysis.service.ActionEffectivenessEvaluator.ActionRoleWeights;
import features.partyanalysis.service.ActionFunctionTagger.ActionTags;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class CreatureStaticAnalysisService {
    private static final int ANALYSIS_VERSION = 3;

    private CreatureStaticAnalysisService() {
        throw new AssertionError("No instances");
    }

    public static int analysisVersion() {
        return ANALYSIS_VERSION;
    }

    public static void refreshForCreature(Connection conn, long creatureId) throws SQLException {
        Map<Long, ActionRow> actions = EncounterPartyAnalysisRepository.loadActionRowsForCreature(conn, creatureId);
        AnalysisSnapshot snapshot = analyzeCreatureActions(creatureId, actions.values());
        EncounterPartyAnalysisRepository.upsertActionAnalysisRows(conn, snapshot.actionRows());
        EncounterPartyAnalysisRepository.upsertStaticRows(conn, List.of(snapshot.staticRow()));
    }

    public static CreatureStaticRow ensureStaticRow(Connection conn, long creatureId) throws SQLException {
        CreatureStaticRow existing = EncounterPartyAnalysisRepository.loadStaticRow(conn, creatureId);
        if (existing != null && existing.analysisVersion() >= ANALYSIS_VERSION) return existing;
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
        return analyzeCreatureActions(creature.Id, actionRows).staticRow();
    }

    static AnalysisSnapshot analyzeCreatureActions(long creatureId, Iterable<ActionRow> actions) {
        StaticAccumulator accumulator = new StaticAccumulator();
        List<ActionAnalysisRow> actionRows = new ArrayList<>();
        for (ActionRow action : actions) {
            ActionSignals signals = analyzeAction(action);
            actionRows.add(signals.toRow(action.actionId()));
            accumulator.add(signals, action.actionType());
        }
        return new AnalysisSnapshot(actionRows, accumulator.toStaticRow(creatureId));
    }

    private static ActionSignals analyzeAction(ActionRow action) {
        ActionTags tags = ActionFunctionTagger.tag(action);
        ActionRoleWeights roleWeights = ActionEffectivenessEvaluator.evaluate(action, tags);

        return new ActionSignals(
                tags.isMelee(),
                tags.isRanged(),
                tags.isAoe(),
                tags.isBuff(),
                tags.isHeal(),
                tags.isControl(),
                tags.hasMobility(),
                tags.hasSummon(),
                tags.isSpellcasting(),
                tags.requiresRecharge(),
                tags.estimatedRuleLines(),
                tags.complexityPoints(),
                tags.expectedUsesPerRound(),
                roleWeights.soldierScore(),
                roleWeights.archerScore(),
                roleWeights.controllerScore(),
                roleWeights.skirmisherScore(),
                roleWeights.supportScore());
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

    private record ActionSignals(
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
            double expectedUsesPerRound,
            double soldierRoleScore,
            double archerRoleScore,
            double controllerRoleScore,
            double skirmisherRoleScore,
            double supportRoleScore
    ) {
        ActionAnalysisRow toRow(long actionId) {
            return new ActionAnalysisRow(
                    actionId,
                    ANALYSIS_VERSION,
                    isMelee,
                    isRanged,
                    isAoe,
                    isBuff,
                    isHeal,
                    isControl,
                    hasMobility,
                    hasSummon,
                    requiresRecharge,
                    estimatedRuleLines,
                    complexityPoints,
                    expectedUsesPerRound);
        }
    }

    private static final class StaticAccumulator {
        private double baseActionUnitsPerRound = 0.0;
        private double legendaryActionUnits = 0.0;
        private int hasReaction = 0;
        private int totalComplexityPoints = 0;
        private int complexFeatureCount = 0;
        private double supportSignalScore = 0.0;
        private double controlSignalScore = 0.0;
        private double mobilitySignalScore = 0.0;
        private double rangedSignalScore = 0.0;
        private double meleeSignalScore = 0.0;
        private double spellcastingSignalScore = 0.0;
        private double aoeSignalScore = 0.0;
        private double healingSignalScore = 0.0;
        private double summonSignalScore = 0.0;
        private double reactionSignalScore = 0.0;
        private double soldierRoleScore = 0.0;
        private double archerRoleScore = 0.0;
        private double controllerRoleScore = 0.0;
        private double skirmisherRoleScore = 0.0;
        private double supportRoleScore = 0.0;

        void add(ActionSignals signals, String actionType) {
            double uses = signals.expectedUsesPerRound();
            if ("legendary_action".equals(actionType)) {
                legendaryActionUnits += uses;
            } else {
                baseActionUnitsPerRound += uses;
            }
            if ("reaction".equals(actionType)) {
                hasReaction = 1;
            }

            totalComplexityPoints += signals.complexityPoints();
            if (signals.estimatedRuleLines() >= 4 || signals.complexityPoints() >= 4) {
                complexFeatureCount++;
            }

            supportSignalScore += signals.isBuff() + signals.isHeal();
            controlSignalScore += signals.isControl() + signals.isAoe() * 0.5;
            mobilitySignalScore += signals.hasMobility();
            rangedSignalScore += signals.isRanged();
            meleeSignalScore += signals.isMelee();
            spellcastingSignalScore += signals.isSpellcasting();
            aoeSignalScore += signals.isAoe();
            healingSignalScore += signals.isHeal();
            summonSignalScore += signals.hasSummon();
            reactionSignalScore += "reaction".equals(actionType) ? 1.0 : 0.0;
            soldierRoleScore += signals.soldierRoleScore();
            archerRoleScore += signals.archerRoleScore();
            controllerRoleScore += signals.controllerRoleScore();
            skirmisherRoleScore += signals.skirmisherRoleScore();
            supportRoleScore += signals.supportRoleScore();
        }

        CreatureStaticRow toStaticRow(long creatureId) {
            double actions = baseActionUnitsPerRound > 0.0 ? baseActionUnitsPerRound : 1.0;
            CreatureStaticRow baseRow = new CreatureStaticRow(
                    creatureId,
                    ANALYSIS_VERSION,
                    null,
                    null,
                    "",
                    actions + legendaryActionUnits,
                    legendaryActionUnits,
                    hasReaction,
                    totalComplexityPoints,
                    complexFeatureCount,
                    supportSignalScore,
                    controlSignalScore,
                    mobilitySignalScore,
                    rangedSignalScore,
                    meleeSignalScore,
                    spellcastingSignalScore,
                    aoeSignalScore,
                    healingSignalScore,
                    summonSignalScore,
                    reactionSignalScore,
                    soldierRoleScore,
                    archerRoleScore,
                    controllerRoleScore,
                    skirmisherRoleScore,
                    supportRoleScore);
            CreatureFunctionRoleClassifier.Classification classification = CreatureFunctionRoleClassifier.classify(baseRow);
            return new CreatureStaticRow(
                    creatureId,
                    ANALYSIS_VERSION,
                    classification.primaryRole(),
                    null,
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
                    meleeSignalScore,
                    spellcastingSignalScore,
                    aoeSignalScore,
                    healingSignalScore,
                    summonSignalScore,
                    reactionSignalScore,
                    soldierRoleScore,
                    archerRoleScore,
                    controllerRoleScore,
                    skirmisherRoleScore,
                    supportRoleScore);
        }
    }
}
