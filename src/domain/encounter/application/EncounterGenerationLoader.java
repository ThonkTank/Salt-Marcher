package src.domain.encounter.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.EncounterCandidatesResult;
import src.domain.creatures.published.EncounterCandidateQuery;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.published.EncounterBudgetSummary;
import src.domain.encounter.published.EncounterGenerationRequest;
import src.domain.encounter.generation.value.EncounterCandidateProfile;
import src.domain.encounter.generation.value.EncounterCandidateProfiles;
import src.domain.encounter.generation.value.EncounterDifficultyMath;
import src.domain.encounter.generation.value.EncounterDifficultyTargets;
import src.domain.encounter.generation.value.EncounterDraft;
import src.domain.encounter.generation.value.EncounterDraftFactory;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.ReadStatus;
import src.domain.party.PartyApplicationService;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

// PMD suppression is local: encounter generation intentionally centralizes domain adapters here; see src/domain/encounter/DOMAIN.md.
@SuppressWarnings("PMD.CouplingBetweenObjects")
final class EncounterGenerationLoader {

    private EncounterGenerationLoader() {
    }

    static EncounterGenerationPreparation prepare(
            PartyApplicationService party,
            CreaturesApplicationService creatures,
            EncounterGenerationRequest request,
            int searchLimit
    ) {
        PartyLoadResult partyLoad = loadPartyState(party);
        if (!partyLoad.success()) {
            return partyLoad.failure();
        }
        EncounterBudgetSummary budget = partyLoad.requireBudget();
        EncounterDifficultyMath.Thresholds thresholds = partyLoad.requireThresholds();

        LockedCreatures lockedCreatures = loadLockedCreatures(creatures, request, budget);
        if (!lockedCreatures.success()) {
            return lockedCreatures.failure();
        }

        CandidateLoadResult candidates = loadUnlockedCandidates(
                creatures,
                request,
                thresholds,
                lockedCreatures.lockedProfiles().keySet(),
                searchLimit);
        if (!candidates.success()) {
            return candidates.failure();
        }
        if (lockedCreatures.lockedProfiles().isEmpty() && candidates.unlockedProfiles().isEmpty()) {
                return EncounterGenerationPreparation.failure(
                    EncounterGenerationUseCase.GenerateStatus.NO_CREATURES,
                    budget,
                    "No creatures matched the current filters.");
        }

        List<EncounterDraft> drafts = EncounterDraftFactory.createDrafts(new EncounterDraftFactory.EncounterDraftRequest(
                request.targetDifficulty(),
                thresholds,
                partyLoad.partySize(),
                lockedCreatures.lockedProfiles().values(),
                lockedCreatures.lockedQuantities(),
                candidates.unlockedProfiles()));
        if (drafts.isEmpty()) {
            return EncounterGenerationPreparation.failure(
                    EncounterGenerationUseCase.GenerateStatus.NO_CREATURES,
                    budget,
                    "No encounter compositions fit the current request.");
        }
        return EncounterGenerationPreparation.success(budget, drafts);
    }

    private static PartyLoadResult loadPartyState(PartyApplicationService party) {
        ActivePartyCompositionResult compositionResult = party.loadActivePartyComposition();
        AdventuringDayResult dayResult = party.loadAdventuringDaySummary();
        if (compositionResult.status() != ReadStatus.SUCCESS || dayResult.status() != ReadStatus.SUCCESS) {
            return PartyLoadResult.failure(EncounterGenerationUseCase.GenerateStatus.STORAGE_ERROR, "Party data could not be loaded.");
        }
        List<Integer> partyLevels = compositionResult.composition().activePartyLevels();
        if (partyLevels.isEmpty()) {
            return PartyLoadResult.failure(EncounterGenerationUseCase.GenerateStatus.NO_ACTIVE_PARTY, "No active party is available.");
        }
        EncounterDifficultyMath.Thresholds thresholds = EncounterDifficultyMath.thresholdsFor(partyLevels);
        EncounterBudgetSummary budget = EncounterDifficultyMath.summarizeBudget(partyLevels, dayResult.summary());
        return PartyLoadResult.success(thresholds, budget, partyLevels.size());
    }

    private static LockedCreatures loadLockedCreatures(
            CreaturesApplicationService creatures,
            EncounterGenerationRequest request,
            EncounterBudgetSummary budget
    ) {
        Map<Long, Integer> lockedQuantities = toLockedQuantityMap(request.lockedCreatures());
        Map<Long, EncounterCandidateProfile> lockedProfiles = loadLockedProfiles(creatures, lockedQuantities);
        if (lockedProfiles.size() != lockedQuantities.size()) {
            return LockedCreatures.failure(budget, "A locked creature could not be loaded.");
        }
        return LockedCreatures.success(lockedQuantities, lockedProfiles);
    }

