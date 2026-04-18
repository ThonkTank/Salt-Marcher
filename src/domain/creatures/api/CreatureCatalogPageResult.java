package src.domain.creatures.api;

public record CreatureCatalogPageResult(
        CreatureQueryStatus status,
        CreatureCatalogPage page
) {
}
