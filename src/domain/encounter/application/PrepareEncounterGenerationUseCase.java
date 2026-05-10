package src.domain.encounter.application;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.generation.factory.EncounterDraftFactory;
import src.domain.encounter.generation.policy.EncounterAutoTuningPolicy;
import src.domain.encounter.generation.policy.EncounterCandidateProfiles;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.generation.policy.EncounterDifficultyTargets;
import src.domain.encounter.generation.value.EncounterCandidateProfile;
import src.domain.encounter.generation.value.EncounterDraft;
import src.domain.encounter.generation.value.EncounterGenerationAttempt;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
import src.domain.encounter.plan.value.EncounterPlanCreature;
import src.domain.encounter.reference.port.EncounterCreatureLookup;
import src.domain.encounter.reference.port.EncounterTableCandidateLookup;
import src.domain.encounter.reference.value.EncounterCreatureCandidateCriteria;
import src.domain.encounter.reference.value.EncounterTableCandidateCriteria;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;

// PMD suppression is local: encounter generation intentionally centralizes domain adapters here; see src/domain/encounter/DOMAIN.md.
@SuppressWarnings("PMD.CouplingBetweenObjects")
final class PrepareEncounterGenerationUseCase {

    private static final int AUTO_ATTEMPT_LIMIT = 12;
    private static final long NO_GENERATION_SEED = 0L;

    private PrepareEncounterGenerationUseCase() {
    }

    static EncounterGenerationPreparationUseCase prepare(
            EncounterPartyFactsRepository party,
            EncounterCreatureLookup creatures,
            @Nullable EncounterTableCandidateLookup encounterTables,
            EncounterGenerationRequest request,
            int searchLimit
    ) {
        PartyLoadResult partyLoad = loadPartyState(party);
        if (!partyLoad.success()) {
            return partyLoad.failure();
        }
        EncounterDifficultyMath.Thresholds thresholds = partyLoad.requireThresholds();

        LockedCreatures lockedCreatures = loadLockedCreatures(creatures, request);
        if (!lockedCreatures.success()) {
            return lockedCreatures.failure();
        }

        CandidateLoadResult candidates = loadUnlockedCandidates(
                creatures,
                encounterTables,
                request,
                thresholds,
                lockedCreatures.lockedProfiles().keySet(),
                searchLimit);
        if (!candidates.success()) {
            return candidates.failure();
        }
        if (lockedCreatures.lockedProfiles().isEmpty() && candidates.unlockedProfiles().isEmpty()) {
            return EncounterGenerationPreparationUseCase.failure("No creatures matched the current filters.");
        }

        GenerationSearchResult searchResult = generateDrafts(
                request,
                thresholds,
                partyLoad.partySize(),
                lockedCreatures,
                candidates.unlockedProfiles());
        if (searchResult.drafts().isEmpty()) {
            return EncounterGenerationPreparationUseCase.failure("No encounter compositions fit the current request.");
        }
        return EncounterGenerationPreparationUseCase.success(
                searchResult.drafts(),
                searchResult.message(),
                searchResult.diagnostics(),
                searchResult.autoResolved(),
                searchResult.fallbackUsed());
    }

    private static GenerationSearchResult generateDrafts(
            EncounterGenerationRequest request,
            EncounterDifficultyMath.Thresholds thresholds,
            int partySize,
            LockedCreatures lockedCreatures,
            List<EncounterCandidateProfile> unlockedProfiles
    ) {
        List<EncounterGenerationAttempt> attempts = EncounterAutoTuningPolicy.resolveAttempts(
                request.targetDifficulty(),
                request.targetDifficultyAuto(),
                request.tuning(),
                effectiveSeed(request),
                AUTO_ATTEMPT_LIMIT);
        SearchAccumulator accumulator = SearchAccumulator.empty(lockedCreatures.lockedProfiles().size() + unlockedProfiles.size());
        for (EncounterGenerationAttempt attempt : attempts) {
            List<EncounterDraft> drafts = EncounterDraftFactory.createDrafts(new EncounterDraftFactory.EncounterDraftRequest(
                    attempt.targetDifficulty(),
                    thresholds,
                    partySize,
                    attempt.tuning(),
                    lockedCreatures.lockedProfiles().values(),
                    lockedCreatures.lockedQuantities(),
                    unlockedProfiles));
            accumulator = accumulator.record(attempt, drafts);
            List<EncounterDraft> exactDrafts = drafts.stream()
                    .filter(draft -> draft.achievedDifficulty() == attempt.targetDifficulty())
                    .toList();
            if (!exactDrafts.isEmpty()) {
                return accumulator.exact(attempt, exactDrafts);
            }
        }
        return accumulator.fallback();
    }

