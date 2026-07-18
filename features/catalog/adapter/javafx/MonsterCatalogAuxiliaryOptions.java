package features.catalog.adapter.javafx;

import features.encountertable.api.EncounterTableSummary;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import java.util.List;

record MonsterCatalogAuxiliaryOptions(
        List<EncounterTableSummary> encounterTables,
        List<WorldFactionSummary> factions,
        List<WorldLocationSummary> locations
) {
    MonsterCatalogAuxiliaryOptions {
        encounterTables = encounterTables == null ? List.of() : List.copyOf(encounterTables);
        factions = factions == null ? List.of() : List.copyOf(factions);
        locations = locations == null ? List.of() : List.copyOf(locations);
    }

    static MonsterCatalogAuxiliaryOptions empty() {
        return new MonsterCatalogAuxiliaryOptions(List.of(), List.of(), List.of());
    }
}
