package src.domain.creatures.runtime.port;

import java.util.List;
import java.util.Optional;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

public interface CreaturesPublishedStateRepository {

    void publishFilterOptions(FilterOptionsPublication publication);

    void publishCatalogPage(CatalogPagePublication publication);

    void publishCreatureDetail(CreatureDetailPublication publication);

    enum FilterOptionsStatus {
        SUCCESS,
        STORAGE_ERROR
    }

    record FilterOptionsPublication(
            FilterOptionsStatus status,
            CreatureCatalogLookup.DistinctFilterValues values,
            List<String> challengeRatings
    ) {

        public FilterOptionsPublication {
            status = status == null ? FilterOptionsStatus.STORAGE_ERROR : status;
            values = values == null
                    ? new CreatureCatalogLookup.DistinctFilterValues(List.of(), List.of(), List.of(), List.of(), List.of())
                    : values;
            challengeRatings = challengeRatings == null ? List.of() : List.copyOf(challengeRatings);
        }
    }

    enum CatalogPageStatus {
        SUCCESS,
        INVALID_QUERY,
        STORAGE_ERROR
    }

    record CatalogPagePublication(
            CatalogPageStatus status,
            CreatureCatalogLookup.CatalogPage page
    ) {

        public CatalogPagePublication {
            status = status == null ? CatalogPageStatus.STORAGE_ERROR : status;
            page = page == null ? new CreatureCatalogLookup.CatalogPage(List.of(), 0, 50, 0) : page;
        }
    }

    enum CreatureDetailStatus {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    record CreatureDetailPublication(
            CreatureDetailStatus status,
            Optional<CreatureCatalogLookup.CreatureProfile> detail
    ) {

        public CreatureDetailPublication {
            status = status == null ? CreatureDetailStatus.STORAGE_ERROR : status;
            detail = detail == null ? Optional.empty() : detail;
        }
    }
}