    private static long effectiveSeed(EncounterGenerationRequest request) {
        if (request.generationSeed() > NO_GENERATION_SEED) {
            return request.generationSeed();
        }
        return Integer.toUnsignedLong(Objects.hash(
                request.creatureTypes(),
                request.creatureSubtypes(),
                request.biomes(),
                request.targetDifficulty(),
                request.targetDifficultyAuto(),
                request.tuning(),
                request.encounterTableIds(),
                request.excludedCreatureIds(),
                request.lockedCreatures()));
    }

    private static PartyLoadResult loadPartyState(EncounterPartyFactsRepository party) {
        EncounterPartyFactsRepository.PartyBudgetFacts facts = party.loadPartyBudgetFacts();
        if (facts.status().isStorageError()) {
            return PartyLoadResult.failure("Party data could not be loaded.");
        }
        if (facts.status().isNoActiveParty()) {
            return PartyLoadResult.failure("No active party is available.");
        }
        List<Integer> partyLevels = facts.activePartyLevels();
        EncounterDifficultyMath.Thresholds thresholds = EncounterDifficultyMath.thresholdsFor(partyLevels);
        return PartyLoadResult.success(thresholds, partyLevels.size());
    }

    private static LockedCreatures loadLockedCreatures(
            EncounterCreatureLookup creatures,
            EncounterGenerationRequest request
    ) {
        Map<Long, Integer> lockedQuantities = toLockedQuantityMap(request.lockedCreatures());
        Map<Long, EncounterCandidateProfile> lockedProfiles = loadLockedProfiles(creatures, lockedQuantities);
        if (lockedProfiles.size() != lockedQuantities.size()) {
            return LockedCreatures.failure("A locked creature could not be loaded.");
        }
        return LockedCreatures.success(lockedQuantities, lockedProfiles);
    }

    private static CandidateLoadResult loadUnlockedCandidates(
            EncounterCreatureLookup creatures,
            @Nullable EncounterTableCandidateLookup encounterTables,
            EncounterGenerationRequest request,
            EncounterDifficultyMath.Thresholds thresholds,
            Set<Long> lockedCreatureIds,
            int searchLimit
    ) {
        Set<Long> excludedCreatureIds = new LinkedHashSet<>(request.excludedCreatureIds());
        excludedCreatureIds.removeAll(lockedCreatureIds);
        if (!request.encounterTableIds().isEmpty()) {
            return loadTableCandidates(encounterTables, request, thresholds, excludedCreatureIds, lockedCreatureIds);
        }
        List<EncounterCandidateProfile> unlockedProfiles = creatures.loadCandidates(new EncounterCreatureCandidateCriteria(
                request.creatureTypes(),
                request.creatureSubtypes(),
                request.biomes(),
                0,
                EncounterDifficultyTargets.candidateMaxXp(thresholds),
                searchLimit)).stream()
                .filter(candidate -> !excludedCreatureIds.contains(candidate.id()))
                .filter(candidate -> !lockedCreatureIds.contains(candidate.id()))
                .toList();
        return CandidateLoadResult.success(unlockedProfiles);
    }

    private static CandidateLoadResult loadTableCandidates(
            @Nullable EncounterTableCandidateLookup encounterTables,
            EncounterGenerationRequest request,
            EncounterDifficultyMath.Thresholds thresholds,
            Set<Long> excludedCreatureIds,
            Set<Long> lockedCreatureIds
    ) {
        if (encounterTables == null) {
            return CandidateLoadResult.failure("Encounter tables are not available.");
        }
        List<EncounterCandidateProfile> unlockedProfiles = encounterTables.loadCandidates(new EncounterTableCandidateCriteria(
                request.encounterTableIds(),
                EncounterDifficultyTargets.candidateMaxXp(thresholds))).stream()
                .filter(candidate -> !excludedCreatureIds.contains(candidate.id()))
                .filter(candidate -> !lockedCreatureIds.contains(candidate.id()))
                .toList();
        return CandidateLoadResult.success(unlockedProfiles);
    }

    private static Map<Long, Integer> toLockedQuantityMap(List<EncounterPlanCreature> locks) {
        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (EncounterPlanCreature lock : locks) {
            if (lock == null || lock.creatureId() <= 0) {
                continue;
            }
            quantities.merge(lock.creatureId(), Math.max(1, lock.quantity()), Integer::sum);
        }
        return quantities;
    }

    private static Map<Long, EncounterCandidateProfile> loadLockedProfiles(
            EncounterCreatureLookup creatures,
            Map<Long, Integer> lockedQuantities
    ) {
        Map<Long, EncounterCandidateProfile> profiles = new LinkedHashMap<>();
        for (Long creatureId : lockedQuantities.keySet()) {
            creatures.loadCreature(creatureId)
                    .ifPresent(reference -> profiles.put(creatureId, EncounterCandidateProfiles.fromFacts(reference.toFacts())));
        }
        return profiles;
    }

