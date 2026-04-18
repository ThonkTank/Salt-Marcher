package src.view.creatures.ViewModel;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureCatalogPage;
import src.domain.creatures.api.CreatureCatalogRow;
import src.domain.creatures.api.CreatureFilterOptions;

final class CreaturesCatalogViewMapper {

    private CreaturesCatalogViewMapper() {
    }

    static CreaturesCatalogViewData.Page toViewData(CreatureCatalogPage page) {
        int total = page.totalCount();
        int offset = page.pageOffset();
        int endExclusive = Math.min(total, offset + page.rows().size());
        String summary = total == 0
                ? "No creatures found."
                : "Showing " + (offset + 1) + "-" + endExclusive + " of " + total + " creatures";
        return new CreaturesCatalogViewData.Page(
                page.rows().stream().map(CreaturesCatalogViewMapper::toViewData).toList(),
                summary,
                offset > 0,
                offset + page.pageSize() < total
        );
    }

    static CreatureFilterOptionsViewData toViewData(@Nullable CreatureFilterOptions options) {
        if (options == null) {
            return CreatureFilterOptionsViewData.empty();
        }
        return new CreatureFilterOptionsViewData(
                options.sizes(),
                options.types(),
                options.subtypes(),
                options.biomes(),
                options.alignments(),
                options.challengeRatings()
        );
    }

    private static CreaturesCatalogViewData.Row toViewData(CreatureCatalogRow row) {
        return new CreaturesCatalogViewData.Row(
                row.id(),
                row.name(),
                row.challengeRating(),
                row.creatureType(),
                row.size(),
                row.alignment(),
                row.xp(),
                row.hitPoints(),
                row.armorClass()
        );
    }
}
