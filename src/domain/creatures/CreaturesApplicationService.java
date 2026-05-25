package src.domain.creatures;

import java.util.List;
import java.util.Objects;
import src.domain.creatures.model.catalog.usecase.LoadCreatureDetailUseCase;
import src.domain.creatures.model.catalog.usecase.LoadCreatureEncounterCandidatesUseCase;
import src.domain.creatures.model.catalog.usecase.LoadCreatureFilterOptionsUseCase;
import src.domain.creatures.model.catalog.usecase.SearchCreatureCatalogUseCase;
import src.domain.creatures.model.catalog.usecase.SearchCreatureCatalogUseCase.SearchRequest;
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
    private static final int DEFAULT_PAGE_OFFSET = 0;
    private static final int DEFAULT_ENCOUNTER_CANDIDATE_LIMIT = 250;
    private static final String DEFAULT_SORT_FIELD = "NAME";
    private static final String DEFAULT_SORT_DIRECTION = "ASCENDING";
    private static final String CHALLENGE_RATING_SORT_FIELD = "CHALLENGE_RATING";
    private static final String XP_SORT_FIELD = "XP";
    private static final String DESCENDING_SORT_DIRECTION = "DESCENDING";
    private static final String COMMAND_PARAMETER = "command";

    private final LoadCreatureFilterOptionsUseCase loadCreatureFilterOptionsUseCase;
    private final SearchCreatureCatalogUseCase searchCreatureCatalogUseCase;
    private final LoadCreatureDetailUseCase loadCreatureDetailUseCase;
    private final LoadCreatureEncounterCandidatesUseCase loadEncounterCandidatesUseCase;

    public CreaturesApplicationService(
            LoadCreatureFilterOptionsUseCase loadCreatureFilterOptionsUseCase,
            SearchCreatureCatalogUseCase searchCreatureCatalogUseCase,
            LoadCreatureDetailUseCase loadCreatureDetailUseCase,
            LoadCreatureEncounterCandidatesUseCase loadEncounterCandidatesUseCase
    ) {
        this.loadCreatureFilterOptionsUseCase =
                Objects.requireNonNull(loadCreatureFilterOptionsUseCase, "loadCreatureFilterOptionsUseCase");
        this.searchCreatureCatalogUseCase =
                Objects.requireNonNull(searchCreatureCatalogUseCase, "searchCreatureCatalogUseCase");
        this.loadCreatureDetailUseCase = Objects.requireNonNull(loadCreatureDetailUseCase, "loadCreatureDetailUseCase");
        this.loadEncounterCandidatesUseCase =
                Objects.requireNonNull(loadEncounterCandidatesUseCase, "loadEncounterCandidatesUseCase");
    }

    public void refreshFilterOptions(RefreshCreatureFilterOptionsCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        loadCreatureFilterOptionsUseCase.execute();
    }

    public void refreshCatalog(RefreshCreatureCatalogCommand command) {
        searchCreatureCatalogUseCase.execute(command == null
                ? new SearchRequest(
                        null,
                        null,
                        null,
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        null,
                        null,
                        DEFAULT_PAGE_SIZE,
                        DEFAULT_PAGE_OFFSET)
                : new SearchRequest(
                        command.nameQuery(),
                        command.challengeRatingMin(),
                        command.challengeRatingMax(),
                        command.sizes(),
                        command.creatureTypes(),
                        command.creatureSubtypes(),
                        command.biomes(),
                        command.alignments(),
                        sortFieldName(command.sortFieldName()),
                        sortDirectionName(command.sortDirectionName()),
                        command.pageSize(),
                        command.pageOffset()));
    }

    public void selectCreatureDetail(SelectCreatureDetailCommand command) {
        loadCreatureDetailUseCase.execute(command == null ? NO_CREATURE_ID : command.creatureId());
    }

    public void refreshEncounterCandidates(RefreshCreatureEncounterCandidatesCommand command) {
        loadEncounterCandidatesUseCase.execute(
                command == null ? List.of() : command.creatureTypes(),
                command == null ? List.of() : command.creatureSubtypes(),
                command == null ? List.of() : command.biomes(),
                command == null ? 0 : command.minimumXp(),
                command == null ? 0 : command.maximumXp(),
                command == null ? DEFAULT_ENCOUNTER_CANDIDATE_LIMIT : command.limit());
    }

    private static String sortFieldName(String sortFieldName) {
        return switch (sortFieldName) {
            case CHALLENGE_RATING_SORT_FIELD -> CHALLENGE_RATING_SORT_FIELD;
            case XP_SORT_FIELD -> XP_SORT_FIELD;
            default -> DEFAULT_SORT_FIELD;
        };
    }

    private static String sortDirectionName(String sortDirectionName) {
        return DESCENDING_SORT_DIRECTION.equals(sortDirectionName) ? DESCENDING_SORT_DIRECTION : DEFAULT_SORT_DIRECTION;
    }

}
