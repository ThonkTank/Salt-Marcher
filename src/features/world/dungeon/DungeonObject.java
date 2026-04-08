package features.world.dungeon;

import features.world.dungeon.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeon.application.stair.DungeonStairApplicationService;
import features.world.dungeon.application.transition.DungeonTransitionApplicationService;
import features.world.dungeon.catalog.application.DungeonMapCatalogService;
import features.world.dungeon.dungeonmap.DungeonMapObject;
import features.world.dungeon.dungeonmap.application.DungeonMapApplicationService;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadingService;
import features.world.dungeon.dungeonmap.cluster.application.ApplicationObject;
import features.world.dungeon.dungeonmap.corridor.CorridorObject;
import features.world.dungeon.dungeonmap.corridor.application.DungeonCorridorApplicationService;
import features.world.dungeon.input.ComposeDungeonInput;
import features.world.dungeon.input.ViewsInput;
import features.world.dungeon.room.RoomObject;
import features.world.dungeon.shell.editor.EditorObject;
import features.world.dungeon.shell.editor.input.ComposeEditorInput;
import features.world.dungeon.transition.TransitionObject;
import ui.shell.DetailsNavigator;

import java.util.Objects;

/**
 * Public dungeon feature seam that composes the runtime and editor surfaces.
 */
public final class DungeonObject {

    private final ViewsInput views;

    public DungeonObject(ComposeDungeonInput input) {
        ComposeDungeonInput resolvedInput = Objects.requireNonNull(input, "input");
        DetailsNavigator detailsNavigator = Objects.requireNonNull(resolvedInput.detailsNavigator(), "detailsNavigator");
        features.world.api.input.TravelSurfaceInput travelSurface =
                Objects.requireNonNull(resolvedInput.travelSurface(), "travelSurface");

        DungeonMapApplicationService mapApplicationService = new DungeonMapApplicationService();
        features.world.dungeon.dungeonmap.cluster.repository.DungeonClusterRepository clusterRepository =
                new features.world.dungeon.dungeonmap.cluster.repository.DungeonClusterRepository();
        features.world.dungeon.repository.DungeonRoomRepository roomRepository =
                new features.world.dungeon.repository.DungeonRoomRepository();
        features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository corridorRepository =
                new features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository();
        features.world.dungeon.repository.DungeonStairRepository stairRepository =
                new features.world.dungeon.repository.DungeonStairRepository();
        features.world.dungeon.repository.DungeonTransitionRepository transitionRepository =
                new features.world.dungeon.repository.DungeonTransitionRepository();
        features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository =
                new features.world.dungeon.dungeonmap.repository.DungeonMapRepository(
                        clusterRepository,
                        roomRepository,
                        corridorRepository,
                        stairRepository,
                        transitionRepository,
                        mapApplicationService);
        DungeonMapLoadResolver loadResolver = new DungeonMapLoadResolver(mapRepository);
        TransitionObject transitionObject = new TransitionObject();
        DungeonMapObject mapObject = new DungeonMapObject(
                mapRepository,
                mapApplicationService,
                new CorridorObject(corridorRepository),
                transitionObject);
        ApplicationObject clusterApplicationService = new ApplicationObject(
                mapApplicationService,
                mapRepository,
                clusterRepository,
                mapObject);
        RoomObject roomObject = new RoomObject();
        DungeonStairApplicationService stairApplicationService = new DungeonStairApplicationService(
                mapRepository,
                stairRepository);
        DungeonTransitionApplicationService transitionApplicationService = new DungeonTransitionApplicationService(
                mapRepository,
                transitionRepository,
                transitionObject);
        DungeonRuntimeApplicationService runtimeApplicationService = new DungeonRuntimeApplicationService(
                mapRepository,
                loadResolver);
        DungeonMapCatalogService mapCatalogService = new DungeonMapCatalogService(
                clusterApplicationService,
                runtimeApplicationService);
        DungeonCorridorApplicationService corridorApplicationService = new DungeonCorridorApplicationService(
                mapRepository,
                corridorRepository,
                mapApplicationService);
        features.world.dungeon.dungeonmap.state.DungeonMapState mapState =
                new features.world.dungeon.dungeonmap.state.DungeonMapState();
        DungeonMapLoadingService loadingService = new DungeonMapLoadingService(
                loadResolver,
                mapState);
        features.world.dungeon.state.DungeonEditorSessionState editorSessionState =
                new features.world.dungeon.state.DungeonEditorSessionState();
        features.world.dungeon.shell.interaction.DungeonHitCollector hitCollector =
                new features.world.dungeon.shell.interaction.DungeonHitCollector();

        ui.shell.AppView dungeonView = new features.world.dungeon.shell.runtime.surface.SurfaceObject(
                "Dungeon",
                false,
                loadingService,
                mapState,
                runtimeApplicationService,
                detailsNavigator,
                travelSurface,
                hitCollector);

        EditorObject editorObject = new EditorObject(new ComposeEditorInput(
                loadingService,
                mapState,
                mapCatalogService,
                editorSessionState,
                mapApplicationService,
                clusterApplicationService,
                corridorApplicationService,
                stairApplicationService,
                roomObject,
                hitCollector));
        this.views = new ViewsInput(
                dungeonView,
                editorObject.views(new features.world.dungeon.shell.editor.input.ViewsInput(null)).dungeonEditorView());
    }

    public ViewsInput views(ViewsInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return views;
    }
}
