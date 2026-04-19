package src.data.creatures.mapper;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureCatalogRecord;
import src.domain.creatures.api.CreatureCatalogRow;

public final class CreatureCatalogRowMapper {

    private CreatureCatalogRowMapper() {
    }

    public static CreatureCatalogRow toDomain(CreatureCatalogRecord record) {
        return new CreatureCatalogRow(
                record.id(),
                safeText(record.name()),
                safeText(record.size()),
                safeText(record.creatureType()),
                safeText(record.alignment()),
                safeText(record.challengeRating()),
                record.xp(),
                record.hitPoints(),
                record.armorClass());
    }

    private static String safeText(@Nullable String value) {
        return value == null ? "" : value;
    }
}
