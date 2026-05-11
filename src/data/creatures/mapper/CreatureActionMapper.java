package src.data.creatures.mapper;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureActionRecord;
import src.domain.creatures.model.catalog.repository.CreatureCatalogRepository;

public final class CreatureActionMapper {

    private CreatureActionMapper() {
    }

    public static CreatureCatalogRepository.CreatureActionData toDomain(CreatureActionRecord record) {
        return new CreatureCatalogRepository.CreatureActionData(
                safeText(record.actionType()),
                safeText(record.name()),
                safeText(record.description()),
                record.toHitBonus());
    }

    private static String safeText(@Nullable String value) {
        return value == null ? "" : value;
    }
}
