package src.data.creatures.mapper;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureCatalogPageRecord;
import src.data.creatures.model.CreatureCatalogRecord;
import src.data.creatures.model.EncounterCandidateRecord;
import src.domain.creatures.api.CreatureCatalogPage;
import src.domain.creatures.api.CreatureCatalogRow;
import src.domain.creatures.api.EncounterCandidate;

public final class CreatureCatalogMapper {

    private CreatureCatalogMapper() {
    }

    public static CreatureCatalogPage toDomain(CreatureCatalogPageRecord record) {
        return new CreatureCatalogPage(
                record.rows().stream().map(CreatureCatalogMapper::toDomain).toList(),
                record.totalCount(),
                record.pageSize(),
                record.pageOffset());
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

    public static EncounterCandidate toDomain(EncounterCandidateRecord record) {
        return new EncounterCandidate(
                record.id(),
                safeText(record.name()),
                safeText(record.creatureType()),
                safeText(record.challengeRating()),
                record.xp(),
                record.hitPoints(),
                record.hitDiceCount(),
                record.hitDiceSides(),
                record.hitDiceModifier(),
                record.armorClass(),
                record.initiativeBonus(),
                record.legendaryActionCount());
    }

    private static String safeText(@Nullable String value) {
        return value == null ? "" : value;
    }
}
