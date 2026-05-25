package src.domain.creatures.model.catalog.usecase;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.model.catalog.model.CreatureCatalogData;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.model.catalog.repository.CreaturesPublishedStateRepository;

public final class LoadCreatureFilterOptionsUseCase {

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
    private final CreaturesPublishedStateRepository publishedStateRepository;

    public LoadCreatureFilterOptionsUseCase(
            CreatureCatalogPort lookup,
            CreaturesPublishedStateRepository publishedStateRepository
    ) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute() {
        try {
            publishedStateRepository.publishFilterOptions(
                    new CreaturesPublishedStateRepository.FilterOptionsPublication(
                            CreaturesPublishedStateRepository.SUCCESS,
                            lookup.loadFilterValues(),
                            CHALLENGE_RATINGS));
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishFilterOptions(
                    new CreaturesPublishedStateRepository.FilterOptionsPublication(
                            CreaturesPublishedStateRepository.STORAGE_ERROR,
                            CreatureCatalogData.emptyFilterValues(),
                            List.of()));
        }
    }

    static @Nullable Integer xpForChallengeRating(@Nullable String challengeRating) {
        if (challengeRating == null || challengeRating.isBlank()) {
            return null;
        }
        return CR_TO_XP.get(challengeRating);
    }
}
