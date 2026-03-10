package features.encounter.analysis.service;

import features.encounter.analysis.model.CreatureCapabilityTag;
import features.encounter.analysis.model.EncounterFunctionRole;
import features.encounter.analysis.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

public final class CreatureFunctionRoleClassifier {
    private static final double SECONDARY_ROLE_THRESHOLD = 0.80;
    private static final double TAG_THRESHOLD = 1.0;
    private static final double BURST_DAMAGE_RANGED_THRESHOLD = 1.5;
    private static final double BURST_DAMAGE_CONTROL_THRESHOLD = 1.25;

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
        EncounterFunctionRole secondary = null;
        if (scores.size() > 1
                && scores.get(1).score() > 0.0
                && scores.get(1).score() >= scores.get(0).score() * SECONDARY_ROLE_THRESHOLD) {
            secondary = scores.get(1).role();
        }

        return new Classification(primary, secondary, capabilityTags(row));
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
        return (row.meleeSignalScore() * 1.35)
                + (row.baseActionUnitsPerRound() * 0.25)
                - (row.rangedSignalScore() * 0.25)
                - (row.mobilitySignalScore() * 0.20);
    }

    private static double archerScore(CreatureStaticRow row) {
        if (hasEffectiveRoleScores(row)) {
            return row.archerRoleScore();
        }
        return (row.rangedSignalScore() * 1.40)
                + (row.aoeSignalScore() * 0.20)
                - (row.controlSignalScore() * 0.30)
                - (row.supportSignalScore() * 0.20);
    }

    private static double controllerScore(CreatureStaticRow row) {
        if (hasEffectiveRoleScores(row)) {
            return row.controllerRoleScore();
        }
        return (row.controlSignalScore() * 1.40)
                + (row.aoeSignalScore() * 0.45)
                + (row.spellcastingSignalScore() * 0.35)
                + (row.totalComplexityPoints() >= 6 ? 0.35 : 0.0);
    }

    private static double skirmisherScore(CreatureStaticRow row) {
        if (hasEffectiveRoleScores(row)) {
            return row.skirmisherRoleScore();
        }
        return (row.mobilitySignalScore() * 1.45)
                + (row.rangedSignalScore() * 0.15)
                + (row.meleeSignalScore() * 0.15)
                - (row.supportSignalScore() * 0.20);
    }

    private static double supportScore(CreatureStaticRow row) {
        if (hasEffectiveRoleScores(row)) {
            return row.supportRoleScore();
        }
        return (row.supportSignalScore() * 1.50)
                + (row.healingSignalScore() * 0.45)
                + (row.spellcastingSignalScore() * 0.15);
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
            EncounterFunctionRole secondaryRole,
            Set<CreatureCapabilityTag> capabilityTags
    ) {}

    private record RoleScore(EncounterFunctionRole role, double score) {}
}
