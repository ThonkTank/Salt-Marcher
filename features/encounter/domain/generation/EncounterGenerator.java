package features.encounter.domain.generation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.encounter.domain.generation.helper.EncounterAutoTuningHelper;
import features.encounter.domain.generation.helper.EncounterDifficultyTargetHelper;
import features.encounter.domain.generation.helper.EncounterDraftAssemblyHelper;
import features.encounter.domain.generation.helper.EncounterRoleClassificationHelper;
import features.encounter.domain.plan.EncounterPlanCreature;
import features.encounter.domain.reference.EncounterCreatureCandidateCriteria;
import features.encounter.domain.reference.EncounterCreatureReference;
import features.encounter.domain.reference.EncounterTableCandidateCriteria;
import features.encounter.domain.session.PartyBudgetFacts;

public final class EncounterGenerator {

    private static final int SEARCH_LIMIT = 240;
    private static final int AUTO_ATTEMPT_LIMIT = 12;
    private static final long NO_GENERATION_SEED = 0L;

    private final ForeignFacts facts;

    public EncounterGenerator(ForeignFacts facts) {
        this.facts = Objects.requireNonNull(facts, "facts");
    }

    public EncounterGenerationResult generate(EncounterGenerationRequest request) {
        Preparation preparation = prepare(request, SEARCH_LIMIT);
        if (!preparation.success()) {
            return new EncounterGenerationResult(
                    false,
                    List.of(),
                    preparation.message(),
                    preparation.diagnostics(),
                    preparation.autoResolved(),
                    preparation.fallbackUsed());
        }
        return new EncounterGenerationResult(
                true,
                assemble(preparation.drafts(), request.alternativeCount()),
                preparation.message(),
                preparation.diagnostics(),
                preparation.autoResolved(),
                preparation.fallbackUsed());
    }

    private Preparation prepare(EncounterGenerationRequest request, int searchLimit) {
        PartyLoad partyLoad = loadPartyState();
        if (!partyLoad.success()) {
            return partyLoad.failure();
        }
        EncounterDifficultyThresholds thresholds = partyLoad.requireThresholds();
        LockedCreatures lockedCreatures = loadLockedCreatures(request);
        if (!lockedCreatures.success()) {
            return lockedCreatures.failure();
        }
        CandidateLoad candidates = loadUnlockedCandidates(
                request,
                thresholds,
                lockedCreatures.lockedProfiles().keySet(),
                searchLimit);
        if (!candidates.success()) {
            return candidates.failure();
        }
        if (lockedCreatures.lockedProfiles().isEmpty() && candidates.unlockedProfiles().isEmpty()) {
            return Preparation.failure("No creatures matched the current filters.");
        }
        GenerationSearch search = generateDrafts(
                request,
                thresholds,
                partyLoad.partySize(),
                lockedCreatures,
                candidates.unlockedProfiles());
        if (search.drafts().isEmpty()) {
            return Preparation.failure("No encounter compositions fit the current request.");
        }
        return Preparation.success(
                search.drafts(),
                search.message(),
                search.diagnostics(),
                search.autoResolved(),
                search.fallbackUsed());
    }

    private PartyLoad loadPartyState() {
        PartyBudgetFacts budgetFacts = facts.loadPartyBudgetFacts();
        if (budgetFacts.status().isStorageError()) {
            return PartyLoad.failure("Party data could not be loaded.");
        }
        if (budgetFacts.status().isNoActiveParty()) {
            return PartyLoad.failure("No active party is available.");
        }
        return PartyLoad.success(
                features.encounter.domain.generation.helper.EncounterDifficultyMathHelper.thresholdsFor(
                        budgetFacts.activePartyLevels()),
                budgetFacts.activePartyLevels().size());
    }