    private static CandidateLoadResult loadUnlockedCandidates(
            CreaturesApplicationService creatures,
            EncounterGenerationRequest request,
            EncounterDifficultyMath.Thresholds thresholds,
            Set<Long> lockedCreatureIds,
            int searchLimit
    ) {
        Set<Long> excludedCreatureIds = new LinkedHashSet<>(request.excludedCreatureIds());
        excludedCreatureIds.removeAll(lockedCreatureIds);
        EncounterCandidatesResult candidateResult = creatures.loadEncounterCandidates(new EncounterCandidateQuery(
                request.creatureTypes(),
                request.creatureSubtypes(),
                request.biomes(),
                0,
                EncounterDifficultyTargets.candidateMaxXp(thresholds),
                searchLimit));
        if (candidateResult.status() == CreatureQueryStatus.INVALID_QUERY) {
            return CandidateLoadResult.failure("Encounter filters are invalid.", EncounterGenerationUseCase.GenerateStatus.INVALID_REQUEST);
        }
        if (candidateResult.status() != CreatureQueryStatus.SUCCESS) {
            return CandidateLoadResult.failure("Creature data could not be loaded.", EncounterGenerationUseCase.GenerateStatus.STORAGE_ERROR);
        }
        List<EncounterCandidateProfile> unlockedProfiles = candidateResult.candidates().stream()
                .filter(candidate -> !excludedCreatureIds.contains(candidate.id()))
                .filter(candidate -> !lockedCreatureIds.contains(candidate.id()))
                .map(candidate -> EncounterCandidateProfiles.fromCandidate(candidate, null))
                .toList();
        return CandidateLoadResult.success(unlockedProfiles);
    }

    private static Map<Long, Integer> toLockedQuantityMap(List<src.domain.encounter.published.EncounterLock> locks) {
        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (src.domain.encounter.published.EncounterLock lock : locks) {
            if (lock == null || lock.creatureId() <= 0) {
                continue;
            }
            quantities.merge(lock.creatureId(), Math.max(1, lock.quantity()), Integer::sum);
        }
        return quantities;
    }

    private static Map<Long, EncounterCandidateProfile> loadLockedProfiles(
        CreaturesApplicationService creatures,
        Map<Long, Integer> lockedQuantities
    ) {
        Map<Long, EncounterCandidateProfile> profiles = new LinkedHashMap<>();
        for (Long creatureId : lockedQuantities.keySet()) {
            CreatureDetailResult detailResult = creatures.loadCreatureDetail(creatureId);
            if (detailResult.status() != CreatureLookupStatus.SUCCESS || detailResult.detail() == null) {
                continue;
            }
            CreatureDetail detail = detailResult.detail();
            profiles.put(creatureId, EncounterCandidateProfiles.fromDetail(detail));
        }
        return profiles;
    }

    private record PartyLoadResult(
            EncounterGenerationUseCase.GenerateStatus status,
            EncounterDifficultyMath.@Nullable Thresholds thresholds,
            @Nullable EncounterBudgetSummary budget,
            int partySize,
            String message
    ) {

        private boolean success() {
            return status.isSuccessful();
        }

        private EncounterGenerationPreparation failure() {
            return EncounterGenerationPreparation.failure(status, budget, message);
        }

        private EncounterDifficultyMath.Thresholds requireThresholds() {
            if (thresholds == null) {
                throw new IllegalStateException("Party thresholds missing for successful load.");
            }
            return thresholds;
        }

        private EncounterBudgetSummary requireBudget() {
            if (budget == null) {
                throw new IllegalStateException("Party budget missing for successful load.");
            }
            return budget;
        }

        private static PartyLoadResult success(
                EncounterDifficultyMath.Thresholds thresholds,
                EncounterBudgetSummary budget,
                int partySize
        ) {
            return new PartyLoadResult(
                    EncounterGenerationUseCase.GenerateStatus.successfulStatus(),
                    thresholds,
                    budget,
                    partySize,
                    "");
        }

        private static PartyLoadResult failure(
                EncounterGenerationUseCase.GenerateStatus status,
                String message
        ) {
            return new PartyLoadResult(status, null, null, 0, message);
        }
    }

    private record LockedCreatures(
            EncounterGenerationUseCase.GenerateStatus status,
            @Nullable EncounterBudgetSummary budget,
            Map<Long, Integer> lockedQuantities,
            Map<Long, EncounterCandidateProfile> lockedProfiles,
            String message
    ) {

        private boolean success() {
            return status.isSuccessful();
        }

        private EncounterGenerationPreparation failure() {
            return EncounterGenerationPreparation.failure(status, budget, message);
        }

        private static LockedCreatures success(
                Map<Long, Integer> lockedQuantities,
                Map<Long, EncounterCandidateProfile> lockedProfiles
        ) {
            return new LockedCreatures(
                    EncounterGenerationUseCase.GenerateStatus.successfulStatus(),
                    null,
                    lockedQuantities,
                    lockedProfiles,
                    "");
        }

        private static LockedCreatures failure(EncounterBudgetSummary budget, String message) {
            return new LockedCreatures(
                    EncounterGenerationUseCase.GenerateStatus.INVALID_REQUEST,
                    budget,
                    Map.of(),
                    Map.of(),
                    message);
        }
    }

    private record CandidateLoadResult(
            EncounterGenerationUseCase.GenerateStatus status,
            List<EncounterCandidateProfile> unlockedProfiles,
            String message
    ) {

        private boolean success() {
            return status.isSuccessful();
        }

        private EncounterGenerationPreparation failure() {
            return EncounterGenerationPreparation.failure(status, null, message);
        }

        private static CandidateLoadResult success(List<EncounterCandidateProfile> unlockedProfiles) {
            return new CandidateLoadResult(EncounterGenerationUseCase.GenerateStatus.successfulStatus(), unlockedProfiles, "");
        }

        private static CandidateLoadResult failure(String message, EncounterGenerationUseCase.GenerateStatus status) {
            return new CandidateLoadResult(status, List.of(), message);
        }
    }
}
