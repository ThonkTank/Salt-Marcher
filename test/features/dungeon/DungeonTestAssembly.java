package features.dungeon;

import features.dungeon.api.DungeonAuthoredMutationModel;
import features.dungeon.api.DungeonAuthoredReadModel;
import features.dungeon.api.DungeonEditorControlsModel;
import features.dungeon.api.DungeonEditorMapSurfaceModel;
import features.dungeon.api.DungeonEditorStateModel;
import features.dungeon.api.DungeonMapCatalogModel;
import features.dungeon.api.TravelDungeonModel;
import features.dungeon.application.authored.DungeonAuthoredApplicationService;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.application.editor.DungeonEditorRuntimeApplicationService;
import features.dungeon.application.travel.DungeonTravelRuntimeApplicationService;
import features.party.api.ActivePartyModel;
import features.party.api.PartyApi;
import features.party.api.PartyMutationModel;
import features.party.api.PartyTravelPositionsModel;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;

/** Test-only access to Dungeon internals without widening the production feature result. */
public final class DungeonTestAssembly {

    private DungeonTestAssembly() {
    }

    public static Component create(
            DungeonCatalogStore catalogStore,
            DungeonMapRepository repository,
            ActivePartyModel activeParty,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApi party,
            PartyMutationModel partyMutation
    ) {
        return create(
                catalogStore,
                repository,
                activeParty,
                partyTravelPositions,
                party,
                partyMutation,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    public static Component create(
            DungeonCatalogStore catalogStore,
            DungeonMapRepository repository,
            ActivePartyModel activeParty,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApi party,
            PartyMutationModel partyMutation,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        DungeonFeature.Runtime runtime = DungeonFeature.createRuntime(
                catalogStore,
                repository,
                activeParty,
                partyTravelPositions,
                party,
                partyMutation,
                executionLane,
                uiDispatcher,
                diagnostics);
        return new Component(
                runtime.authored(),
                runtime.editor(),
                runtime.travel(),
                runtime.authoredRead(),
                runtime.authoredMutation(),
                runtime.mapCatalog(),
                runtime.travelModel(),
                runtime.editorControls(),
                runtime.editorMapSurface(),
                runtime.editorState());
    }

    public record Component(
            DungeonAuthoredApplicationService authored,
            DungeonEditorRuntimeApplicationService editor,
            DungeonTravelRuntimeApplicationService travel,
            DungeonAuthoredReadModel authoredRead,
            DungeonAuthoredMutationModel authoredMutation,
            DungeonMapCatalogModel mapCatalog,
            TravelDungeonModel travelModel,
            DungeonEditorControlsModel editorControls,
            DungeonEditorMapSurfaceModel editorMapSurface,
            DungeonEditorStateModel editorState
    ) {
    }
}
