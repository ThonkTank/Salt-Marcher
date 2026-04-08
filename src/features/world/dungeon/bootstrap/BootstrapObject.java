package features.world.dungeon.bootstrap;

import features.world.api.WorldTravelSurface;
import features.world.dungeon.dungeonmap.corridor.application.DungeonCorridorApplicationService;
import features.world.dungeon.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeon.application.room.DungeonRoomApplicationService;
import features.world.dungeon.application.stair.DungeonStairApplicationService;
import features.world.dungeon.application.transition.DungeonTransitionApplicationService;
import features.world.dungeon.catalog.application.DungeonMapCatalogService;
import features.world.dungeon.dungeonmap.application.DungeonMapApplicationService;
import features.world.dungeon.dungeonmap.DungeonMapObject;
import features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService;
import features.world.dungeon.dungeonmap.cluster.repository.DungeonClusterRepository;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadingService;
import features.world.dungeon.dungeonmap.corridor.CorridorObject;
import features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository;
import features.world.dungeon.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeon.repository.DungeonRoomRepository;
import features.world.dungeon.repository.DungeonStairRepository;
import features.world.dungeon.repository.DungeonTransitionRepository;
import features.world.dungeon.transition.TransitionObject;
import features.world.dungeon.shell.editor.state.DungeonEditorView;
import features.world.dungeon.shell.editor.state.RoomNarrationPane;
import features.world.dungeon.shell.editor.interaction.input.EditorTool;
import features.world.dungeon.shell.editor.interaction.state.BoundaryTool;
import features.world.dungeon.shell.editor.interaction.state.CorridorTool;
import features.world.dungeon.shell.editor.interaction.state.DoorTool;
import features.world.dungeon.shell.editor.interaction.state.EditorInteraction;
import features.world.dungeon.shell.editor.interaction.state.FloorTool;
import features.world.dungeon.shell.editor.interaction.state.PaintTool;
import features.world.dungeon.shell.editor.interaction.state.SelectionTool;
import features.world.dungeon.shell.editor.interaction.state.StairTool;
import features.world.dungeon.shell.editor.interaction.state.TransitionTool;
import features.world.dungeon.shell.interaction.DungeonHitCollector;
import features.world.dungeon.shell.runtime.DungeonRuntimeView;
import features.world.dungeon.state.DungeonEditorSessionState;
import features.world.dungeon.dungeonmap.state.DungeonMapState;
import features.world.dungeon.state.EditorInteractionState;
import ui.shell.AppView;
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

    private final AppView dungeonView;
    private final AppView dungeonEditorView;

    public BootstrapObject(DetailsNavigator detailsNavigator, WorldTravelSurface travelSurface) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        DungeonMapApplicationService mapApplicationService = new DungeonMapApplicationService();
        DungeonClusterRepository clusterRepository = new DungeonClusterRepository();
        DungeonRoomRepository roomRepository = new DungeonRoomRepository();
        DungeonCorridorRepository corridorRepository = new DungeonCorridorRepository();
        DungeonStairRepository stairRepository = new DungeonStairRepository();
        DungeonTransitionRepository transitionRepository = new DungeonTransitionRepository();
        DungeonMapRepository mapRepository = new DungeonMapRepository(
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
        DungeonClusterApplicationService clusterApplicationService = new DungeonClusterApplicationService(
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
        DungeonMapState state = new DungeonMapState();
        DungeonMapLoadingService loadingService = new DungeonMapLoadingService(
                loadResolver,
                state);
        DungeonEditorSessionState editorSessionState = new DungeonEditorSessionState();
        EditorInteractionState editorInteractionState = new EditorInteractionState();
        RoomNarrationPane roomNarrationPane = new RoomNarrationPane(
                state,
                loadingService,
                roomApplicationService,
                editorInteractionState);
        DungeonHitCollector hitCollector = new DungeonHitCollector();
        StairTool stairTool = new StairTool(
                state,
                loadingService,
                mapApplicationService,
                stairApplicationService,
                editorInteractionState);
        List<EditorTool> editorTools = List.of(
                new SelectionTool(
                        state,
                        loadingService,
                        mapApplicationService,
                        clusterApplicationService,
                        corridorApplicationService,
                        stairApplicationService,
                        roomNarrationPane,
                        stairTool,
                        editorInteractionState),
                new PaintTool(
                        state,
                        loadingService,
                        editorSessionState,
                        clusterApplicationService,
                        editorInteractionState),
                new FloorTool(
                        state,
                        loadingService,
                        editorSessionState,
                        clusterApplicationService,
                        editorInteractionState),
                new BoundaryTool(
                        state,
                        loadingService,
                        editorSessionState,
                        clusterApplicationService,
                        editorInteractionState),
                new DoorTool(
                        state,
                        loadingService,
                        clusterApplicationService,
                        editorInteractionState),
                new CorridorTool(
                        state,
                        loadingService,
                        corridorApplicationService,
                        editorInteractionState),
                stairTool,
                new TransitionTool(
                        state,
                        loadingService,
                        editorSessionState,
                        mapApplicationService,
                        transitionApplicationService,
                        editorInteractionState));
        EditorInteraction editorInteraction = new EditorInteraction(
                state,
                editorSessionState,
                editorInteractionState,
                hitCollector,
                editorTools);
        this.dungeonView = new DungeonRuntimeView(
                "Dungeon",
                false,
                loadingService,
                state,
                runtimeApplicationService,
                detailsNavigator,
                travelSurface,
                hitCollector);
        this.dungeonEditorView = new DungeonEditorView(
                loadingService,
                state,
                mapCatalogService,
                editorSessionState,
                editorInteraction);
    }

    public AppView dungeonView() {
        return dungeonView;
    }

    public AppView dungeonEditorView() {
        return dungeonEditorView;
    }
}
