package src.data.creatures.mapper;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureCatalogRecord;
import src.domain.creatures.model.catalog.port.CreatureCatalogLookup;

public final class CreatureCatalogRowMapper {

    private CreatureCatalogRowMapper() {
    }

    public static CreatureCatalogLookup.CatalogRowData toDomain(CreatureCatalogRecord record) {
        CreatureCatalogRecord.Identity identity = record.identity();
        CreatureCatalogRecord.CombatStats combatStats = record.combatStats();
        return new CreatureCatalogLookup.CatalogRowData(
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
