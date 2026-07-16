package features.worldplanner;

import java.util.Objects;
import features.creatures.api.CreatureLookupStatus;
import features.creatures.api.CreatureReferenceApi;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.EncounterTableReferenceApi;
import features.worldplanner.application.ReferenceProviderUnavailableException;
import features.worldplanner.domain.world.WorldPlannerIds;
import features.worldplanner.domain.world.port.WorldPlannerReferencePort;

/** Feature-owned composition of World Planner reference validation. */
public final class WorldPlannerReferenceAssembly {

    private WorldPlannerReferenceAssembly() {
    }

    public static WorldPlannerReferencePort catalogReferences(
            CreatureReferenceApi creatures,
            EncounterTableReferenceApi encounterTables
    ) {
        return new CatalogReferenceValidator(
                Objects.requireNonNull(creatures, "creatures"),
                Objects.requireNonNull(encounterTables, "encounterTables"));
    }

    private record CatalogReferenceValidator(
            CreatureReferenceApi creatures,
            EncounterTableReferenceApi encounterTables
    ) implements WorldPlannerReferencePort {

        @Override
        public boolean creatureStatblockExists(long creatureStatblockId) {
            if (!WorldPlannerIds.isPositive(creatureStatblockId)) {
                return false;
            }
            var result = creatures.find(creatureStatblockId);
            if (result.status() == CreatureLookupStatus.STORAGE_ERROR) {
                throw unavailable();
            }
            return result.status() == CreatureLookupStatus.SUCCESS
                    && result.detail() != null
                    && result.detail().id() == creatureStatblockId;
        }

        @Override
        public boolean encounterTableExists(long encounterTableId) {
            if (!WorldPlannerIds.isPositive(encounterTableId)) {
                return false;
            }
            var result = encounterTables.catalog();
            if (result.status() == EncounterTableReadStatus.STORAGE_ERROR) {
                throw unavailable();
            }
            return result.tables().stream()
                    .anyMatch(table -> table.tableId() == encounterTableId);
        }

        private static ReferenceProviderUnavailableException unavailable() {
            return new ReferenceProviderUnavailableException();
        }
    }

}