    private LockedCreatures loadLockedCreatures(EncounterGenerationRequest request) {
        Map<Long, Integer> lockedQuantities = lockedQuantityMap(request.lockedCreatures());
        Map<Long, EncounterCandidateProfile> lockedProfiles = new LinkedHashMap<>();
        for (Long creatureId : lockedQuantities.keySet()) {
            Optional<EncounterCreatureReference> reference = facts.loadCreatureReference(creatureId.longValue());
            if (reference.isPresent()) {
                lockedProfiles.put(creatureId, EncounterCandidateProfile.fromFacts(reference.orElseThrow().toFacts()));
            }
        }
        if (lockedProfiles.size() != lockedQuantities.size()) {
            return LockedCreatures.failure("A locked creature could not be loaded.");
        }
        return LockedCreatures.success(lockedQuantities, lockedProfiles);
    }

    private static Map<Long, Integer> lockedQuantityMap(List<EncounterPlanCreature> locks) {
        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (EncounterPlanCreature lock : locks == null ? List.<EncounterPlanCreature>of() : locks) {
            if (lock == null || lock.creatureId() <= 0) {
                continue;
            }
            long creatureId = lock.creatureId();
            int quantity = Math.max(1, lock.quantity());
            Integer previousQuantity = quantities.get(Long.valueOf(creatureId));
            quantities.put(
                    Long.valueOf(creatureId),
                    Integer.valueOf(previousQuantity == null ? quantity : previousQuantity.intValue() + quantity));
        }
        return quantities;
    }

    private CandidateLoad loadUnlockedCandidates(
            EncounterGenerationRequest request,
            EncounterDifficultyThresholds thresholds,
            Set<Long> lockedCreatureIds,
            int searchLimit
    ) {
        Set<Long> excludedCreatureIds = new LinkedHashSet<>(request.excludedCreatureIds());
        excludedCreatureIds.removeAll(lockedCreatureIds);
        List<EncounterCandidateProfile> profiles = request.encounterTableIds().isEmpty()
                ? creatureProfiles(request, thresholds, excludedCreatureIds, lockedCreatureIds, searchLimit)
                : tableProfiles(request, thresholds, excludedCreatureIds, lockedCreatureIds);
        if (profiles == null) {
            return CandidateLoad.failure("Encounter tables are not available.");
        }
        return CandidateLoad.success(profiles);
    }

    private List<EncounterCandidateProfile> creatureProfiles(
            EncounterGenerationRequest request,
            EncounterDifficultyThresholds thresholds,
            Set<Long> excludedCreatureIds,
            Set<Long> lockedCreatureIds,
            int searchLimit
    ) {
        EncounterCreatureCandidateCriteria criteria = new EncounterCreatureCandidateCriteria(
                request.creatureTypes(),
                request.creatureSubtypes(),
                request.biomes(),
                0,
                EncounterDifficultyTargetHelper.candidateMaxXp(thresholds),
                searchLimit);
        return filteredProfiles(facts.loadCreatureCandidates(criteria), excludedCreatureIds, lockedCreatureIds);
    }

    private List<EncounterCandidateProfile> tableProfiles(
            EncounterGenerationRequest request,
            EncounterDifficultyThresholds thresholds,
            Set<Long> excludedCreatureIds,
            Set<Long> lockedCreatureIds
    ) {
        EncounterTableCandidateCriteria criteria = new EncounterTableCandidateCriteria(
                request.encounterTableIds(),
                EncounterDifficultyTargetHelper.candidateMaxXp(thresholds));
        return filteredProfiles(facts.loadTableCandidates(criteria), excludedCreatureIds, lockedCreatureIds);
    }

    private static List<EncounterCandidateProfile> filteredProfiles(
            List<EncounterCandidateProfile> profiles,
            Set<Long> excludedCreatureIds,
            Set<Long> lockedCreatureIds
    ) {
        List<EncounterCandidateProfile> unlockedProfiles = new ArrayList<>();
        for (EncounterCandidateProfile candidate : profiles == null ? List.<EncounterCandidateProfile>of() : profiles) {
            if (!excludedCreatureIds.contains(candidate.id()) && !lockedCreatureIds.contains(candidate.id())) {
                unlockedProfiles.add(candidate);
            }
        }
        return List.copyOf(unlockedProfiles);
    }

