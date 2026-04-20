package src.domain.dungeon.published;

/**
 * Query for authored map metadata search.
 */
public record SearchMapsQuery(
        String query
) {

    public SearchMapsQuery {
        query = query == null ? "" : query.trim();
    }
}
