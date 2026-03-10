package features.creatures.api;

import features.creatures.model.CreatureCapabilityTag;
import features.creatures.model.EncounterFunctionRole;

import java.util.EnumSet;
import java.util.Set;

public final class CreatureFunctionRoleClassifier {
    private static final double TAG_THRESHOLD = 1.0;

    private CreatureFunctionRoleClassifier() {
        throw new AssertionError("No instances");
    }

    public static Classification classify(CreatureRoleSignals signals) {
        ScoreCard scores = buildScoreCard(signals);
        ProfileState profiles = buildProfileState(signals, scores);
        EncounterFunctionRole primary = determinePrimaryRole(signals, scores, profiles);
        return new Classification(primary, capabilityTags(signals));
    }

    private static ScoreCard buildScoreCard(CreatureRoleSignals signals) {
        if (hasEffectiveRoleScores(signals)) {
            return new ScoreCard(
                    signals.ambusherRoleScore() + concealmentPackage(signals) * 1.10 + signals.mobilitySignalScore() * 0.25,
                    signals.artilleryRoleScore() + signals.rangedIdentityScore() * 0.65 + signals.rangedSignalScore() * 0.30,
                    signals.bruteRoleScore() + signals.durabilityScore() * 0.80 + signals.meleeSignalScore() * 0.25 - breadthPackage(signals) * 0.08,
                    signals.controllerRoleScore() + signals.forcedMovementSignalScore() * 0.85 + signals.controlSignalScore() * 0.30 + signals.spellcastingSignalScore() * 0.15,
                    signals.leaderRoleScore() + leaderPackage(signals) * 0.85,
                    signals.supportRoleScore() + supportPackage(signals) * 0.80 + signals.spellcastingSignalScore() * 0.15,
                    signals.skirmisherRoleScore() + signals.mobilitySignalScore() * 0.45 + concealmentPackage(signals) * 0.20,
                    signals.soldierRoleScore() + signals.defenseSignalScore() * 0.80 + signals.tankSignalScore() * 0.95 + signals.durabilityScore() * 0.35
            );
        }
        return new ScoreCard(
                concealmentPackage(signals) * 1.35 + signals.mobilitySignalScore() * 0.35 + signals.rangedIdentityScore() * 0.15,
                signals.rangedSignalScore() * 1.45 + signals.rangedIdentityScore() * 1.10 + signals.standoffMobilityScore() * 0.35,
                signals.meleeSignalScore() * 1.20 + signals.durabilityScore() * 1.35 - breadthPackage(signals) * 0.30,
                signals.controlSignalScore() * 1.35 + signals.forcedMovementSignalScore() * 1.15 + signals.aoeSignalScore() * 0.55,
                leaderPackage(signals) * 1.35 + complexityLeaderBonus(signals),
                supportPackage(signals) * 1.40,
                signals.mobilitySignalScore() * 1.35 + signals.meleeSignalScore() * 0.45 + concealmentPackage(signals) * 0.35,
                signals.meleeSignalScore() * 0.90 + signals.defenseSignalScore() * 1.20 + signals.tankSignalScore() * 1.15 + signals.durabilityScore() * 0.75
        );
    }

