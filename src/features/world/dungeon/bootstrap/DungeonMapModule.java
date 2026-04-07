package features.world.dungeon.bootstrap;

import features.world.api.WorldTravelSurface;
import features.world.dungeon.dungoenmap.corridor.application.DungeonCorridorApplicationService;
import features.world.dungeon.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeon.application.room.DungeonRoomApplicationService;
import features.world.dungeon.application.stair.DungeonStairApplicationService;
import features.world.dungeon.application.transition.DungeonTransitionApplicationService;
import features.world.dungeon.catalog.application.DungeonMapCatalogService;
import features.world.dungeon.dungoenmap.cluster.application.DungeonClusterApplicationService;
import features.world.dungeon.dungoenmap.cluster.repository.DungeonClusterRepository;
import features.world.dungeon.dungoenmap.application.DungeonMapLoadResolver;
import features.world.dungeon.dungoenmap.application.DungeonMapLoadingService;
import features.world.dungeon.dungoenmap.corridor.repository.DungeonCorridorRepository;
import features.world.dungeon.dungoenmap.repository.DungeonLayoutRepository;
import features.world.dungeon.repository.DungeonRoomRepository;
import features.world.dungeon.repository.DungeonStairRepository;
import features.world.dungeon.repository.DungeonTransitionRepository;
import features.world.dungeon.shell.editor.DungeonEditorView;
import features.world.dungeon.shell.editor.RoomNarrationPane;
import features.world.dungeon.shell.editor.interaction.BoundaryTool;
import features.world.dungeon.shell.editor.interaction.CorridorTool;
import features.world.dungeon.shell.editor.interaction.DoorTool;
import features.world.dungeon.shell.editor.interaction.EditorInteraction;
import features.world.dungeon.shell.editor.interaction.EditorTool;
import features.world.dungeon.shell.editor.interaction.FloorTool;
import features.world.dungeon.shell.editor.interaction.PaintTool;
import features.world.dungeon.shell.editor.interaction.SelectionTool;
import features.world.dungeon.shell.editor.interaction.StairTool;
import features.world.dungeon.shell.editor.interaction.TransitionTool;
import features.world.dungeon.shell.interaction.DungeonHitCollector;
import features.world.dungeon.shell.runtime.DungeonRuntimeView;
import features.world.dungeon.state.DungeonEditorSessionState;
import features.world.dungeon.dungoenmap.state.DungeonMapState;
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
public final class DungeonMapModule {

    private final AppView dungeonView;
    private final AppView dungeonEditorView;

    public DungeonMapModule(DetailsNavigator detailsNavigator, WorldTravelSurface travelSurface) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        DungeonLayoutRepository layoutRepository = new DungeonLayoutRepository();
        DungeonClusterRepository clusterRepository = new DungeonClusterRepository();
        DungeonRoomRepository roomRepository = new DungeonRoomRepository();
        DungeonCorridorRepository corridorRepository = new DungeonCorridorRepository();
        DungeonStairRepository stairRepository = new DungeonStairRepository();
        DungeonTransitionRepository transitionRepository = new DungeonTransitionRepository();
        DungeonMapLoadResolver loadResolver = new DungeonMapLoadResolver(layoutRepository);
        DungeonClusterApplicationService clusterApplicationService = new DungeonClusterApplicationService(
                layoutRepository,
                clusterRepository,
                corridorRepository,
                roomRepository,
                transitionRepository);
        DungeonRoomApplicationService roomApplicationService = new DungeonRoomApplicationService(roomRepository);
        DungeonStairApplicationService stairApplicationService = new DungeonStairApplicationService(
                layoutRepository,
                stairRepository);
        DungeonTransitionApplicationService transitionApplicationService = new DungeonTransitionApplicationService(
                layoutRepository,
                transitionRepository);
        DungeonRuntimeApplicationService runtimeApplicationService = new DungeonRuntimeApplicationService(
                layoutRepository,
                loadResolver);
        DungeonMapCatalogService mapCatalogService = new DungeonMapCatalogService(
                clusterApplicationService,
                runtimeApplicationService);
        DungeonCorridorApplicationService corridorApplicationService = new DungeonCorridorApplicationService(
                layoutRepository,
                corridorRepository);
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
                stairApplicationService,
                editorInteractionState);
        List<EditorTool> editorTools = List.of(
                new SelectionTool(
                        state,
                        loadingService,
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
