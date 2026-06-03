package src.data.creatures.mapper;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureDetailRecord;
import src.domain.creatures.model.catalog.CreatureCatalogData.CreatureProfile;

public final class CreatureDetailMapper {

    private CreatureDetailMapper() {
    }

    public static @Nullable CreatureProfile toDomain(@Nullable CreatureDetailRecord record) {
        if (record == null) {
            return null;
        }
        return new CreatureDetailDomainAssembler(record).toDomain();
    }
}
