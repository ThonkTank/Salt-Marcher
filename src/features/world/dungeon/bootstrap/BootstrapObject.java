package features.world.dungeon.bootstrap;

import features.world.api.input.TravelSurfaceInput;
import features.world.dungeon.application.room.DungeonRoomApplicationService;
import features.world.dungeon.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeon.application.stair.DungeonStairApplicationService;
import features.world.dungeon.application.transition.DungeonTransitionApplicationService;
import features.world.dungeon.bootstrap.input.BootstrapViews;
import features.world.dungeon.catalog.application.DungeonMapCatalogService;
import features.world.dungeon.dungeonmap.DungeonMapObject;
import features.world.dungeon.dungeonmap.application.DungeonMapApplicationService;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadingService;
import features.world.dungeon.dungeonmap.cluster.application.ApplicationObject;
import features.world.dungeon.dungeonmap.corridor.CorridorObject;
import features.world.dungeon.dungeonmap.corridor.application.DungeonCorridorApplicationService;
import features.world.dungeon.shell.editor.interaction.input.EditorTool;
import features.world.dungeon.shell.interaction.DungeonHitCollector;
import features.world.dungeon.shell.runtime.surface.SurfaceObject;
import features.world.dungeon.transition.TransitionObject;
import ui.shell.DetailsNavigator;

import java.util.List;
import java.util.Objects;

/**
 * Internal composition root for the dungeon feature.
 *
 * <p>This module wires one shared set of state, loading, hit, and workflow owners and exposes the paired editor and
 * runtime views. Feature wiring should stay here instead of being rebuilt inside views or tools.</p>
 */
public final class BootstrapObject {

    private final ui.shell.AppView dungeonView;
    private final ui.shell.AppView dungeonEditorView;

    public BootstrapObject(DetailsNavigator detailsNavigator, TravelSurfaceInput travelSurface) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
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
        DungeonMapObject mapObject = new DungeonMapObject(
                mapRepository,
                mapApplicationService,
                new CorridorObject(corridorRepository),
                new TransitionObject(transitionRepository));
        ApplicationObject clusterApplicationService = new ApplicationObject(
                mapApplicationService,
                mapRepository,
                clusterRepository,
                mapObject);
        DungeonRoomApplicationService roomApplicationService = new DungeonRoomApplicationService(roomRepository);
        DungeonStairApplicationService stairApplicationService = new DungeonStairApplicationService(
                mapRepository,
                stairRepository);
        DungeonTransitionApplicationService transitionApplicationService = new DungeonTransitionApplicationService(
                mapRepository,
                transitionRepository);
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
        features.world.dungeon.dungeonmap.state.DungeonMapState state =
                new features.world.dungeon.dungeonmap.state.DungeonMapState();
        DungeonMapLoadingService loadingService = new DungeonMapLoadingService(
                loadResolver,
                state);
        features.world.dungeon.state.DungeonEditorSessionState editorSessionState =
                new features.world.dungeon.state.DungeonEditorSessionState();
        features.world.dungeon.state.EditorInteractionState editorInteractionState =
                new features.world.dungeon.state.EditorInteractionState();
        features.world.dungeon.shell.editor.state.RoomNarrationPane roomNarrationPane =
                new features.world.dungeon.shell.editor.state.RoomNarrationPane(
                        state,
                        loadingService,
                        roomApplicationService,
                        editorInteractionState);
        DungeonHitCollector hitCollector = new DungeonHitCollector();
        features.world.dungeon.shell.editor.interaction.state.StairTool stairTool =
                new features.world.dungeon.shell.editor.interaction.state.StairTool(
                        state,
                        loadingService,
                        mapApplicationService,
                        stairApplicationService,
                        editorInteractionState);
        List<EditorTool> editorTools = List.of(
                new features.world.dungeon.shell.editor.interaction.state.SelectionTool(
                        state,
                        loadingService,
                        mapApplicationService,
                        clusterApplicationService,
                        corridorApplicationService,
                        stairApplicationService,
                        roomNarrationPane,
                        stairTool,
                        editorInteractionState),
                new features.world.dungeon.shell.editor.interaction.state.PaintTool(
                        state,
                        loadingService,
                        editorSessionState,
                        clusterApplicationService,
                        editorInteractionState),
                new features.world.dungeon.shell.editor.interaction.state.FloorTool(
                        state,
                        loadingService,
                        editorSessionState,
                        clusterApplicationService,
                        editorInteractionState),
                new features.world.dungeon.shell.editor.interaction.state.BoundaryTool(
                        state,
                        loadingService,
                        editorSessionState,
                        clusterApplicationService,
                        editorInteractionState),
                new features.world.dungeon.shell.editor.interaction.state.DoorTool(
                        state,
                        loadingService,
                        clusterApplicationService,
                        editorInteractionState),
                new features.world.dungeon.shell.editor.interaction.state.CorridorTool(
                        state,
                        loadingService,
                        corridorApplicationService,
                        editorInteractionState),
                stairTool,
                new features.world.dungeon.shell.editor.interaction.state.TransitionTool(
                        state,
                        loadingService,
                        editorSessionState,
                        mapApplicationService,
                        transitionApplicationService,
                        editorInteractionState));
        features.world.dungeon.shell.editor.interaction.state.EditorInteraction editorInteraction =
                new features.world.dungeon.shell.editor.interaction.state.EditorInteraction(
                        state,
                        editorSessionState,
                        editorInteractionState,
                        hitCollector,
                        editorTools);
        this.dungeonView = new SurfaceObject(
                "Dungeon",
                false,
                loadingService,
                state,
                runtimeApplicationService,
                detailsNavigator,
                travelSurface,
                hitCollector);
        this.dungeonEditorView = new features.world.dungeon.shell.editor.state.DungeonEditorView(
                loadingService,
                state,
                mapCatalogService,
                editorSessionState,
                editorInteraction);
    }

    public BootstrapViews views() {
        return new BootstrapViews(dungeonView, dungeonEditorView);
    }
}
