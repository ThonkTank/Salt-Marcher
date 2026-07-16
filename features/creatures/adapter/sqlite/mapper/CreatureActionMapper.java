package features.creatures.adapter.sqlite.mapper;

import org.jspecify.annotations.Nullable;
import features.creatures.adapter.sqlite.model.CreatureActionRecord;
import features.creatures.domain.catalog.CreatureCatalogData;

public final class CreatureActionMapper {

    private CreatureActionMapper() {
    }

    public static CreatureCatalogData.CreatureActionData toDomain(CreatureActionRecord record) {
        return new CreatureCatalogData.CreatureActionData(
                safeText(record.actionType()),
                safeText(record.name()),
                safeText(record.description()),
                record.toHitBonus());
    }

    private static String safeText(@Nullable String value) {
        return value == null ? "" : value;
    }
}
