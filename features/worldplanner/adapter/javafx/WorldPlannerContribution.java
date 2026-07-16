package features.worldplanner.adapter.javafx;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import shell.api.ContributionKey;
import shell.api.InspectorSink;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import features.creatures.api.CreatureCatalogModel;
import features.encountertable.api.EncounterTableCatalogModel;
import features.worldplanner.application.WorldPlannerApplicationService;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.worldplanner.api.WorldPlannerEncounterSink;

public final class WorldPlannerContribution implements ShellContribution {

    private final WorldPlannerApplicationService worldPlanner;
    private final @Nullable WorldPlannerEncounterSink encounter;
    private final WorldPlannerSnapshotModel snapshotModel;
    private final @Nullable CreatureCatalogModel creatureCatalog;
    private final @Nullable EncounterTableCatalogModel encounterTableCatalog;
    private final InspectorSink inspector;

    public WorldPlannerContribution(
            WorldPlannerApplicationService worldPlanner,
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
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("world-planner"),
                new NavigationGroupSpec("planning", "Planning", 10),
                25,
                false,
                NavigationGraphicResource.of("/view/leftbartabs/worldplanner/navigation-icon.svg"),
                ShellLeftBarTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind() {
        return new WorldPlannerBinder(
                worldPlanner,
                encounter,
                snapshotModel,
                creatureCatalog,
                encounterTableCatalog,
                inspector).bind();
    }
}