    private static EncounterFunctionRole determinePrimaryRole(
            CreatureRoleSignals signals,
            ScoreCard scores,
            ProfileState profiles) {
        double concealment = concealmentPackage(signals);
        double support = supportPackage(signals);
        double leader = leaderPackage(signals);
        if (concealment >= 1.0
                && (signals.meleeSignalScore() >= 0.80 || signals.rangedIdentityScore() >= 0.70)
                && leader < 0.8
                && support < 0.8
                && signals.tankSignalScore() <= 0.35) {
            return EncounterFunctionRole.AMBUSHER;
        }
        if (concealment >= 0.70
                && signals.meleeSignalScore() >= 0.90
                && signals.mobilitySignalScore() >= 0.40
                && leader < 0.8
                && support < 0.8
                && signals.tankSignalScore() <= 0.35) {
            return EncounterFunctionRole.AMBUSHER;
        }
        if ((leader >= 1.0 && signals.totalComplexityPoints() >= 2 && signals.tankSignalScore() <= 0.60)
                || signals.allyCommandSignalScore() >= 0.5) {
            return EncounterFunctionRole.LEADER;
        }
        if (signals.spellcastingSignalScore() >= 1.0 && signals.meleeSignalScore() <= 0.45) {
            if (leader >= 0.9 && signals.totalComplexityPoints() >= 4) {
                return EncounterFunctionRole.LEADER;
            }
            if (support >= 0.9 || signals.healingSignalScore() > 0.0 || signals.summonSignalScore() > 0.0) {
                return EncounterFunctionRole.SUPPORT;
            }
            return EncounterFunctionRole.CONTROLLER;
        }
        if (signals.spellcastingSignalScore() >= 1.0
                && signals.tankSignalScore() <= 0.35
                && signals.durabilityScore() < 1.9) {
            if (leader >= 0.9 && signals.totalComplexityPoints() >= 4) {
                return EncounterFunctionRole.LEADER;
            }
            if (support >= 0.75 || signals.healingSignalScore() > 0.0 || signals.summonSignalScore() > 0.0) {
                return EncounterFunctionRole.SUPPORT;
            }
            if (signals.controlSignalScore() >= 0.45 || signals.aoeSignalScore() >= 0.75) {
                return EncounterFunctionRole.CONTROLLER;
            }
        }
        if (signals.spellcastingSignalScore() >= 1.0) {
            if (leader >= 1.5 && signals.totalComplexityPoints() >= 3) {
                return EncounterFunctionRole.LEADER;
            }
            if ((support >= 0.5 && (signals.healingSignalScore() > 0.0 || signals.summonSignalScore() > 0.0))
                    || (signals.healingSignalScore() > 0.20 && signals.meleeSignalScore() <= 1.2)) {
                return EncounterFunctionRole.SUPPORT;
            }
            if (signals.controlSignalScore() >= 0.10 || signals.aoeSignalScore() >= 0.50) {
                return EncounterFunctionRole.CONTROLLER;
            }
            if (signals.mobilitySignalScore() >= 1.0 && signals.meleeSignalScore() <= 1.2) {
                return EncounterFunctionRole.SKIRMISHER;
            }
        }
        if (signals.defenseSignalScore() >= 1.0
                && signals.meleeSignalScore() >= 1.5
                && signals.spellcastingSignalScore() <= 0.2
                && leader < 0.8
                && support < 0.8) {
            return EncounterFunctionRole.SOLDIER;
        }
        if (support >= 1.0
                && signals.spellcastingSignalScore() >= 0.8
                && signals.durabilityScore() < 1.2
                && signals.meleeSignalScore() <= 1.3) {
            return leader >= 1.0 && signals.totalComplexityPoints() >= 4
                    ? EncounterFunctionRole.LEADER
                    : EncounterFunctionRole.SUPPORT;
        }
        if (signals.controlSignalScore() >= 1.0
                && signals.durabilityScore() < 1.6
                && signals.meleeSignalScore() <= 2.0) {
            return EncounterFunctionRole.CONTROLLER;
        }
        if (signals.mobilitySignalScore() >= 1.0
                && signals.meleeSignalScore() >= 0.90
                && (signals.defenseSignalScore() + signals.tankSignalScore()) <= 0.60
                && support < 0.8
                && leader < 0.8) {
            return EncounterFunctionRole.SKIRMISHER;
        }
        if (signals.mobilitySignalScore() >= 1.0
                && signals.meleeSignalScore() >= 0.90
                && signals.tankSignalScore() <= 0.35
                && leader < 0.8
                && support < 0.8) {
            return EncounterFunctionRole.SKIRMISHER;
        }
        if (signals.mobilitySignalScore() >= 1.0
                && signals.meleeSignalScore() >= 0.90
                && signals.spellcastingSignalScore() == 0.0
                && signals.rangedIdentityScore() <= 0.20
                && signals.controlSignalScore() <= 0.20
                && signals.allyCommandSignalScore() <= 0.20
                && signals.allyEnableSignalScore() <= 0.20) {
            return EncounterFunctionRole.SKIRMISHER;
        }
        if (signals.invisibilitySignalScore() >= 0.15
                && signals.meleeSignalScore() >= 0.90
                && signals.durabilityScore() < 2.4
                && signals.controlSignalScore() < 0.6
                && leader < 0.8
                && support < 0.8) {
            return EncounterFunctionRole.AMBUSHER;
        }
        if ((signals.hideSignalScore() >= 0.75 || signals.stealthSignalScore() >= 1.0)
                && signals.meleeSignalScore() >= 0.90
                && signals.tankSignalScore() <= 0.35
                && signals.controlSignalScore() <= 0.35) {
            return EncounterFunctionRole.AMBUSHER;
        }
        if (profiles.ambusher() && scores.ambusher() >= Math.max(scores.artillery(), scores.skirmisher()) * 0.82) {
            return EncounterFunctionRole.AMBUSHER;
        }
        if (profiles.leader() && scores.leader() >= Math.max(scores.support(), scores.controller()) * 0.90) {
            return EncounterFunctionRole.LEADER;
        }
        if (profiles.support() && scores.support() >= Math.max(scores.leader(), scores.controller()) * 0.90
                && scores.support() >= scores.soldier() * 0.38) {
            return EncounterFunctionRole.SUPPORT;
        }
        if (profiles.controller() && scores.controller() >= Math.max(scores.artillery(), scores.skirmisher()) * 0.92
                && scores.controller() >= scores.soldier() * 0.48) {
            return EncounterFunctionRole.CONTROLLER;
        }
        if (profiles.artillery() && scores.artillery() >= Math.max(scores.controller(), scores.skirmisher()) * 0.92
                && scores.artillery() >= scores.soldier() * 0.72) {
            return EncounterFunctionRole.ARTILLERY;
        }
        if (profiles.skirmisher() && scores.skirmisher() >= Math.max(scores.artillery(), scores.controller()) * 0.92
                && scores.skirmisher() >= scores.soldier() * 0.76) {
            return EncounterFunctionRole.SKIRMISHER;
        }
        if (profiles.brute() && scores.brute() >= scores.soldier() * 0.90) {
            return EncounterFunctionRole.BRUTE;
        }
        if (profiles.soldier()) {
            return EncounterFunctionRole.SOLDIER;
        }

        EncounterFunctionRole bestSpecialist = bestSpecialist(scores, profiles);
        if (bestSpecialist != null && specialistScore(bestSpecialist, scores) >= scores.soldier() * 0.92) {
            return bestSpecialist;
        }
        if (scores.brute() > scores.soldier() * 1.03) {
            return EncounterFunctionRole.BRUTE;
        }
        if (signals.meleeSignalScore() >= 0.90) {
            return scores.soldier() >= scores.brute() ? EncounterFunctionRole.SOLDIER : EncounterFunctionRole.BRUTE;
        }
        if (signals.rangedIdentityScore() >= 0.75 && signals.rangedSignalScore() >= 0.75) {
            return EncounterFunctionRole.ARTILLERY;
        }
        if (concealmentPackage(signals) >= 1.25) {
            return EncounterFunctionRole.AMBUSHER;
        }
        if (supportPackage(signals) >= 1.0) {
            return EncounterFunctionRole.SUPPORT;
        }
        if (signals.controlSignalScore() + signals.forcedMovementSignalScore() >= 0.8) {
            return EncounterFunctionRole.CONTROLLER;
        }
        if (signals.mobilitySignalScore() >= 0.9) {
            return EncounterFunctionRole.SKIRMISHER;
        }
        return EncounterFunctionRole.SOLDIER;
    }

