package features.dungeon;

import features.dungeon.api.DungeonAuthoredMutationModel;
import features.dungeon.api.DungeonAuthoredReadModel;
import features.dungeon.api.DungeonEditorControlsModel;
import features.dungeon.api.DungeonEditorMapSurfaceModel;
import features.dungeon.api.DungeonEditorStateModel;
import features.dungeon.api.DungeonMapCatalogModel;
import features.dungeon.api.TravelDungeonModel;
import features.dungeon.application.authored.DungeonAuthoredApplicationService;
import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonCompoundUnitOfWorkResult;
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.application.authored.port.DungeonUnitOfWork;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
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
                inMemoryUnitOfWork(),
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
        return create(
                catalogStore,
                repository,
                inMemoryUnitOfWork(),
                activeParty,
                partyTravelPositions,
                party,
                partyMutation,
                executionLane,
                uiDispatcher,
                diagnostics);
    }

    public static Component create(
            DungeonCatalogStore catalogStore,
            DungeonMapRepository repository,
            DungeonUnitOfWork unitOfWork,
            ActivePartyModel activeParty,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApi party,
            PartyMutationModel partyMutation,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        return create(
                catalogStore,
                repository,
                repository instanceof DungeonWindowStore store ? store : emptyWindowStore(),
                unitOfWork,
                activeParty,
                partyTravelPositions,
                party,
                partyMutation,
                executionLane,
                uiDispatcher,
                diagnostics);
    }

    public static Component create(
            DungeonCatalogStore catalogStore,
            DungeonMapRepository repository,
            DungeonWindowStore windowStore,
            ActivePartyModel activeParty,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApi party,
            PartyMutationModel partyMutation,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        return create(
                catalogStore,
                repository,
                windowStore,
                inMemoryUnitOfWork(),
                activeParty,
                partyTravelPositions,
                party,
                partyMutation,
                executionLane,
                uiDispatcher,
                diagnostics);
    }

    public static Component create(
            DungeonCatalogStore catalogStore,
            DungeonMapRepository repository,
            DungeonWindowStore windowStore,
            DungeonUnitOfWork unitOfWork,
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
                windowStore,
                unitOfWork,
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

    public static DungeonWindowStore emptyWindowStore() {
        return new DungeonWindowStore() {
            @Override
            public java.util.Optional<DungeonWindow> loadWindow(DungeonWindowRequest request) {
                return java.util.Optional.empty();
            }

            @Override
            public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
                return new DungeonIdentityClosureResult.Rejected(
                        DungeonIdentityClosureResult.Reason.MAP_MISSING,
                        request == null ? java.util.List.of() : request.entityRefs());
            }
        };
    }

    public static DungeonUnitOfWork inMemoryUnitOfWork() {
        return new DungeonUnitOfWork() {
            @Override
            public DungeonUnitOfWorkResult commit(DungeonPatch patch) {
                return committed(patch);
            }

            @Override
            public DungeonCompoundUnitOfWorkResult commit(DungeonCompoundPatch patch) {
                return new DungeonCompoundUnitOfWorkResult.Committed(
                        patch.patches().stream().map(this::committed).toList());
            }

            private DungeonUnitOfWorkResult.Committed committed(DungeonPatch patch) {
                return new DungeonUnitOfWorkResult.Committed(
                        patch.mapId(),
                        patch.committedRevision(),
                        patch.touchedChunks().stream().collect(java.util.stream.Collectors.toUnmodifiableMap(
                                key -> key,
                                ignored -> patch.committedRevision())),
                        patch.resultFacts());
            }
        };
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
