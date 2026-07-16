package src.view.leftbartabs.dungeontravel;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import src.domain.dungeon.DungeonTravelRuntimeApplicationService;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.TravelDungeonModel;

public final class DungeonTravelContribution implements ShellContribution {

    private final DungeonTravelRuntimeApplicationService travel;
    private final DungeonMapCatalogModel mapCatalogModel;
    private final TravelDungeonModel travelModel;

    public DungeonTravelContribution(
            DungeonTravelRuntimeApplicationService travel,
            DungeonMapCatalogModel mapCatalogModel,
            TravelDungeonModel travelModel
    ) {
        this.travel = Objects.requireNonNull(travel, "travel");
        this.mapCatalogModel = Objects.requireNonNull(mapCatalogModel, "mapCatalogModel");
        this.travelModel = Objects.requireNonNull(travelModel, "travelModel");
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("dungeon-travel"),
                new NavigationGroupSpec("world", "World", 20),
                20,
                false,
                NavigationGraphicResource.of("/view/leftbartabs/dungeontravel/navigation-icon.svg"),
                ShellLeftBarTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind() {
        return new DungeonTravelBinder(travel, mapCatalogModel, travelModel).bind();
    }
}