    private static EncounterFunctionRole bestSpecialist(ScoreCard scores, ProfileState profiles) {
        EncounterFunctionRole best = null;
        double bestScore = 0.0;
        if (profiles.ambusher() && scores.ambusher() > bestScore) {
            best = EncounterFunctionRole.AMBUSHER;
            bestScore = scores.ambusher();
        }
        if (profiles.artillery() && scores.artillery() > bestScore) {
            best = EncounterFunctionRole.ARTILLERY;
            bestScore = scores.artillery();
        }
        if (profiles.controller() && scores.controller() > bestScore) {
            best = EncounterFunctionRole.CONTROLLER;
            bestScore = scores.controller();
        }
        if (profiles.leader() && scores.leader() > bestScore) {
            best = EncounterFunctionRole.LEADER;
            bestScore = scores.leader();
        }
        if (profiles.support() && scores.support() > bestScore) {
            best = EncounterFunctionRole.SUPPORT;
            bestScore = scores.support();
        }
        if (profiles.skirmisher() && scores.skirmisher() > bestScore) {
            best = EncounterFunctionRole.SKIRMISHER;
        }
        return best;
    }

    private static double specialistScore(EncounterFunctionRole role, ScoreCard scores) {
        return switch (role) {
            case AMBUSHER -> scores.ambusher();
            case ARTILLERY -> scores.artillery();
            case CONTROLLER -> scores.controller();
            case LEADER -> scores.leader();
            case SUPPORT -> scores.support();
            case SKIRMISHER -> scores.skirmisher();
            case BRUTE -> scores.brute();
            case SOLDIER -> scores.soldier();
        };
    }

