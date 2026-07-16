package features.encountertable.adapter.sqlite.mapper;

import org.jspecify.annotations.Nullable;
import features.encountertable.adapter.sqlite.model.EncounterTableCandidateRecord;
import features.encountertable.adapter.sqlite.model.EncounterTableSummaryRecord;
import features.encountertable.domain.catalog.EncounterTableCandidateData;
import features.encountertable.domain.catalog.EncounterTableSummaryData;

public final class EncounterTableMapper {

    private EncounterTableMapper() {
    }

    public static EncounterTableSummaryData toDomain(EncounterTableSummaryRecord record) {
        return new EncounterTableSummaryData(record.tableId(), safeText(record.name()), record.linkedLootTableId());
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
