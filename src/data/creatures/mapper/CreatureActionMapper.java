package src.data.creatures.mapper;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureActionRecord;
import src.domain.creatures.model.catalog.port.CreatureCatalogLookup;

public final class CreatureActionMapper {

    private CreatureActionMapper() {
    }

    public static CreatureCatalogLookup.CreatureActionData toDomain(CreatureActionRecord record) {
        return new CreatureCatalogLookup.CreatureActionData(
                safeText(record.actionType()),
                safeText(record.name()),
                safeText(record.description()),
                record.toHitBonus());
    }

    private static String safeText(@Nullable String value) {
        return value == null ? "" : value;
    }
}
