package features.partyanalysis.service;

import features.partyanalysis.model.CreatureCapabilityTag;
import features.partyanalysis.model.EncounterFunctionRole;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;

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

    public static Classification classify(CreatureStaticRow row) {
        List<RoleScore> scores = new ArrayList<>();
        scores.add(new RoleScore(EncounterFunctionRole.SOLDIER, soldierScore(row)));
        scores.add(new RoleScore(EncounterFunctionRole.ARCHER, archerScore(row)));
        scores.add(new RoleScore(EncounterFunctionRole.CONTROLLER, controllerScore(row)));
        scores.add(new RoleScore(EncounterFunctionRole.SKIRMISHER, skirmisherScore(row)));
        scores.add(new RoleScore(EncounterFunctionRole.SUPPORT, supportScore(row)));
        scores.sort(Comparator.comparingDouble(RoleScore::score).reversed());

        EncounterFunctionRole primary = scores.get(0).role();
        return new Classification(primary, capabilityTags(row));
    }

    private static Set<CreatureCapabilityTag> capabilityTags(CreatureStaticRow row) {
        EnumSet<CreatureCapabilityTag> tags = EnumSet.noneOf(CreatureCapabilityTag.class);
        if (row.spellcastingSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.SPELLCASTER);
        if (row.aoeSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.AOE);
        if (row.healingSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.HEALER);
        if (row.summonSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.SUMMONER);
        if (row.reactionSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.REACTIVE);
        if (row.rangedSignalScore() >= BURST_DAMAGE_RANGED_THRESHOLD
                || row.controlSignalScore() >= BURST_DAMAGE_CONTROL_THRESHOLD) {
            tags.add(CreatureCapabilityTag.BURST_DAMAGE);
        }
        return Set.copyOf(tags);
    }

    private static double soldierScore(CreatureStaticRow row) {
        if (hasEffectiveRoleScores(row)) {
            return row.soldierRoleScore();
        }
        return (row.meleeSignalScore() * 1.55)
                + (row.baseActionUnitsPerRound() * 0.20)
                - (row.rangedSignalScore() * 0.35)
                - (row.mobilitySignalScore() * 0.25)
                - (row.supportSignalScore() * 0.15);
    }

    private static double archerScore(CreatureStaticRow row) {
        if (hasEffectiveRoleScores(row)) {
            return row.archerRoleScore();
        }
        return (row.rangedSignalScore() * 1.60)
                + (row.baseActionUnitsPerRound() * 0.15)
                - (row.aoeSignalScore() * 0.30)
                - (row.controlSignalScore() * 0.45)
                - (row.supportSignalScore() * 0.25)
                - (row.mobilitySignalScore() * 0.10);
    }

    private static double controllerScore(CreatureStaticRow row) {
        if (hasEffectiveRoleScores(row)) {
            return row.controllerRoleScore();
        }
        return (row.controlSignalScore() * 1.55)
                + (row.aoeSignalScore() * 0.95)
                + (row.spellcastingSignalScore() * 0.35)
                + (row.totalComplexityPoints() >= 6 ? 0.30 : 0.0)
                - (row.meleeSignalScore() * 0.10);
    }

    private static double skirmisherScore(CreatureStaticRow row) {
        if (hasEffectiveRoleScores(row)) {
            return row.skirmisherRoleScore();
        }
        return (row.mobilitySignalScore() * 1.65)
                + (row.rangedSignalScore() * 0.30)
                + (row.meleeSignalScore() * 0.30)
                + (row.baseActionUnitsPerRound() * 0.20)
                - (row.supportSignalScore() * 0.25)
                - (row.aoeSignalScore() * 0.10);
    }

    private static double supportScore(CreatureStaticRow row) {
        if (hasEffectiveRoleScores(row)) {
            return row.supportRoleScore();
        }
        return (row.supportSignalScore() * 1.65)
                + (row.healingSignalScore() * 0.70)
                + (row.spellcastingSignalScore() * 0.20)
                + (row.summonSignalScore() * 0.40)
                - (row.meleeSignalScore() * 0.10);
    }

    private static boolean hasEffectiveRoleScores(CreatureStaticRow row) {
        return row.soldierRoleScore() > 0.0
                || row.archerRoleScore() > 0.0
                || row.controllerRoleScore() > 0.0
                || row.skirmisherRoleScore() > 0.0
                || row.supportRoleScore() > 0.0;
    }

    public record Classification(
            EncounterFunctionRole primaryRole,
            Set<CreatureCapabilityTag> capabilityTags
    ) {}

    private record RoleScore(EncounterFunctionRole role, double score) {}
}
