package src.data.encountertable.mapper;

import org.jspecify.annotations.Nullable;
import src.data.encountertable.model.EncounterTableCandidateRecord;
import src.data.encountertable.model.EncounterTableSummaryRecord;
import src.domain.encountertable.catalog.value.EncounterTableCandidateData;
import src.domain.encountertable.published.EncounterTableSummary;

public final class EncounterTableMapper {

    private EncounterTableMapper() {
    }

    public static EncounterTableSummary toDomain(EncounterTableSummaryRecord record) {
        return new EncounterTableSummary(record.tableId(), safeText(record.name()), record.linkedLootTableId());
    }

    public static EncounterTableCandidateData toDomain(EncounterTableCandidateRecord record) {
        return new EncounterTableCandidateData(
                record.creatureId(),
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
                record.legendaryActionCount(),
                record.weight());
    }

    private static String safeText(@Nullable String value) {
        return value == null ? "" : value;
    }
}