    private GenerationSearch generateDrafts(
            EncounterGenerationRequest request,
            EncounterDifficultyThresholds thresholds,
            int partySize,
            LockedCreatures lockedCreatures,
            List<EncounterCandidateProfile> unlockedProfiles
    ) {
        List<EncounterGenerationAttempt> attempts = EncounterAutoTuningHelper.resolveAttempts(
                request.targetDifficulty(),
                request.targetDifficultyAuto(),
                request.tuning(),
                effectiveSeed(request),
                AUTO_ATTEMPT_LIMIT);
        SearchAccumulator accumulator =
                SearchAccumulator.empty(lockedCreatures.lockedProfiles().size() + unlockedProfiles.size());
        for (EncounterGenerationAttempt attempt : attempts) {
            List<EncounterDraft> drafts = EncounterDraftAssemblyHelper.createDrafts(new EncounterDraftGenerationModel(
                    attempt.targetDifficulty(),
                    thresholds,
                    partySize,
                    attempt.tuning(),
                    lockedCreatures.lockedProfiles().values(),
                    lockedCreatures.lockedQuantities(),
                    unlockedProfiles,
                    request.finiteCreatureStockCaps()));
            accumulator = accumulator.record(attempt, drafts);
            List<EncounterDraft> exactDrafts = exactDrafts(drafts, attempt);
            if (!exactDrafts.isEmpty()) {
                return accumulator.exact(attempt, exactDrafts);
            }
        }
        return accumulator.fallback();
    }

    private List<EncounterGeneratedAlternative> assemble(List<EncounterDraft> drafts, int alternativeCount) {
        Map<Long, EncounterCreatureReference> detailCache = new LinkedHashMap<>();
        List<EncounterGeneratedAlternative> encounters = new ArrayList<>();
        int remainingAlternatives = alternativeCount;
        for (EncounterDraft draft : drafts) {
            if (remainingAlternatives <= 0) {
                break;
            }
            remainingAlternatives--;
            EncounterDraftMetrics metrics = draft.metrics();
            List<GeneratedEncounterCreatureData> creatures = new ArrayList<>();
            for (EncounterDraftEntry entry : draft.entries()) {
                EncounterCreatureReference detail = cachedCreatureDetail(detailCache, entry.creatureId());
                EncounterCreatureFacts creatureFacts = detail == null ? entry.facts() : detail.toFacts();
                EncounterRoleClassification classification = EncounterRoleClassificationHelper.classify(creatureFacts);
                creatures.add(new GeneratedEncounterCreatureData(
                        entry.creatureId(),
                        entry.creatureName(),
                        entry.challengeRating(),
                        entry.xp(),
                        entry.quantity(),
                        classification.role().label(),
                        classification.tags()));
            }
            encounters.add(new EncounterGeneratedAlternative(
                    draft.title(),
                    draft.achievedDifficulty(),
                    metrics.adjustedXp(),
                    creatures));
        }
        return List.copyOf(encounters);
    }

    private @Nullable EncounterCreatureReference cachedCreatureDetail(
            Map<Long, EncounterCreatureReference> detailCache,
            long creatureId
    ) {
        EncounterCreatureReference cached = detailCache.get(Long.valueOf(creatureId));
        if (cached != null) {
            return cached;
        }
        Optional<EncounterCreatureReference> loaded = facts.loadCreatureReference(creatureId);
        if (loaded.isPresent()) {
            EncounterCreatureReference reference = loaded.orElseThrow();
            detailCache.put(Long.valueOf(creatureId), reference);
            return reference;
        }
        return null;
    }

