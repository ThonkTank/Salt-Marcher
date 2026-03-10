package features.encounter.service.analysis;

import features.encounter.repository.EncounterPartyAnalysisRepository;
import features.encounter.repository.EncounterPartyAnalysisRepository.ActionAnalysisRow;
import features.encounter.repository.EncounterPartyAnalysisRepository.ActionRow;
import features.encounter.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class CreatureStaticAnalysisService {
    private static final int ANALYSIS_VERSION = 2;

    private CreatureStaticAnalysisService() {
        throw new AssertionError("No instances");
    }

    public static void refreshForCreature(Connection conn, long creatureId) throws SQLException {
        Map<Long, ActionRow> actions = EncounterPartyAnalysisRepository.loadActionRowsForCreature(conn, creatureId);
        AnalysisSnapshot snapshot = analyzeCreatureActions(creatureId, actions.values());
        EncounterPartyAnalysisRepository.upsertActionAnalysisRows(conn, snapshot.actionRows());
        EncounterPartyAnalysisRepository.upsertStaticRows(conn, List.of(snapshot.staticRow()));
    }

    public static CreatureStaticRow ensureStaticRow(Connection conn, long creatureId) throws SQLException {
        CreatureStaticRow existing = EncounterPartyAnalysisRepository.loadStaticRow(conn, creatureId);
        if (existing != null) return existing;
        refreshForCreature(conn, creatureId);
        return EncounterPartyAnalysisRepository.loadStaticRow(conn, creatureId);
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
        String name = text(action.name());
        String description = text(action.description());
        String joined = (name + " " + description).toLowerCase(Locale.ROOT);

        int isMelee = containsAny(joined, "melee weapon attack", "reach ") ? 1 : 0;
        int isRanged = containsAny(joined, "ranged weapon attack", "ranged spell attack", "range ") ? 1 : 0;
        int isAoe = containsAny(joined, "cone", "radius", "line", "cube", "sphere", "each creature") ? 1 : 0;
        int isBuff = containsAny(joined, "advantage", "bonus to", "gains", "allies", "inspire", "leadership") ? 1 : 0;
        int isHeal = containsAny(joined, "regain", "heals", "hit points", "temporary hit points") ? 1 : 0;
        int isControl = containsAny(joined, "stunned", "restrained", "grappled", "frightened", "charmed", "paralyzed", "prone") ? 1 : 0;
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

        return new ActionSignals(
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

    private static String joinCapabilityTags(Set<features.encounter.model.CreatureCapabilityTag> tags) {
        if (tags == null || tags.isEmpty()) return "";
        return tags.stream()
                .map(Enum::name)
                .sorted()
                .collect(java.util.stream.Collectors.joining(","));
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
            double expectedUsesPerRound
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
                    reactionSignalScore);
            CreatureFunctionRoleClassifier.Classification classification = CreatureFunctionRoleClassifier.classify(baseRow);
            return new CreatureStaticRow(
                    creatureId,
                    ANALYSIS_VERSION,
                    classification.primaryRole(),
                    classification.secondaryRole(),
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
                    reactionSignalScore);
        }
    }
}
