package features.dungeon.adapter.javafx.travel;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import features.dungeon.api.travel.DungeonTravelApi;
import features.dungeon.api.DungeonMapCatalogModel;
import features.dungeon.api.TravelDungeonModel;

public final class DungeonTravelContribution implements ShellContribution {

    private final DungeonTravelApi travel;
    private final DungeonMapCatalogModel mapCatalogModel;
    private final TravelDungeonModel travelModel;

    public DungeonTravelContribution(
            DungeonTravelApi travel,
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
