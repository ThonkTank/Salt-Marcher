package src.domain.creatures.model.catalog.repository;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.model.catalog.model.CreatureCatalogData;
import src.domain.creatures.model.catalog.model.CreatureCatalogData.CreatureProfile;

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
        private final CreatureCatalogData.DistinctFilterValues values;
        private final List<String> challengeRatings;

        public FilterOptionsPublication(
                String status,
                CreatureCatalogData.DistinctFilterValues values,
                List<String> challengeRatings
        ) {
            this.status = status == null ? STORAGE_ERROR : status;
            this.values = values == null
                    ? CreatureCatalogData.emptyFilterValues()
                    : values;
            this.challengeRatings = challengeRatings == null ? List.of() : List.copyOf(challengeRatings);
        }

        public String status() {
            return status;
        }

        public CreatureCatalogData.DistinctFilterValues values() {
            return values;
        }

        public List<String> challengeRatings() {
            return List.copyOf(challengeRatings);
        }
    }

    final class CatalogPagePublication {
        private final String status;
        private final CreatureCatalogData.CatalogPageData page;

        public CatalogPagePublication(String status, CreatureCatalogData.CatalogPageData page) {
            this.status = status == null ? STORAGE_ERROR : status;
            this.page = page == null ? CreatureCatalogData.emptyCatalogPage(50, 0) : page;
        }

        public String status() {
            return status;
        }

        public CreatureCatalogData.CatalogPageData page() {
            return page;
        }
    }

    final class CreatureDetailPublication {
        private final String status;
        private final @Nullable CreatureProfile detail;

        public CreatureDetailPublication(String status, @Nullable CreatureProfile detail) {
            this.status = status == null ? STORAGE_ERROR : status;
            this.detail = detail;
        }

        public String status() {
            return status;
        }

        public @Nullable CreatureProfile detail() {
            return detail;
        }
    }
}
