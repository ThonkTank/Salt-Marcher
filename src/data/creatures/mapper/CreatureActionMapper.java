package src.data.creatures.mapper;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureActionRecord;
import src.domain.creatures.api.CreatureActionDetail;

public final class CreatureActionMapper {

    private CreatureActionMapper() {
    }

    public static CreatureActionDetail toDomain(CreatureActionRecord record) {
        return new CreatureActionDetail(
                safeText(record.actionType()),
                safeText(record.name()),
                safeText(record.description()),
                record.toHitBonus());
    }

    private static String safeText(@Nullable String value) {
        return value == null ? "" : value;
    }
}
