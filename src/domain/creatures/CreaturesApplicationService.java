package src.domain.creatures;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.model.catalog.CreatureCatalogData;
import src.domain.creatures.model.catalog.CreatureCatalogData.CatalogSortField;
import src.domain.creatures.model.catalog.CreatureCatalogData.CreatureProfile;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureEncounterCandidatesModel;
import src.domain.creatures.published.CreatureEncounterCandidatesResult;
import src.domain.creatures.published.CreatureFilterOptionsModel;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;
import src.domain.creatures.published.RefreshCreatureCatalogCommand;
import src.domain.creatures.published.RefreshCreatureEncounterCandidatesCommand;
import src.domain.creatures.published.RefreshCreatureFilterOptionsCommand;
import src.domain.creatures.published.SelectCreatureDetailCommand;

/**
 * Public backend facade for creature catalog publication.
 */
public final class CreaturesApplicationService {

    private static final long NO_CREATURE_ID = 0L;
    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_PAGE_OFFSET = 0;
    private static final int DEFAULT_ENCOUNTER_CANDIDATE_LIMIT = 250;
    private static final int MAX_ENCOUNTER_CANDIDATE_LIMIT = 1000;
    private static final String DESCENDING_SORT_DIRECTION = "DESCENDING";
    private static final String COMMAND_PARAMETER = "command";

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
    private final CreatureFilterOptionsModel filterOptionsModel;
    private final CreatureCatalogModel catalogModel;
    private final CreatureDetailModel detailModel;
    private final CreatureEncounterCandidatesModel encounterCandidatesModel;

    public CreaturesApplicationService(
            CreatureCatalogPort lookup,
            CreatureFilterOptionsModel filterOptionsModel,
            CreatureCatalogModel catalogModel,
            CreatureDetailModel detailModel,
            CreatureEncounterCandidatesModel encounterCandidatesModel
    ) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
        this.filterOptionsModel = Objects.requireNonNull(filterOptionsModel, "filterOptionsModel");
        this.catalogModel = Objects.requireNonNull(catalogModel, "catalogModel");
        this.detailModel = Objects.requireNonNull(detailModel, "detailModel");
        this.encounterCandidatesModel = Objects.requireNonNull(encounterCandidatesModel, "encounterCandidatesModel");
    }

    public void refreshFilterOptions(RefreshCreatureFilterOptionsCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        try {
            filterOptionsModel.publish(new CreatureFilterOptionsResult(
                    CreatureReadStatus.SUCCESS,
                    CreatureCatalogProjection.filterOptions(
                            lookup.loadFilterValues(),
                            CHALLENGE_RATINGS)));
        } catch (IllegalStateException exception) {
            filterOptionsModel.publish(new CreatureFilterOptionsResult(
                    CreatureReadStatus.STORAGE_ERROR,
                    CreatureCatalogProjection.filterOptions(
                            CreatureCatalogData.emptyFilterValues(),
                            List.of())));
        }
    }

    public void refreshCatalog(RefreshCreatureCatalogCommand command) {
        CatalogRequest request = CatalogRequest.from(command);
        try {
            if (!request.hasValidChallengeRatingRange()) {
                publishCatalog(CreatureQueryStatus.INVALID_QUERY, request.emptyPage());
                return;
            }
            publishCatalog(CreatureQueryStatus.SUCCESS, lookup.searchCatalog(request.spec()));
        } catch (IllegalStateException exception) {
            publishCatalog(CreatureQueryStatus.STORAGE_ERROR, request.emptyPage());
        }
    }

    public void selectCreatureDetail(SelectCreatureDetailCommand command) {
        try {
            long creatureId = command == null ? NO_CREATURE_ID : command.creatureId();
            if (creatureId <= 0) {
                publishDetail(CreatureLookupStatus.NOT_FOUND, null);
                return;
            }
            CreatureProfile detail = lookup.loadCreatureDetail(creatureId);
            publishDetail(detail == null ? CreatureLookupStatus.NOT_FOUND : CreatureLookupStatus.SUCCESS, detail);
        } catch (IllegalStateException exception) {
            publishDetail(CreatureLookupStatus.STORAGE_ERROR, null);
        }
    }

    public void refreshEncounterCandidates(RefreshCreatureEncounterCandidatesCommand command) {
        EncounterCandidateRequest request = EncounterCandidateRequest.from(command);
        try {
            if (!request.hasValidXpRange()) {
                publishEncounterCandidates(CreatureQueryStatus.INVALID_QUERY, List.of());
                return;
            }
            publishEncounterCandidates(CreatureQueryStatus.SUCCESS, lookup.loadEncounterCandidates(request.spec()));
        } catch (IllegalStateException exception) {
            publishEncounterCandidates(CreatureQueryStatus.STORAGE_ERROR, List.of());
        }
    }

    private void publishCatalog(CreatureQueryStatus status, CreatureCatalogData.CatalogPageData page) {
        catalogModel.publish(new CreatureCatalogPageResult(
                status,
                CreatureCatalogProjection.catalogPage(page)));
    }

    private void publishDetail(
            CreatureLookupStatus status,
            @Nullable CreatureProfile detail
    ) {
        detailModel.publish(new CreatureDetailResult(
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
        encounterCandidatesModel.publish(new CreatureEncounterCandidatesResult(
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

        static CatalogRequest from(@Nullable RefreshCreatureCatalogCommand command) {
            if (command == null) {
                return empty();
            }
            String minimumChallengeRating = trimmedOrNull(command.challengeRatingMin());
            String maximumChallengeRating = trimmedOrNull(command.challengeRatingMax());
            return new CatalogRequest(
                    trimmedOrNull(command.nameQuery()),
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
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            int minimumXp,
            int maximumXp,
            int limit
    ) {

        static EncounterCandidateRequest from(@Nullable RefreshCreatureEncounterCandidatesCommand command) {
            if (command == null) {
                return new EncounterCandidateRequest(
                        List.of(),
                        List.of(),
                        List.of(),
                        0,
                        Integer.MAX_VALUE,
                        DEFAULT_ENCOUNTER_CANDIDATE_LIMIT);
            }
            return new EncounterCandidateRequest(
                    CatalogRequest.normalizeValues(command.creatureTypes()),
                    CatalogRequest.normalizeValues(command.creatureSubtypes()),
                    CatalogRequest.normalizeValues(command.biomes()),
                    Math.max(0, command.minimumXp()),
                    command.maximumXp() <= 0 ? Integer.MAX_VALUE : command.maximumXp(),
                    normalizeLimit(command.limit()));
        }

        CreatureCatalogData.EncounterCandidateSpec spec() {
            return new CreatureCatalogData.EncounterCandidateSpec(
                    creatureTypes,
                    creatureSubtypes,
                    biomes,
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