    private static ProfileState buildProfileState(CreatureRoleSignals signals, ScoreCard scores) {
        double concealment = concealmentPackage(signals);
        double support = supportPackage(signals);
        double leader = leaderPackage(signals);
        double breadth = support + leader + signals.spellcastingSignalScore() * 0.8
                + signals.mobilitySignalScore() * 0.45 + signals.rangedIdentityScore() * 0.45
                + signals.controlSignalScore() * 0.40;
        boolean brute = signals.meleeSignalScore() >= 1.0
                && signals.durabilityScore() >= 1.9
                && signals.rangedIdentityScore() <= 0.45
                && leader < 1.0
                && support < 1.0
                && signals.controlSignalScore() + signals.forcedMovementSignalScore() <= 1.0
                && breadth < 2.1
                && scores.brute() >= scores.soldier() * 0.90;
        boolean soldier = signals.meleeSignalScore() >= 0.70
                && ((signals.defenseSignalScore() + signals.tankSignalScore() + (signals.allyCommandSignalScore() * 0.5)) >= 0.45
                || signals.rangedIdentityScore() >= 0.45
                || signals.reactionSignalScore() >= 1.0
                || signals.durabilityScore() >= 1.9)
                && !brute;
        return new ProfileState(
                concealment >= 1.0
                        && (signals.meleeSignalScore() >= 0.45 || signals.rangedSignalScore() >= 0.45)
                        && (signals.hideSignalScore() > 0.0 || signals.invisibilitySignalScore() > 0.0 || scores.ambusher() >= scores.artillery() * 0.70),
                signals.rangedIdentityScore() >= 0.75
                        && signals.rangedSignalScore() >= 0.75
                        && concealment < 1.0
                        && !(signals.meleeSignalScore() >= 1.0 && signals.rangedIdentityScore() <= 0.35),
                brute,
                signals.controlSignalScore() + signals.forcedMovementSignalScore() >= 0.95
                        || (signals.aoeSignalScore() >= 1.0 && signals.spellcastingSignalScore() >= 0.75)
                        || scores.controller() >= scores.soldier() * 0.70,
                (leader >= 1.0 && signals.totalComplexityPoints() >= 4) || scores.leader() >= scores.soldier() * 0.80,
                support >= 0.95 || (signals.healingSignalScore() > 0.0 && signals.spellcastingSignalScore() > 0.0),
                signals.mobilitySignalScore() >= 0.80
                        && (signals.meleeSignalScore() >= 0.70 || concealment >= 1.0 || scores.skirmisher() >= scores.brute() * 0.70),
                soldier
        );
    }

