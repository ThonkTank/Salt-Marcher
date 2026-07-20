package features.creatures.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.jspecify.annotations.Nullable;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.Measurement;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import features.creatures.domain.catalog.CreatureCatalogData;
import features.creatures.domain.catalog.CreatureCatalogData.CatalogSortField;
import features.creatures.domain.catalog.CreatureCatalogData.CreatureProfile;
import features.creatures.domain.catalog.port.CreatureCatalogPort;
import features.creatures.api.CreatureCatalogPageResult;
import features.creatures.api.CreatureCatalogQuery;
import features.creatures.api.CreatureCatalogQueryApi;
import features.creatures.api.CreatureCatalogRow;
import features.creatures.api.CreatureDetailResult;
import features.creatures.api.CreatureEncounterCandidatesResult;
import features.creatures.api.CreatureFilterOptionsResult;
import features.creatures.api.CreatureLookupStatus;
import features.creatures.api.CreatureQueryStatus;
import features.creatures.api.CreatureReadStatus;
import features.creatures.api.CreatureReferenceIndexResult;
import features.creatures.api.CreatureReferenceIndexStatus;
import features.creatures.api.RefreshCreatureReferenceIndexCommand;
import features.creatures.api.RefreshCreatureEncounterCandidatesCommand;
import features.creatures.api.SelectCreatureDetailCommand;
import features.creatures.api.CreatureFactsQuery;
import features.creatures.api.CreatureFactsSnapshotResult;

/**
 * Public backend facade for creature catalog publication.
 */
