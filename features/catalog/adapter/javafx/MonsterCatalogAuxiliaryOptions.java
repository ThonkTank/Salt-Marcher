package features.catalog.adapter.javafx;

import features.catalog.application.CatalogReferenceOption;
import java.util.List;

record MonsterCatalogAuxiliaryOptions(
        List<CatalogReferenceOption> encounterTables,
        List<CatalogReferenceOption> factions,
        List<CatalogReferenceOption> locations
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