    private static Set<CreatureCapabilityTag> capabilityTags(CreatureRoleSignals signals) {
        EnumSet<CreatureCapabilityTag> tags = EnumSet.noneOf(CreatureCapabilityTag.class);
        if (signals.spellcastingSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.SPELLCASTER);
        if (signals.aoeSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.AOE);
        if (signals.healingSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.HEALER);
        if (signals.summonSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.SUMMONER);
        if (signals.reactionSignalScore() >= TAG_THRESHOLD) tags.add(CreatureCapabilityTag.REACTIVE);
        if (signals.rangedSignalScore() >= 1.25
                || signals.controlSignalScore() + signals.forcedMovementSignalScore() >= 1.5
                || concealmentPackage(signals) >= 1.6) {
            tags.add(CreatureCapabilityTag.BURST_DAMAGE);
        }
        return Set.copyOf(tags);
    }

    private static double concealmentPackage(CreatureRoleSignals signals) {
        return signals.stealthSignalScore()
                + (signals.hideSignalScore() * 1.25)
                + (signals.invisibilitySignalScore() * 1.15)
                + (signals.obscurementSignalScore() * 0.85);
    }

    private static double supportPackage(CreatureRoleSignals signals) {
        return signals.supportSignalScore()
                + (signals.healingSignalScore() * 1.20)
                + (signals.summonSignalScore() * 0.90)
                + (signals.defenseSignalScore() * 0.35);
    }

    private static double leaderPackage(CreatureRoleSignals signals) {
        return signals.allyEnableSignalScore()
                + (signals.allyCommandSignalScore() * 1.15)
                + (signals.summonSignalScore() * 0.60)
                + (signals.supportSignalScore() * 0.35);
    }

    private static double breadthPackage(CreatureRoleSignals signals) {
        return supportPackage(signals)
                + leaderPackage(signals)
                + signals.controlSignalScore()
                + signals.rangedIdentityScore()
                + signals.mobilitySignalScore();
    }

    private static double complexityLeaderBonus(CreatureRoleSignals signals) {
        return signals.totalComplexityPoints() >= 8 ? 1.1 : signals.totalComplexityPoints() >= 5 ? 0.55 : 0.0;
    }

    private static boolean hasEffectiveRoleScores(CreatureRoleSignals signals) {
        return signals.ambusherRoleScore() > 0.0
                || signals.artilleryRoleScore() > 0.0
                || signals.bruteRoleScore() > 0.0
                || signals.controllerRoleScore() > 0.0
                || signals.leaderRoleScore() > 0.0
                || signals.skirmisherRoleScore() > 0.0
                || signals.soldierRoleScore() > 0.0
                || signals.supportRoleScore() > 0.0;
    }

    public record CreatureRoleSignals(
            double baseActionUnitsPerRound,
            int totalComplexityPoints,
            double supportSignalScore,
            double controlSignalScore,
            double mobilitySignalScore,
            double rangedSignalScore,
            double rangedIdentityScore,
            double meleeSignalScore,
            double spellcastingSignalScore,
            double aoeSignalScore,
            double healingSignalScore,
            double summonSignalScore,
            double reactionSignalScore,
            double stealthSignalScore,
            double hideSignalScore,
            double invisibilitySignalScore,
            double obscurementSignalScore,
            double forcedMovementSignalScore,
            double allyEnableSignalScore,
            double allyCommandSignalScore,
            double defenseSignalScore,
            double tankSignalScore,
            double durabilityScore,
            double standoffMobilityScore,
            double ambusherRoleScore,
            double artilleryRoleScore,
            double bruteRoleScore,
            double soldierRoleScore,
            double controllerRoleScore,
            double leaderRoleScore,
            double skirmisherRoleScore,
            double supportRoleScore
    ) {}

    public record Classification(
            EncounterFunctionRole primaryRole,
            Set<CreatureCapabilityTag> capabilityTags
    ) {}

    private record ScoreCard(
            double ambusher,
            double artillery,
            double brute,
            double controller,
            double leader,
            double support,
            double skirmisher,
            double soldier
    ) {}

    private record ProfileState(
            boolean ambusher,
            boolean artillery,
            boolean brute,
            boolean controller,
            boolean leader,
            boolean support,
            boolean skirmisher,
            boolean soldier
    ) {}
}
