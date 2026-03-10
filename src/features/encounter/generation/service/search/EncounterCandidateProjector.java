package features.encounter.generation.service.search;

import features.encounter.calibration.service.EncounterCalibrationService;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.encounter.calibration.service.EncounterCalibrationService.PartyRelativeMetrics;
import features.creatures.api.CreatureFunctionRoleClassifier;
import features.creatures.api.CreatureFunctionRoleClassifier.CreatureRoleSignals;
import features.creatures.model.Creature;
import features.encounter.generation.service.search.model.CandidateEntry;
import features.partyanalysis.model.CreatureRoleProfile;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;
import features.partyanalysis.service.CreatureStaticAnalysisService;
import features.partyanalysis.service.EncounterWeightClassClassifier;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Projects creatures into search candidates with fallback role profiles.
 */
public final class EncounterCandidateProjector {
    private EncounterCandidateProjector() {
        throw new AssertionError("No instances");
    }

    public static List<CandidateEntry> buildCandidateEntries(
            List<Creature> pool,
            Map<Long, CreatureRoleProfile> roleProfiles,
            EncounterPartyBenchmarks party) {
        List<CandidateEntry> entries = new ArrayList<>();
        for (Creature creature : pool) {
            CreatureRoleProfile profile = roleProfiles.getOrDefault(
                    creature.Id,
                    fallbackRoleProfile(creature, party));
            entries.add(new CandidateEntry(
                    creature,
                    profile,
                    profile.weightClass(),
                    profile.primaryFunctionRole()));
        }
        return entries;
    }

    public static CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks party) {
        CreatureStaticRow staticRow = CreatureStaticAnalysisService.analyzeCreature(creature);
        CreatureFunctionRoleClassifier.Classification classification = CreatureFunctionRoleClassifier.classify(
                toCreatureRoleSignals(staticRow));
        double actionUnits = staticRow.baseActionUnitsPerRound();
        PartyRelativeMetrics metrics = EncounterCalibrationService.partyRelativeMetrics(
                creature.HP,
                creature.AC,
                creature.XP,
                actionUnits,
                party);
        double gmLoad = (staticRow.totalComplexityPoints() / 6.0) + (actionUnits - 1.0);
        var weightClass = EncounterWeightClassClassifier.classify(
                staticRow,
                classification.capabilityTags(),
                metrics.survivabilityActions(),
                metrics.offensePressure(),
                party.averageOffensePressurePerCreature(),
                gmLoad);
        return new CreatureRoleProfile(
                creature.Id,
                weightClass,
                classification.primaryRole(),
                classification.capabilityTags(),
                metrics.survivabilityActions(),
                actionUnits,
                metrics.offensePressure(),
                metrics.expectedTurnShare(),
                gmLoad,
                java.util.Set.of());
    }

    private static CreatureRoleSignals toCreatureRoleSignals(CreatureStaticRow staticRow) {
        return new CreatureRoleSignals(
                staticRow.baseActionUnitsPerRound(),
                staticRow.totalComplexityPoints(),
                staticRow.supportSignalScore(),
                staticRow.controlSignalScore(),
                staticRow.mobilitySignalScore(),
                staticRow.rangedSignalScore(),
                staticRow.meleeSignalScore(),
                staticRow.spellcastingSignalScore(),
                staticRow.aoeSignalScore(),
                staticRow.healingSignalScore(),
                staticRow.summonSignalScore(),
                staticRow.reactionSignalScore(),
                staticRow.soldierRoleScore(),
                staticRow.archerRoleScore(),
                staticRow.controllerRoleScore(),
                staticRow.skirmisherRoleScore(),
                staticRow.supportRoleScore());
    }
}
