package src.domain.encounter.model.generation.usecase;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.helper.EncounterDifficultyTargetHelper;
import src.domain.encounter.model.generation.EncounterCandidateProfile;
import src.domain.encounter.model.generation.EncounterDifficultyThresholds;
import src.domain.encounter.model.generation.EncounterGenerationRequest;
import src.domain.encounter.model.reference.EncounterCreatureCandidateCriteria;
import src.domain.encounter.model.reference.EncounterTableCandidateCriteria;
import src.domain.encounter.model.reference.port.ApplicationEncounterCreatureCatalogPort;
import src.domain.encounter.model.reference.port.ApplicationEncounterTableCandidatePort;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.reference.repository.EncounterTableCandidateRepository;

final class EncounterGenerationUnlockedCandidateUseCase {

    private EncounterGenerationUnlockedCandidateUseCase() {
    }

    static CandidateLoadResult loadUnlockedCandidates(
            EncounterCreatureRepository creatures,
            ApplicationEncounterCreatureCatalogPort creatureCatalog,
            @Nullable EncounterTableCandidateRepository encounterTables,
            @Nullable ApplicationEncounterTableCandidatePort tableCandidates,
            EncounterGenerationRequest request,
            EncounterDifficultyThresholds thresholds,
            Set<Long> lockedCreatureIds,
            int searchLimit
    ) {
        Set<Long> excludedCreatureIds = new LinkedHashSet<>(request.excludedCreatureIds());
        excludedCreatureIds.removeAll(lockedCreatureIds);
        if (!request.encounterTableIds().isEmpty()) {
            return loadTableCandidates(
                    tableCandidates,
                    encounterTables,
                    request,
                    thresholds,
                    excludedCreatureIds,
                    lockedCreatureIds);
        }
        EncounterCreatureCandidateCriteria criteria = new EncounterCreatureCandidateCriteria(
                request.creatureTypes(),
                request.creatureSubtypes(),
                request.biomes(),
                0,
                EncounterDifficultyTargetHelper.candidateMaxXp(thresholds),
                searchLimit);
        creatures.requestCandidates(criteria);
        List<EncounterCandidateProfile> unlockedProfiles = new ArrayList<>();
        for (EncounterCandidateProfile candidate : creatureCatalog.loadCandidates()) {
            if (!excludedCreatureIds.contains(candidate.id()) && !lockedCreatureIds.contains(candidate.id())) {
                unlockedProfiles.add(candidate);
            }
        }
        return CandidateLoadResult.success(unlockedProfiles);
    }

    private static CandidateLoadResult loadTableCandidates(
            @Nullable ApplicationEncounterTableCandidatePort tableCandidates,
            @Nullable EncounterTableCandidateRepository encounterTables,
            EncounterGenerationRequest request,
            EncounterDifficultyThresholds thresholds,
            Set<Long> excludedCreatureIds,
            Set<Long> lockedCreatureIds
    ) {
        if (encounterTables == null || tableCandidates == null) {
            return CandidateLoadResult.failure("Encounter tables are not available.");
        }
        EncounterTableCandidateCriteria criteria = new EncounterTableCandidateCriteria(
                request.encounterTableIds(),
                EncounterDifficultyTargetHelper.candidateMaxXp(thresholds));
        encounterTables.requestCandidates(criteria);
        List<EncounterCandidateProfile> unlockedProfiles = new ArrayList<>();
        for (EncounterCandidateProfile candidate : tableCandidates.loadCandidates()) {
            if (!excludedCreatureIds.contains(candidate.id()) && !lockedCreatureIds.contains(candidate.id())) {
                unlockedProfiles.add(candidate);
            }
        }
        return CandidateLoadResult.success(unlockedProfiles);
    }

    record CandidateLoadResult(
            boolean success,
            List<EncounterCandidateProfile> unlockedProfiles,
            String message
    ) {

        EncounterGenerationPreparationUseCase failure() {
            return EncounterGenerationPreparationUseCase.failure(message);
        }

        private static CandidateLoadResult success(List<EncounterCandidateProfile> unlockedProfiles) {
            return new CandidateLoadResult(true, unlockedProfiles, "");
        }

        private static CandidateLoadResult failure(String message) {
            return new CandidateLoadResult(false, List.of(), message);
        }
    }
}
