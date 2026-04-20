package src.domain.creatures.published;

public record CreatureCatalogPageResult(
        CreatureQueryStatus status,
        CreatureCatalogPage page
) {
}
