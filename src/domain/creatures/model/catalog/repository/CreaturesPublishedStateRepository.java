package src.domain.creatures.model.catalog.repository;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.model.catalog.port.CreatureCatalogLookup;

public interface CreaturesPublishedStateRepository {

    String SUCCESS = "SUCCESS";
    String INVALID_QUERY = "INVALID_QUERY";
    String NOT_FOUND = "NOT_FOUND";
    String STORAGE_ERROR = "STORAGE_ERROR";

    void publishFilterOptions(FilterOptionsPublication result);

    void publishCatalogPage(CatalogPagePublication result);

    void publishCreatureDetail(CreatureDetailPublication result);

    final class FilterOptionsPublication {
        private final String status;
        private final CreatureCatalogLookup.DistinctFilterValues values;
        private final List<String> challengeRatings;

        public FilterOptionsPublication(
                String status,
                CreatureCatalogLookup.DistinctFilterValues values,
                List<String> challengeRatings
        ) {
            this.status = status == null ? STORAGE_ERROR : status;
            this.values = values == null
                    ? new CreatureCatalogLookup.DistinctFilterValues(List.of(), List.of(), List.of(), List.of(), List.of())
                    : values;
            this.challengeRatings = challengeRatings == null ? List.of() : List.copyOf(challengeRatings);
        }

        public String status() {
            return status;
        }

        public CreatureCatalogLookup.DistinctFilterValues values() {
            return values;
        }

        public List<String> challengeRatings() {
            return List.copyOf(challengeRatings);
        }
    }

    final class CatalogPagePublication {
        private final String status;
        private final CreatureCatalogLookup.CatalogPageData page;

        public CatalogPagePublication(String status, CreatureCatalogLookup.CatalogPageData page) {
            this.status = status == null ? STORAGE_ERROR : status;
            this.page = page == null ? new CreatureCatalogLookup.CatalogPageData(List.of(), 0, 50, 0) : page;
        }

        public String status() {
            return status;
        }

        public CreatureCatalogLookup.CatalogPageData page() {
            return page;
        }
    }

    final class CreatureDetailPublication {
        private final String status;
        private final @Nullable CreatureCatalogLookup.CreatureProfile detail;

        public CreatureDetailPublication(String status, @Nullable CreatureCatalogLookup.CreatureProfile detail) {
            this.status = status == null ? STORAGE_ERROR : status;
            this.detail = detail;
        }

        public String status() {
            return status;
        }

        public @Nullable CreatureCatalogLookup.CreatureProfile detail() {
            return detail;
        }
    }
}
