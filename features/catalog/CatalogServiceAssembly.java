package features.catalog;

import shell.api.ShellContribution;
import features.catalog.adapter.javafx.CatalogContribution;
import features.catalog.adapter.javafx.CatalogBindingActions;
import features.catalog.adapter.javafx.CatalogBindingData;
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
import java.util.Objects;
import java.util.function.LongConsumer;
import org.jspecify.annotations.Nullable;
import shell.api.InspectorSink;

/** Presentation-only composition for the cross-feature reference workspace. */
public final class CatalogServiceAssembly {

    private CatalogServiceAssembly() {
    }

    public static ShellContribution contribution(
            CatalogDataSources dataSources,
            CatalogActionRoutes actions
    ) {
        return new CatalogContribution(
                new CatalogBindingData(
                        dataSources.creatures(), dataSources.creatureQueries(), dataSources.creatureReferences(),
                        dataSources.encounterTables(),
                        dataSources.encounters(), dataSources.builderInputs(), dataSources.encounterTableCatalog(),
                        dataSources.tuningPreview(), dataSources.savedPlans(), dataSources.items(),
                        dataSources.worldPlanner()),
                new CatalogBindingActions(
                        actions.inspector(), actions.openCreatureInspector(), actions.openNpcInspector(),
                        actions.openFactionInspector(), actions.openLocationInspector(), actions.createNpc(),
                        actions.createFaction(), actions.createLocation(), actions.addNpcToScene(),
                        actions.setSceneLocation(), actions.addCreatureToScene()));
    }

    public record CatalogDataSources(
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
        public CatalogDataSources(
                CreaturesApi creatures,
                CreatureCatalogQueryApi creatureQueries,
                EncounterTableApi encounterTables,
                EncounterApi encounters,
                EncounterBuilderInputsModel builderInputs,
                EncounterTableCatalogModel encounterTableCatalog,
                EncounterTuningPreviewModel tuningPreview,
                SavedEncounterPlanListModel savedPlans,
                ItemsCatalogApi items,
                @Nullable WorldPlannerSnapshotModel worldPlanner
        ) {
            this(creatures, creatureQueries, new CreatureReferenceIndexModel(null, null), encounterTables,
                    encounters, builderInputs, encounterTableCatalog, tuningPreview, savedPlans, items, worldPlanner);
        }

        public CatalogDataSources {
            Objects.requireNonNull(creatures, "creatures");
            Objects.requireNonNull(creatureQueries, "creatureQueries");
            Objects.requireNonNull(creatureReferences, "creatureReferences");
            Objects.requireNonNull(encounterTables, "encounterTables");
            Objects.requireNonNull(encounters, "encounters");
            Objects.requireNonNull(builderInputs, "builderInputs");
            Objects.requireNonNull(encounterTableCatalog, "encounterTableCatalog");
            Objects.requireNonNull(tuningPreview, "tuningPreview");
            Objects.requireNonNull(savedPlans, "savedPlans");
            Objects.requireNonNull(items, "items");
        }
    }

    public record CatalogActionRoutes(
            InspectorSink inspector,
            LongConsumer openCreatureInspector,
            LongConsumer openNpcInspector,
            LongConsumer openFactionInspector,
            LongConsumer openLocationInspector,
            Runnable createNpc,
            Runnable createFaction,
            Runnable createLocation,
            java.util.function.LongConsumer addNpcToScene,
            java.util.function.LongConsumer setSceneLocation,
            java.util.function.LongConsumer addCreatureToScene
    ) {
        public CatalogActionRoutes(
                InspectorSink inspector,
                LongConsumer openCreatureInspector,
                LongConsumer openNpcInspector,
                LongConsumer openFactionInspector,
                LongConsumer openLocationInspector,
                Runnable createNpc,
                Runnable createFaction,
                Runnable createLocation
        ) {
            this(inspector, openCreatureInspector, openNpcInspector, openFactionInspector, openLocationInspector,
                    createNpc, createFaction, createLocation, ignored -> { }, ignored -> { }, ignored -> { });
        }

        public CatalogActionRoutes {
            Objects.requireNonNull(inspector, "inspector");
            Objects.requireNonNull(openCreatureInspector, "openCreatureInspector");
            Objects.requireNonNull(openNpcInspector, "openNpcInspector");
            Objects.requireNonNull(openFactionInspector, "openFactionInspector");
            Objects.requireNonNull(openLocationInspector, "openLocationInspector");
            Objects.requireNonNull(createNpc, "createNpc");
            Objects.requireNonNull(createFaction, "createFaction");
            Objects.requireNonNull(createLocation, "createLocation");
            Objects.requireNonNull(addNpcToScene, "addNpcToScene");
            Objects.requireNonNull(setSceneLocation, "setSceneLocation");
            Objects.requireNonNull(addCreatureToScene, "addCreatureToScene");
        }
    }
}
