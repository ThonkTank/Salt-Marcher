package features.creatures.adapter.sqlite.mapper;

import org.jspecify.annotations.Nullable;
import features.creatures.adapter.sqlite.model.CreatureCatalogRecord;
import features.creatures.domain.catalog.CreatureCatalogData;

public final class CreatureCatalogRowMapper {

    private CreatureCatalogRowMapper() {
    }

    public static CreatureCatalogData.CatalogRowData toDomain(CreatureCatalogRecord record) {
        CreatureCatalogRecord.Identity identity = record.identity();
        CreatureCatalogRecord.CombatStats combatStats = record.combatStats();
        return new CreatureCatalogData.CatalogRowData(
                identity.id(),
                safeText(identity.name()),
                safeText(identity.size()),
                safeText(identity.creatureType()),
                safeText(identity.alignment()),
                safeText(combatStats.challengeRating()),
                combatStats.xp(),
                combatStats.hitPoints(),
                combatStats.armorClass());
    }

    private static String safeText(@Nullable String value) {
        return value == null ? "" : value;
    }
}
