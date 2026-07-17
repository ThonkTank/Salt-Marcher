package features.catalog;

import org.jspecify.annotations.Nullable;
import shell.api.InspectorSink;
import shell.api.ShellContribution;
import features.catalog.adapter.javafx.CatalogContribution;
import features.creatures.api.CreaturesApi;
import features.creatures.api.CreatureCatalogModel;
import features.creatures.api.CreatureFilterOptionsModel;
import features.encounter.api.EncounterApi;
import features.encounter.api.EncounterBuilderInputsModel;
import features.encounter.api.EncounterTuningPreviewModel;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCatalogModel;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.items.api.ItemsCatalogApi;

/** Presentation-only composition for the cross-feature reference workspace. */
public final class CatalogServiceAssembly {

    private CatalogServiceAssembly() {
    }

    public static ShellContribution contribution(
            CreaturesApi creatures,
            EncounterTableApi encounterTables,
            EncounterApi encounters,
            EncounterBuilderInputsModel builderInputs,
            CreatureFilterOptionsModel filterOptions,
            CreatureCatalogModel creatureCatalog,
            EncounterTableCatalogModel encounterTableCatalog,
            EncounterTuningPreviewModel tuningPreview,
            SavedEncounterPlanListModel savedPlans,
            ItemsCatalogApi items,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            InspectorSink inspector,
            java.util.function.LongConsumer openCreatureInspector,
            java.util.function.LongConsumer openNpcInspector,
            java.util.function.LongConsumer openFactionInspector,
            java.util.function.LongConsumer openLocationInspector,
            Runnable createNpc,
            Runnable createFaction,
            Runnable createLocation,
            java.util.function.LongConsumer addNpcToScene,
            java.util.function.LongConsumer setSceneLocation,
            java.util.function.LongConsumer addCreatureToScene
    ) {
        return new CatalogContribution(
                creatures,
                encounterTables,
                encounters,
                builderInputs,
                filterOptions,
                creatureCatalog,
                encounterTableCatalog,
                tuningPreview,
                savedPlans,
                items,
                worldPlanner,
                inspector,
                openCreatureInspector,
                openNpcInspector,
                openFactionInspector,
                openLocationInspector,
                createNpc,
                createFaction,
                createLocation,
                addNpcToScene,
                setSceneLocation,
                addCreatureToScene);
    }
}
