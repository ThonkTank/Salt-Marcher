package features.creatures.api;

import features.creatures.model.CreatureCapabilityTag;
import features.creatures.model.EncounterFunctionRole;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

public final class CreatureFunctionRoleClassifier {
    private static final double TAG_THRESHOLD = 1.0;
    private static final double BURST_DAMAGE_RANGED_THRESHOLD = 1.5;
    private static final double BURST_DAMAGE_CONTROL_THRESHOLD = 1.75;

    private CreatureFunctionRoleClassifier() {
        throw new AssertionError("No instances");
    }

    public static Classification classify(CreatureRoleSignals signals) {
        List<RoleScore> scores = new ArrayList<>();
        scores.add(new RoleScore(EncounterFunctionRole.SOLDIER, soldierScore(signals)));
        scores.add(new RoleScore(EncounterFunctionRole.ARCHER, archerScore(signals)));
        scores.add(new RoleScore(EncounterFunctionRole.CONTROLLER, controllerScore(signals)));
        scores.add(new RoleScore(EncounterFunctionRole.SKIRMISHER, skirmisherScore(signals)));
        scores.add(new RoleScore(EncounterFunctionRole.SUPPORT, supportScore(signals)));
        scores.sort(Comparator.comparingDouble(RoleScore::score).reversed());

        EncounterFunctionRole primary = scores.get(0).role();
        return new Classification(primary, capabilityTags(signals));
    }

    private static Set<CreatureCapabilityTag> capabilityTags(CreatureRoleSignals signals) {
        EnumSet<CreatureCapabilityTag> tags = EnumSet.noneOf(CreatureCapabilityTag.class);
        if (signals.spellcastingSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.SPELLCASTER);
        if (signals.aoeSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.AOE);
        if (signals.healingSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.HEALER);
        if (signals.summonSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.SUMMONER);
        if (signals.reactionSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.REACTIVE);
        if (signals.rangedSignalScore() >= BURST_DAMAGE_RANGED_THRESHOLD
                || signals.controlSignalScore() >= BURST_DAMAGE_CONTROL_THRESHOLD) {
            tags.add(CreatureCapabilityTag.BURST_DAMAGE);
        }
        return Set.copyOf(tags);
    }

    private static double soldierScore(CreatureRoleSignals signals) {
        if (hasEffectiveRoleScores(signals)) {
            return signals.soldierRoleScore();
        }
        return (signals.meleeSignalScore() * 1.55)
                + (signals.baseActionUnitsPerRound() * 0.20)
                - (signals.rangedSignalScore() * 0.35)
                - (signals.mobilitySignalScore() * 0.25)
                - (signals.supportSignalScore() * 0.15);
    }

    private static double archerScore(CreatureRoleSignals signals) {
        if (hasEffectiveRoleScores(signals)) {
            return signals.archerRoleScore();
        }
        return (signals.rangedSignalScore() * 1.60)
                + (signals.baseActionUnitsPerRound() * 0.15)
                - (signals.aoeSignalScore() * 0.30)
                - (signals.controlSignalScore() * 0.45)
                - (signals.supportSignalScore() * 0.25)
                - (signals.mobilitySignalScore() * 0.10);
    }

    private static double controllerScore(CreatureRoleSignals signals) {
        if (hasEffectiveRoleScores(signals)) {
            return signals.controllerRoleScore();
        }
        return (signals.controlSignalScore() * 1.55)
                + (signals.aoeSignalScore() * 0.95)
                + (signals.spellcastingSignalScore() * 0.35)
                + (signals.totalComplexityPoints() >= 6 ? 0.30 : 0.0)
                - (signals.meleeSignalScore() * 0.10);
    }

    private static double skirmisherScore(CreatureRoleSignals signals) {
        if (hasEffectiveRoleScores(signals)) {
            return signals.skirmisherRoleScore();
        }
        return (signals.mobilitySignalScore() * 1.65)
                + (signals.rangedSignalScore() * 0.30)
                + (signals.meleeSignalScore() * 0.30)
                + (signals.baseActionUnitsPerRound() * 0.20)
                - (signals.supportSignalScore() * 0.25)
                - (signals.aoeSignalScore() * 0.10);
    }

    private static double supportScore(CreatureRoleSignals signals) {
        if (hasEffectiveRoleScores(signals)) {
            return signals.supportRoleScore();
        }
        return (signals.supportSignalScore() * 1.65)
                + (signals.healingSignalScore() * 0.70)
                + (signals.spellcastingSignalScore() * 0.20)
                + (signals.summonSignalScore() * 0.40)
                - (signals.meleeSignalScore() * 0.10);
    }

    private static boolean hasEffectiveRoleScores(CreatureRoleSignals signals) {
        return signals.soldierRoleScore() > 0.0
                || signals.archerRoleScore() > 0.0
                || signals.controllerRoleScore() > 0.0
                || signals.skirmisherRoleScore() > 0.0
                || signals.supportRoleScore() > 0.0;
    }

    public record CreatureRoleSignals(
            double baseActionUnitsPerRound,
            int totalComplexityPoints,
            double supportSignalScore,
            double controlSignalScore,
            double mobilitySignalScore,
            double rangedSignalScore,
            double meleeSignalScore,
            double spellcastingSignalScore,
            double aoeSignalScore,
            double healingSignalScore,
            double summonSignalScore,
            double reactionSignalScore,
            double soldierRoleScore,
            double archerRoleScore,
            double controllerRoleScore,
            double skirmisherRoleScore,
            double supportRoleScore
    ) {}

    public record Classification(
            EncounterFunctionRole primaryRole,
            Set<CreatureCapabilityTag> capabilityTags
    ) {}

    private record RoleScore(EncounterFunctionRole role, double score) {}
}
