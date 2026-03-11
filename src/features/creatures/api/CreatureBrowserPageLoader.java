package features.creatures.api;

@FunctionalInterface
public interface CreatureBrowserPageLoader {
    CreatureCatalogService.ServiceResult<CreatureCatalogService.PageResult> load(
            CreatureCatalogService.FilterCriteria criteria,
            CreatureCatalogService.PageRequest pageRequest);
}
