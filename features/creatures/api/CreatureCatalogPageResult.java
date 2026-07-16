package features.creatures.api;

public record CreatureCatalogPageResult(
        CreatureQueryStatus status,
        CreatureCatalogPage page
) {
}
