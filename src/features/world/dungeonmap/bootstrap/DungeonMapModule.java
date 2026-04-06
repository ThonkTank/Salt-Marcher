package features.world.dungeonmap.bootstrap;

import features.world.api.WorldTravelSurface;
import features.world.dungeonmap.application.corridor.DungeonCorridorApplicationService;
import features.world.dungeonmap.application.room.DungeonRoomApplicationService;
import features.world.dungeonmap.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeonmap.application.stair.DungeonStairApplicationService;
import features.world.dungeonmap.application.transition.DungeonTransitionApplicationService;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapLoadResolver;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.repository.DungeonCorridorRepository;
import features.world.dungeonmap.repository.DungeonLayoutRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonStairRepository;
import features.world.dungeonmap.repository.DungeonTransitionRepository;
import features.world.dungeonmap.shell.editor.DungeonEditorView;
import features.world.dungeonmap.shell.editor.RoomNarrationPane;
import features.world.dungeonmap.shell.editor.interaction.BoundaryTool;
import features.world.dungeonmap.shell.editor.interaction.CorridorTool;
import features.world.dungeonmap.shell.editor.interaction.DoorTool;
import features.world.dungeonmap.shell.editor.interaction.EditorInteraction;
import features.world.dungeonmap.shell.editor.interaction.EditorTool;
import features.world.dungeonmap.shell.editor.interaction.FloorTool;
import features.world.dungeonmap.shell.editor.interaction.PaintTool;
import features.world.dungeonmap.shell.editor.interaction.SelectionTool;
import features.world.dungeonmap.shell.editor.interaction.StairTool;
import features.world.dungeonmap.shell.editor.interaction.TransitionTool;
import features.world.dungeonmap.shell.interaction.DungeonHitCollector;
import features.world.dungeonmap.shell.runtime.DungeonRuntimeView;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.List;
import java.util.Objects;

public final class DungeonMapModule {

    private final AppView dungeonView;
    private final AppView dungeonEditorView;

    public DungeonMapModule(DetailsNavigator detailsNavigator, WorldTravelSurface travelSurface) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        DungeonLayoutRepository layoutRepository = new DungeonLayoutRepository();
        DungeonRoomRepository roomRepository = new DungeonRoomRepository();
        DungeonCorridorRepository corridorRepository = new DungeonCorridorRepository();
        DungeonStairRepository stairRepository = new DungeonStairRepository();
        DungeonTransitionRepository transitionRepository = new DungeonTransitionRepository();
        DungeonMapLoadResolver loadResolver = new DungeonMapLoadResolver(layoutRepository);
        DungeonRoomApplicationService roomApplicationService = new DungeonRoomApplicationService(
                layoutRepository,
                corridorRepository,
                roomRepository,
                transitionRepository);
        DungeonStairApplicationService stairApplicationService = new DungeonStairApplicationService(
                layoutRepository,
                stairRepository);
        DungeonTransitionApplicationService transitionApplicationService = new DungeonTransitionApplicationService(
                layoutRepository,
                roomApplicationService,
                transitionRepository,
                roomRepository,
                corridorRepository);
        DungeonRuntimeApplicationService runtimeApplicationService = new DungeonRuntimeApplicationService(
                layoutRepository,
                loadResolver);
        DungeonMapCatalogService mapCatalogService = new DungeonMapCatalogService(
                roomApplicationService,
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
                        roomApplicationService,
                        corridorApplicationService,
                        stairApplicationService,
                        roomNarrationPane,
                        stairTool,
                        editorInteractionState),
                new PaintTool(
                        state,
                        loadingService,
                        editorSessionState,
                        roomApplicationService,
                        editorInteractionState),
                new FloorTool(
                        state,
                        loadingService,
                        editorSessionState,
                        roomApplicationService,
                        editorInteractionState),
                new BoundaryTool(
                        state,
                        loadingService,
                        editorSessionState,
                        roomApplicationService,
                        editorInteractionState),
                new DoorTool(
                        state,
                        loadingService,
                        roomApplicationService,
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