    private static List<EncounterDraft> exactDrafts(
            List<EncounterDraft> drafts,
            EncounterGenerationAttempt attempt
    ) {
        List<EncounterDraft> exactDrafts = new ArrayList<>();
        for (EncounterDraft draft : drafts == null ? List.<EncounterDraft>of() : drafts) {
            if (draft.achievedDifficulty() == attempt.targetDifficulty()) {
                exactDrafts.add(draft);
            }
        }
        return List.copyOf(exactDrafts);
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

    public interface ForeignFacts {
        PartyBudgetFacts loadPartyBudgetFacts();

        Optional<EncounterCreatureReference> loadCreatureReference(long creatureId);

        List<EncounterCandidateProfile> loadCreatureCandidates(EncounterCreatureCandidateCriteria criteria);

        List<EncounterCandidateProfile> loadTableCandidates(EncounterTableCandidateCriteria criteria);
    }

    private record PartyLoad(
            boolean success,
            @Nullable EncounterDifficultyThresholds thresholds,
            int partySize,
            String message
    ) {

        Preparation failure() {
            return Preparation.failure(message);
        }

        EncounterDifficultyThresholds requireThresholds() {
            if (thresholds == null) {
                throw new IllegalStateException("Party thresholds missing for successful load.");
            }
            return thresholds;
        }

        private static PartyLoad success(EncounterDifficultyThresholds thresholds, int partySize) {
            return new PartyLoad(true, thresholds, partySize, "");
        }

        private static PartyLoad failure(String message) {
            return new PartyLoad(false, null, 0, message);
        }
    }

    private record LockedCreatures(
            boolean success,
            Map<Long, Integer> lockedQuantities,
            Map<Long, EncounterCandidateProfile> lockedProfiles,
            String message
    ) {

        Preparation failure() {
            return Preparation.failure(message);
        }

        private static LockedCreatures success(
                Map<Long, Integer> lockedQuantities,
                Map<Long, EncounterCandidateProfile> lockedProfiles
        ) {
            return new LockedCreatures(
                    true,
                    Collections.unmodifiableMap(new LinkedHashMap<>(lockedQuantities)),
                    Collections.unmodifiableMap(new LinkedHashMap<>(lockedProfiles)),
                    "");
        }

        private static LockedCreatures failure(String message) {
            return new LockedCreatures(false, Map.of(), Map.of(), message);
        }
    }

    private record CandidateLoad(
            boolean success,
            List<EncounterCandidateProfile> unlockedProfiles,
            String message
    ) {

        Preparation failure() {
            return Preparation.failure(message);
        }

        private static CandidateLoad success(List<EncounterCandidateProfile> unlockedProfiles) {
            return new CandidateLoad(true, unlockedProfiles, "");
        }

        private static CandidateLoad failure(String message) {
            return new CandidateLoad(false, List.of(), message);
        }
    }

    private record Preparation(
            boolean success,
            List<EncounterDraft> drafts,
            String message,
            @Nullable EncounterGenerationDiagnosticsData diagnostics,
            boolean autoResolved,
            boolean fallbackUsed
    ) {

        Preparation {
            drafts = drafts == null ? List.of() : List.copyOf(drafts);
            message = message == null ? "" : message;
        }

        static Preparation success(
                List<EncounterDraft> drafts,
                String message,
                @Nullable EncounterGenerationDiagnosticsData diagnostics,
                boolean autoResolved,
                boolean fallbackUsed
        ) {
            return new Preparation(true, drafts, message, diagnostics, autoResolved, fallbackUsed);
        }

        static Preparation failure(String message) {
            return new Preparation(false, List.of(), message, null, false, false);
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
                    || EncounterAutoTuningHelper.prefersFallbackDrafts(safeDrafts, nextFallbackDrafts)) {
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

        private GenerationSearch exact(EncounterGenerationAttempt attempt, List<EncounterDraft> drafts) {
            return result(attempt, drafts, false, "Encounter options generated.");
        }

        private GenerationSearch fallback() {
            if (bestFallbackAttempt == null || bestFallbackDrafts.isEmpty()) {
                return new GenerationSearch(
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

        private GenerationSearch result(
                EncounterGenerationAttempt attempt,
                List<EncounterDraft> drafts,
                boolean fallbackUsed,
                String message
        ) {
            return new GenerationSearch(
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

    private record GenerationSearch(
            List<EncounterDraft> drafts,
            @Nullable EncounterGenerationDiagnosticsData diagnostics,
            boolean autoResolved,
            boolean fallbackUsed,
            String message
    ) {

        GenerationSearch {
            drafts = drafts == null ? List.of() : List.copyOf(drafts);
            message = message == null ? "" : message;
        }
    }
}
