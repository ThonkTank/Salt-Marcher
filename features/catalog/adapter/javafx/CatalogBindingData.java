package features.catalog.adapter.javafx;

import features.creatures.api.CreatureCatalogQueryApi;
import features.creatures.api.CreatureReferenceIndexModel;
import features.creatures.api.CreaturesApi;
import features.encounter.api.EncounterApi;
import features.encounter.api.EncounterBuilderInputsModel;
import features.encounter.api.EncounterTuningPreviewModel;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCatalogModel;
import features.items.api.ItemsCatalogApi;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import org.jspecify.annotations.Nullable;

public record CatalogBindingData(
        CreaturesApi creatures,
        CreatureCatalogQueryApi creatureQueries,
        CreatureReferenceIndexModel creatureReferences,
        EncounterTableApi encounterTables,
        EncounterApi encounters,
        EncounterBuilderInputsModel builderInputs,
        EncounterTableCatalogModel encounterTableCatalog,
        EncounterTuningPreviewModel tuningPreview,
        SavedEncounterPlanListModel savedPlans,
        ItemsCatalogApi items,
        @Nullable WorldPlannerSnapshotModel worldPlanner
) {
}