    private record PartyLoadResult(
            boolean success,
            EncounterDifficultyMath.@Nullable Thresholds thresholds,
            int partySize,
            String message
    ) {

        private EncounterGenerationPreparationUseCase failure() {
            return EncounterGenerationPreparationUseCase.failure(message);
        }

        private EncounterDifficultyMath.Thresholds requireThresholds() {
            if (thresholds == null) {
                throw new IllegalStateException("Party thresholds missing for successful load.");
            }
            return thresholds;
        }

        private static PartyLoadResult success(
                EncounterDifficultyMath.Thresholds thresholds,
                int partySize
        ) {
            return new PartyLoadResult(true, thresholds, partySize, "");
        }

        private static PartyLoadResult failure(String message) {
            return new PartyLoadResult(false, null, 0, message);
        }
    }

    private record LockedCreatures(
            boolean success,
            Map<Long, Integer> lockedQuantities,
            Map<Long, EncounterCandidateProfile> lockedProfiles,
            String message
    ) {

        private EncounterGenerationPreparationUseCase failure() {
            return EncounterGenerationPreparationUseCase.failure(message);
        }

        private static LockedCreatures success(
                Map<Long, Integer> lockedQuantities,
                Map<Long, EncounterCandidateProfile> lockedProfiles
        ) {
            return new LockedCreatures(true, lockedQuantities, lockedProfiles, "");
        }

        private static LockedCreatures failure(String message) {
            return new LockedCreatures(false, Map.of(), Map.of(), message);
        }
    }

    private record SearchAccumulator(
            int candidatePoolSize,
            int attempts,
            int candidateEvaluations,
            @Nullable EncounterGenerationAttempt bestFallbackAttempt,
            List<EncounterDraft> bestFallbackDrafts
    ) {

        private static SearchAccumulator empty(int candidatePoolSize) {
            return new SearchAccumulator(candidatePoolSize, 0, 0, null, List.of());
        }

        private SearchAccumulator record(EncounterGenerationAttempt attempt, List<EncounterDraft> drafts) {
            List<EncounterDraft> safeDrafts = drafts == null ? List.of() : List.copyOf(drafts);
            if (safeDrafts.isEmpty()) {
                return new SearchAccumulator(
                        candidatePoolSize,
                        attempts + 1,
                        candidateEvaluations,
                        bestFallbackAttempt,
                        bestFallbackDrafts);
            }
            EncounterGenerationAttempt nextFallbackAttempt = bestFallbackAttempt;
            List<EncounterDraft> nextFallbackDrafts = bestFallbackDrafts;
            if (nextFallbackDrafts.isEmpty()
                    || EncounterAutoTuningPolicy.prefersFallbackDrafts(safeDrafts, nextFallbackDrafts)) {
                nextFallbackAttempt = attempt;
                nextFallbackDrafts = safeDrafts;
            }
            return new SearchAccumulator(
                    candidatePoolSize,
                    attempts + 1,
                    candidateEvaluations + safeDrafts.size(),
                    nextFallbackAttempt,
                    nextFallbackDrafts);
        }

        private GenerationSearchResult exact(EncounterGenerationAttempt attempt, List<EncounterDraft> drafts) {
            return result(attempt, drafts, false, "Encounter options generated.");
        }

        private GenerationSearchResult fallback() {
            if (bestFallbackAttempt == null || bestFallbackDrafts.isEmpty()) {
                return new GenerationSearchResult(
                        List.of(),
                        null,
                        false,
                        false,
                        "No encounter compositions fit the current request.");
            }
            return result(
                    bestFallbackAttempt,
                    bestFallbackDrafts,
                    true,
                    "No exact target found; best fallback encounter options generated.");
        }

        private GenerationSearchResult result(
                EncounterGenerationAttempt attempt,
                List<EncounterDraft> drafts,
                boolean fallbackUsed,
                String message
        ) {
            return new GenerationSearchResult(
                    drafts,
                    new EncounterGenerationDiagnosticsData(
                            attempt.targetDifficulty(),
                            attempt.tuning(),
                            candidatePoolSize,
                            attempts,
                            candidateEvaluations),
                    attempt.autoResolved(),
                    fallbackUsed,
                    message);
        }
    }

    private record GenerationSearchResult(
            List<EncounterDraft> drafts,
            @Nullable EncounterGenerationDiagnosticsData diagnostics,
            boolean autoResolved,
            boolean fallbackUsed,
            String message
    ) {

        private GenerationSearchResult {
            drafts = drafts == null ? List.of() : List.copyOf(drafts);
            message = message == null ? "" : message;
        }
    }

    private record CandidateLoadResult(
            boolean success,
            List<EncounterCandidateProfile> unlockedProfiles,
            String message
    ) {

        private EncounterGenerationPreparationUseCase failure() {
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