public final class CreaturesApplicationService
        implements features.creatures.api.CreaturesApi, CreatureCatalogQueryApi {

    private static final long NO_CREATURE_ID = 0L;
    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_PAGE_OFFSET = 0;
    private static final int DEFAULT_ENCOUNTER_CANDIDATE_LIMIT = 250;
    private static final int MAX_ENCOUNTER_CANDIDATE_LIMIT = 1000;
    private static final String DESCENDING_SORT_DIRECTION = "DESCENDING";
    private static final String COMMAND_PARAMETER = "command";
    private static final DiagnosticId FILTER_OPTIONS_FAILURE =
            new DiagnosticId("creatures.filter-options.storage-failure");
    private static final DiagnosticId CATALOG_FAILURE = new DiagnosticId("creatures.catalog.storage-failure");
    private static final DiagnosticId REFERENCE_INDEX_FAILURE =
            new DiagnosticId("creatures.reference-index.storage-failure");
    private static final DiagnosticId DETAIL_FAILURE = new DiagnosticId("creatures.detail.storage-failure");
    private static final DiagnosticId ENCOUNTER_CANDIDATES_FAILURE =
            new DiagnosticId("creatures.encounter-candidates.storage-failure");
    private static final DiagnosticId FACTS_READ = new DiagnosticId("creatures.facts.read");

    private static final List<String> CHALLENGE_RATINGS = List.of(
            "0", "1/8", "1/4", "1/2",
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
            "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
            "21", "22", "23", "24", "25", "26", "27", "28", "29", "30");

    private static final Map<String, Integer> CR_TO_XP = Map.ofEntries(
            Map.entry("0", 10),
            Map.entry("1/8", 25),
            Map.entry("1/4", 50),
            Map.entry("1/2", 100),
            Map.entry("1", 200),
            Map.entry("2", 450),
            Map.entry("3", 700),
            Map.entry("4", 1100),
            Map.entry("5", 1800),
            Map.entry("6", 2300),
            Map.entry("7", 2900),
            Map.entry("8", 3900),
            Map.entry("9", 5000),
            Map.entry("10", 5900),
            Map.entry("11", 7200),
            Map.entry("12", 8400),
            Map.entry("13", 10000),
            Map.entry("14", 11500),
            Map.entry("15", 13000),
            Map.entry("16", 15000),
            Map.entry("17", 18000),
            Map.entry("18", 20000),
            Map.entry("19", 22000),
            Map.entry("20", 25000),
            Map.entry("21", 33000),
            Map.entry("22", 41000),
            Map.entry("23", 50000),
            Map.entry("24", 62000),
            Map.entry("25", 75000),
            Map.entry("26", 90000),
            Map.entry("27", 105000),
            Map.entry("28", 120000),
            Map.entry("29", 135000),
            Map.entry("30", 155000));

    private final CreatureCatalogPort lookup;
    private final CreaturesPublishedState publishedState;
    private final ExecutionLane executionLane;
    private final ExecutionLane catalogReadLane;
    private final ExecutionLane factsLane;
    private final Diagnostics diagnostics;
    private final Object referenceIndexLock = new Object();
    private long referenceIndexRevision;

    public CreaturesApplicationService(
            CreatureCatalogPort lookup,
            CreaturesPublishedState publishedState
    ) {
        this(
                lookup,
                publishedState,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    public CreaturesApplicationService(
            CreatureCatalogPort lookup,
            CreaturesPublishedState publishedState,
            ExecutionLane executionLane,
            ExecutionLane factsLane,
            Diagnostics diagnostics
    ) {
        this(lookup, publishedState, executionLane, executionLane, factsLane, diagnostics);
    }

    public CreaturesApplicationService(
            CreatureCatalogPort lookup,
            CreaturesPublishedState publishedState,
            ExecutionLane executionLane,
            ExecutionLane catalogReadLane,
            ExecutionLane factsLane,
            Diagnostics diagnostics
    ) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
        this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.catalogReadLane = Objects.requireNonNull(catalogReadLane, "catalogReadLane");
        this.factsLane = Objects.requireNonNull(factsLane, "factsLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    @Override
    public CompletionStage<CreatureFilterOptionsResult> loadFilterOptions() {
        CompletableFuture<CreatureFilterOptionsResult> completion = new CompletableFuture<>();
        try {
            catalogReadLane.execute(() -> completion.complete(loadFilterOptionsInLane()));
        } catch (RuntimeException exception) {
            diagnostics.failure(FILTER_OPTIONS_FAILURE, exception.getClass());
            completion.complete(filterOptionsStorageError());
        }
        return completion;
    }

    private CreatureFilterOptionsResult loadFilterOptionsInLane() {
        try {
            return new CreatureFilterOptionsResult(
                    CreatureReadStatus.SUCCESS,
                    CreatureCatalogProjection.filterOptions(
                            lookup.loadFilterValues(),
                            CHALLENGE_RATINGS));
        } catch (IllegalStateException exception) {
            diagnostics.failure(FILTER_OPTIONS_FAILURE, exception.getClass());
            return filterOptionsStorageError();
        }
    }

    private static CreatureFilterOptionsResult filterOptionsStorageError() {
        return new CreatureFilterOptionsResult(
                CreatureReadStatus.STORAGE_ERROR,
                CreatureCatalogProjection.filterOptions(CreatureCatalogData.emptyFilterValues(), List.of()));
    }

    @Override
    public CompletionStage<CreatureCatalogPageResult> search(CreatureCatalogQuery query) {
        CatalogRequest request = CatalogRequest.from(query);
        CompletableFuture<CreatureCatalogPageResult> completion = new CompletableFuture<>();
        try {
            catalogReadLane.execute(() -> completion.complete(searchInLane(request)));
        } catch (RuntimeException exception) {
            diagnostics.failure(CATALOG_FAILURE, exception.getClass());
            completion.complete(new CreatureCatalogPageResult(
                    CreatureQueryStatus.STORAGE_ERROR,
                    CreatureCatalogProjection.catalogPage(request.emptyPage())));
        }
        return completion;
    }

    private CreatureCatalogPageResult searchInLane(CatalogRequest request) {
        try {
            if (!request.hasValidChallengeRatingRange()) {
                return catalogResult(CreatureQueryStatus.INVALID_QUERY, request.emptyPage());
            }
            return catalogResult(CreatureQueryStatus.SUCCESS, lookup.searchCatalog(request.spec()));
        } catch (IllegalStateException exception) {
            diagnostics.failure(CATALOG_FAILURE, exception.getClass());
            return catalogResult(CreatureQueryStatus.STORAGE_ERROR, request.emptyPage());
        }
    }

    private static CreatureCatalogPageResult catalogResult(
            CreatureQueryStatus status,
            CreatureCatalogData.CatalogPageData page
    ) {
        return new CreatureCatalogPageResult(status, CreatureCatalogProjection.catalogPage(page));
    }

    @Override
    public void refreshReferenceIndex(RefreshCreatureReferenceIndexCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        long revision;
        synchronized (referenceIndexLock) {
            revision = ++referenceIndexRevision;
        }
        publishedState.publishReferenceIndex(new CreatureReferenceIndexResult(
                CreatureReferenceIndexStatus.LOADING, revision, List.of()));
        try {
            executionLane.execute(() -> refreshReferenceIndexInLane(revision));
        } catch (RuntimeException exception) {
            diagnostics.failure(REFERENCE_INDEX_FAILURE, exception.getClass());
            publishReferenceIndex(revision, CreatureReferenceIndexStatus.STORAGE_ERROR, List.of());
        }
    }

    private void refreshReferenceIndexInLane(long revision) {
        try {
            List<CreatureCatalogRow> rows = new ArrayList<>();
            int offset = 0;
            int totalCount;
            do {
                CatalogRequest request = CatalogRequest.referenceIndex(offset);
                CreatureCatalogPageResult result = catalogResult(
                        CreatureQueryStatus.SUCCESS,
                        lookup.searchCatalog(request.spec()));
                rows.addAll(result.page().rows());
                totalCount = result.page().totalCount();
                offset += Math.max(1, result.page().pageSize());
            } while (offset < totalCount);
            publishReferenceIndex(revision, CreatureReferenceIndexStatus.SUCCESS, rows);
        } catch (IllegalStateException exception) {
            diagnostics.failure(REFERENCE_INDEX_FAILURE, exception.getClass());
            publishReferenceIndex(revision, CreatureReferenceIndexStatus.STORAGE_ERROR, List.of());
        }
    }

    private void publishReferenceIndex(
            long revision,
            CreatureReferenceIndexStatus status,
            List<CreatureCatalogRow> rows
    ) {
        synchronized (referenceIndexLock) {
            if (revision != referenceIndexRevision) {
                return;
            }
            publishedState.publishReferenceIndex(new CreatureReferenceIndexResult(status, revision, rows));
        }
    }

    public void selectCreatureDetail(SelectCreatureDetailCommand command) {
        executionLane.execute(() -> selectCreatureDetailInLane(command));
    }

    private void selectCreatureDetailInLane(SelectCreatureDetailCommand command) {
        try {
            long creatureId = command == null ? NO_CREATURE_ID : command.creatureId();
            if (creatureId <= 0) {
                publishDetail(CreatureLookupStatus.NOT_FOUND, null);
                return;
            }
            CreatureProfile detail = lookup.loadCreatureDetail(creatureId);
            publishDetail(detail == null ? CreatureLookupStatus.NOT_FOUND : CreatureLookupStatus.SUCCESS, detail);
        } catch (IllegalStateException exception) {
            diagnostics.failure(DETAIL_FAILURE, exception.getClass());
            publishDetail(CreatureLookupStatus.STORAGE_ERROR, null);
        }
    }

    public void refreshEncounterCandidates(RefreshCreatureEncounterCandidatesCommand command) {
        EncounterCandidateRequest request = EncounterCandidateRequest.from(command);
        executionLane.execute(() -> refreshEncounterCandidatesInLane(request));
    }

    @Override
    public CompletionStage<CreatureFactsSnapshotResult> loadFacts(CreatureFactsQuery query) {
        CompletableFuture<CreatureFactsSnapshotResult> completion = new CompletableFuture<>();
        if (query == null) {
            completion.complete(CreatureFactsSnapshotResult.invalidRequest());
            return completion;
        }
        try {
            factsLane.execute(() -> completion.complete(loadFactsInLane(query)));
        } catch (RuntimeException exception) {
            diagnostics.failure(ENCOUNTER_CANDIDATES_FAILURE, exception.getClass());
            completion.complete(CreatureFactsSnapshotResult.storageFailure());
        }
        return completion;
    }

    private CreatureFactsSnapshotResult loadFactsInLane(CreatureFactsQuery query) {
        long startedNanos = System.nanoTime();
        try {
            var mode = query.mode() == CreatureFactsQuery.Mode.XP_VALUES
                    ? CreatureCatalogData.CreatureFactsSpec.FactsMode.XP_VALUES
                    : CreatureCatalogData.CreatureFactsSpec.FactsMode.CREATURE_IDS;
            CreatureFactsSnapshotResult result = CreatureFactsSnapshotResult.success(lookup.loadCreatureFacts(
                    new CreatureCatalogData.CreatureFactsSpec(mode, query.values())).stream()
                    .map(CreatureCatalogProjection::encounterCandidate)
                    .toList());
            diagnostics.measurement(new Measurement(
                    FACTS_READ,
                    0L,
                    Math.max(0L, System.nanoTime() - startedNanos),
                    query.values().size(),
                    0));
            return result;
        } catch (IllegalArgumentException exception) {
            return CreatureFactsSnapshotResult.invalidRequest();
        } catch (IllegalStateException exception) {
            diagnostics.failure(ENCOUNTER_CANDIDATES_FAILURE, exception.getClass());
            return CreatureFactsSnapshotResult.storageFailure();
        }
    }

    private void refreshEncounterCandidatesInLane(EncounterCandidateRequest request) {
        try {
            if (!request.hasValidXpRange()) {
                publishEncounterCandidates(CreatureQueryStatus.INVALID_QUERY, List.of());
                return;
            }
            publishEncounterCandidates(CreatureQueryStatus.SUCCESS, lookup.loadEncounterCandidates(request.spec()));
        } catch (IllegalStateException exception) {
            diagnostics.failure(ENCOUNTER_CANDIDATES_FAILURE, exception.getClass());
            publishEncounterCandidates(CreatureQueryStatus.STORAGE_ERROR, List.of());
        }
    }

    private void publishDetail(
            CreatureLookupStatus status,
            @Nullable CreatureProfile detail
    ) {
        publishedState.publishDetail(new CreatureDetailResult(
                status,
                CreatureCatalogProjection.creatureDetail(detail)));
    }

    private void publishEncounterCandidates(
            CreatureQueryStatus status,
            List<CreatureCatalogData.EncounterCandidateProfile> candidates
    ) {
        List<CreatureCatalogData.EncounterCandidateProfile> safeCandidates = candidates == null
                ? List.of()
                : List.copyOf(candidates);
        publishedState.publishEncounterCandidates(new CreatureEncounterCandidatesResult(
                status,
                safeCandidates.stream()
                        .map(CreatureCatalogProjection::encounterCandidate)
                        .toList()));
    }

    private record CatalogRequest(
            @Nullable String nameQuery,
            @Nullable String minimumChallengeRating,
            @Nullable String maximumChallengeRating,
            @Nullable Integer minimumXp,
            @Nullable Integer maximumXp,
            List<String> sizes,
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            List<String> alignments,
            CatalogSortField sortField,
            boolean sortAscending,
            int pageSize,
            int pageOffset
    ) {

        static CatalogRequest from(@Nullable CreatureCatalogQuery command) {
            if (command == null) {
                return empty();
            }
            String minimumChallengeRating = CatalogRequest.trimmedOrNull(command.challengeRatingMin());
            String maximumChallengeRating = CatalogRequest.trimmedOrNull(command.challengeRatingMax());
            return new CatalogRequest(
                    CatalogRequest.trimmedOrNull(command.nameQuery()),
                    minimumChallengeRating,
                    maximumChallengeRating,
                    xpForChallengeRating(minimumChallengeRating),
                    xpForChallengeRating(maximumChallengeRating),
                    normalizeValues(command.sizes()),
                    normalizeValues(command.creatureTypes()),
                    normalizeValues(command.creatureSubtypes()),
                    normalizeValues(command.biomes()),
                    normalizeValues(command.alignments()),
                    CatalogSortField.fromName(command.sortFieldName()),
                    !DESCENDING_SORT_DIRECTION.equals(command.sortDirectionName()),
                    normalizePageSize(command.pageSize()),
                    Math.max(0, command.pageOffset()));
        }

        private static CatalogRequest empty() {
            return new CatalogRequest(
                    null,
                    null,
                    null,
                    null,
                    null,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    CatalogSortField.NAME,
                    true,
                    DEFAULT_PAGE_SIZE,
                    DEFAULT_PAGE_OFFSET);
        }

        private static CatalogRequest referenceIndex(int pageOffset) {
            return new CatalogRequest(
                    null,
                    null,
                    null,
                    null,
                    null,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    CatalogSortField.NAME,
                    true,
                    MAX_PAGE_SIZE,
                    Math.max(0, pageOffset));
        }

        CreatureCatalogData.CatalogSearchSpec spec() {
            return new CreatureCatalogData.CatalogSearchSpec(
                    nameQuery,
                    minimumXp,
                    maximumXp,
                    sizes,
                    creatureTypes,
                    creatureSubtypes,
                    biomes,
                    alignments,
                    sortField.name(),
                    sortAscending,
                    pageSize,
                    pageOffset);
        }

        CreatureCatalogData.CatalogPageData emptyPage() {
            return CreatureCatalogData.emptyCatalogPage(pageSize, pageOffset);
        }

        boolean hasValidChallengeRatingRange() {
            if (minimumChallengeRating != null && minimumXp == null) {
                return false;
            }
            if (maximumChallengeRating != null && maximumXp == null) {
                return false;
            }
            return minimumXp == null || maximumXp == null || minimumXp <= maximumXp;
        }

        private static @Nullable Integer xpForChallengeRating(@Nullable String challengeRating) {
            if (challengeRating == null || challengeRating.isBlank()) {
                return null;
            }
            return CR_TO_XP.get(challengeRating);
        }

        private static int normalizePageSize(int pageSize) {
            if (pageSize <= 0) {
                return DEFAULT_PAGE_SIZE;
            }
            return Math.min(pageSize, MAX_PAGE_SIZE);
        }

        private static List<String> normalizeValues(@Nullable List<String> values) {
            if (values == null || values.isEmpty()) {
                return List.of();
            }
            List<String> normalizedValues = new ArrayList<>();
            for (String value : values) {
                String normalizedValue = trimmedOrNull(value);
                if (normalizedValue != null && !normalizedValues.contains(normalizedValue)) {
                    normalizedValues.add(normalizedValue);
                }
            }
            return List.copyOf(normalizedValues);
        }

        private static @Nullable String trimmedOrNull(@Nullable String value) {
            if (value == null) {
                return null;
            }
            String trimmed = value.trim();
            return trimmed.isEmpty() ? null : trimmed;
        }
    }

    private record EncounterCandidateRequest(
            @Nullable String nameQuery,
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            List<String> sizes,
            List<String> alignments,
            int minimumXp,
            int maximumXp,
            int limit
    ) {

        static EncounterCandidateRequest from(@Nullable RefreshCreatureEncounterCandidatesCommand command) {
            if (command == null) {
                return new EncounterCandidateRequest(
                        null,
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        0,
                        Integer.MAX_VALUE,
                        DEFAULT_ENCOUNTER_CANDIDATE_LIMIT);
            }
            String minimumChallengeRating = CatalogRequest.trimmedOrNull(command.challengeRatingMin());
            String maximumChallengeRating = CatalogRequest.trimmedOrNull(command.challengeRatingMax());
            Integer challengeMinimumXp = CatalogRequest.xpForChallengeRating(minimumChallengeRating);
            Integer challengeMaximumXp = CatalogRequest.xpForChallengeRating(maximumChallengeRating);
            return new EncounterCandidateRequest(
                    CatalogRequest.trimmedOrNull(command.nameQuery()),
                    CatalogRequest.normalizeValues(command.creatureTypes()),
                    CatalogRequest.normalizeValues(command.creatureSubtypes()),
                    CatalogRequest.normalizeValues(command.biomes()),
                    CatalogRequest.normalizeValues(command.sizes()),
                    CatalogRequest.normalizeValues(command.alignments()),
                    challengeMinimumXp == null
                            ? Math.max(0, command.minimumXp())
                            : Math.max(Math.max(0, command.minimumXp()), challengeMinimumXp.intValue()),
                    challengeMaximumXp == null
                            ? (command.maximumXp() <= 0 ? Integer.MAX_VALUE : command.maximumXp())
                            : Math.min(command.maximumXp() <= 0 ? Integer.MAX_VALUE : command.maximumXp(),
                                    challengeMaximumXp.intValue()),
                    normalizeLimit(command.limit()));
        }

        CreatureCatalogData.EncounterCandidateSpec spec() {
            return new CreatureCatalogData.EncounterCandidateSpec(
                    nameQuery,
                    creatureTypes,
                    creatureSubtypes,
                    biomes,
                    sizes,
                    alignments,
                    minimumXp,
                    maximumXp,
                    limit);
        }

        boolean hasValidXpRange() {
            return minimumXp <= maximumXp;
        }

        private static int normalizeLimit(int limit) {
            if (limit <= 0) {
                return DEFAULT_ENCOUNTER_CANDIDATE_LIMIT;
            }
            return Math.min(limit, MAX_ENCOUNTER_CANDIDATE_LIMIT);
        }
    }

}
