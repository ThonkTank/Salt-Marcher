package features.encounter.generation.service.search;

import features.creaturecatalog.model.Creature;
import features.encounter.analysis.model.CreatureRoleProfile;
import features.encounter.analysis.service.CreatureFunctionRoleClassifier;
import features.encounter.analysis.service.CreatureStaticAnalysisService;
import features.encounter.analysis.service.EncounterRoleProjector;
import features.encounter.analysis.service.EncounterWeightClassClassifier;
import features.encounter.analysis.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;
import features.encounter.generation.service.search.model.CandidateEntry;
import features.encounter.calibration.service.EncounterCalibrationService;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.encounter.calibration.service.EncounterCalibrationService.PartyRelativeMetrics;

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
                    EncounterRoleProjector.projectMonsterRole(profile),
                    profile.weightClass(),
                    profile.primaryFunctionRole()));
        }
        return entries;
    }

    public static CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks party) {
        CreatureStaticRow staticRow = CreatureStaticAnalysisService.analyzeCreature(creature);
        CreatureFunctionRoleClassifier.Classification classification = CreatureFunctionRoleClassifier.classify(staticRow);
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
                classification.secondaryRole(),
                classification.capabilityTags(),
                metrics.survivabilityActions(),
                actionUnits,
                metrics.offensePressure(),
                metrics.expectedTurnShare(),
                gmLoad,
                java.util.Set.of());
    }
}
