package features.creatures.adapter.sqlite.mapper;

import org.jspecify.annotations.Nullable;
import features.creatures.adapter.sqlite.model.CreatureDetailRecord;
import features.creatures.domain.catalog.CreatureCatalogData.CreatureProfile;

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
