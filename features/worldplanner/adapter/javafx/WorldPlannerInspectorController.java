package features.worldplanner.adapter.javafx;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import shell.api.InspectorSink;
import features.creatures.api.CreatureCatalogModel;
import features.encountertable.api.EncounterTableCatalogModel;
import features.worldplanner.api.WorldPlannerApi;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.worldplanner.api.WorldPlannerEncounterSink;

public final class WorldPlannerInspectorController implements AutoCloseable {

    private final WorldPlannerApi worldPlanner;
    private final @Nullable WorldPlannerEncounterSink encounter;
    private final WorldPlannerSnapshotModel snapshotModel;
    private final @Nullable CreatureCatalogModel creatureCatalog;
    private final @Nullable EncounterTableCatalogModel encounterTableCatalog;
    private final InspectorSink inspector;
    private final WorldPlannerBinder binder;
    private final Runnable unsubscribe;

    public WorldPlannerInspectorController(
            WorldPlannerApi worldPlanner,
            @Nullable WorldPlannerEncounterSink encounter,
            WorldPlannerSnapshotModel snapshotModel,
            @Nullable CreatureCatalogModel creatureCatalog,
            @Nullable EncounterTableCatalogModel encounterTableCatalog,
            InspectorSink inspector
    ) {
        this.worldPlanner = Objects.requireNonNull(worldPlanner, "worldPlanner");
        this.encounter = encounter;
        this.snapshotModel = Objects.requireNonNull(snapshotModel, "snapshotModel");
        this.creatureCatalog = creatureCatalog;
        this.encounterTableCatalog = encounterTableCatalog;
        this.inspector = Objects.requireNonNull(inspector, "inspector");
        binder = new WorldPlannerBinder(
                this.worldPlanner,
                this.encounter,
                this.snapshotModel,
                this.creatureCatalog,
                this.encounterTableCatalog,
                this.inspector);
        unsubscribe = binder.subscribeToInspectorSnapshots();
    }

    public void openNpcInspector(long npcId) {
        binder().openNpc(npcId);
    }

    public void openFactionInspector(long factionId) {
        binder().openFaction(factionId);
    }

    public void openLocationInspector(long locationId) {
        binder().openLocation(locationId);
    }

    public void openNpcCreator() {
        binder().openNpcCreator();
    }

    public void openFactionCreator() {
        binder().openFactionCreator();
    }

    public void openLocationCreator() {
        binder().openLocationCreator();
    }

    public boolean matches(
            @Nullable WorldPlannerEncounterSink nextEncounter,
            WorldPlannerSnapshotModel nextSnapshotModel,
            @Nullable CreatureCatalogModel nextCreatureCatalog,
            @Nullable EncounterTableCatalogModel nextEncounterTableCatalog,
            InspectorSink nextInspector
    ) {
        return encounter == nextEncounter
                && snapshotModel == nextSnapshotModel
                && creatureCatalog == nextCreatureCatalog
                && encounterTableCatalog == nextEncounterTableCatalog
                && inspector == nextInspector;
    }

    @Override
    public void close() {
        unsubscribe.run();
    }

    private WorldPlannerBinder binder() {
        return binder;
    }
}
