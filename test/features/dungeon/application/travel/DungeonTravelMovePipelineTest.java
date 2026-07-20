package features.dungeon.application.travel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.DungeonTravelContextKind;
import features.dungeon.api.DungeonTravelMoveStatus;
import features.dungeon.api.DungeonTravelRejectionReason;
import features.dungeon.api.TravelDungeonSnapshot;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysRequest;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowChunkHeader;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.party.api.ActivePartyCompositionModel;
import features.party.api.ActivePartyModel;
import features.party.api.ActivePartyResult;
import features.party.api.AdjustPartyXpCommand;
import features.party.api.AdventuringDayCalculationModel;
import features.party.api.AdventuringDaySummaryModel;
import features.party.api.AwardPartyXpCommand;
import features.party.api.CalculateAdventuringDayCommand;
import features.party.api.CreateCharacterCommand;
import features.party.api.DeleteCharacterCommand;
import features.party.api.MovePartyCharactersCommand;
import features.party.api.MutationResult;
import features.party.api.MutationStatus;
import features.party.api.PartyApi;
import features.party.api.PartyDungeonTravelLocationKind;
import features.party.api.PartyDungeonTravelLocationSnapshot;
import features.party.api.PartyMemberSummary;
import features.party.api.PartyMutationModel;
import features.party.api.PartyOverworldTravelLocationSnapshot;
import features.party.api.PartyPlanningFactsQuery;
import features.party.api.PartyPlanningFactsResponse;
import features.party.api.PartySnapshotModel;
import features.party.api.PartyTravelHeading;
import features.party.api.PartyTravelPositionSnapshot;
import features.party.api.PartyTravelPositionsModel;
import features.party.api.PartyTravelPositionsResult;
import features.party.api.PartyTravelTile;
import features.party.api.PerformPartyRestCommand;
import features.party.api.ReadStatus;
import features.party.api.SetPartyMembershipCommand;
import features.party.api.UpdateCharacterCommand;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;

final class DungeonTravelMovePipelineTest {

    @Test
    void actionPublishesMovingThenOneAcceptedCommittedRefresh() {
        Fixture fixture = new Fixture();
        TravelDungeonSnapshot initial = fixture.snapshot();
        var actionId = initial.travelSurface().actions().getFirst().actionId();

        fixture.service.performAction(actionId);

        TravelDungeonSnapshot moving = fixture.snapshot();
        assertEquals(DungeonTravelMoveStatus.MOVING, moving.moveOutcome().status());
        assertEquals(Fixture.START, moving.travelSurface().position().tile());
        assertEquals(1, fixture.party.moveCalls);
        int readsBeforeCompletion = fixture.windows.windowLoads;

        fixture.party.completeSuccess();

        TravelDungeonSnapshot accepted = fixture.snapshot();
        assertEquals(DungeonTravelMoveStatus.ACCEPTED, accepted.moveOutcome().status());
        assertEquals(DungeonTravelContextKind.OVERWORLD, accepted.travelSurface().contextKind());
        assertEquals(2L, accepted.travelSurface().partyPositionRevision());
        assertEquals(readsBeforeCompletion, fixture.windows.windowLoads,
                "overworld acceptance resolves from committed Party state without another Dungeon window");
    }

    @Test
    void partyRejectAndExceptionalCompletionPreserveOrigin() {
        Fixture rejectedFixture = new Fixture();
        var actionId = rejectedFixture.snapshot().travelSurface().actions().getFirst().actionId();
        rejectedFixture.service.performAction(actionId);
        rejectedFixture.party.complete(MutationStatus.NOT_FOUND);

        TravelDungeonSnapshot rejected = rejectedFixture.snapshot();
        assertEquals(DungeonTravelMoveStatus.REJECTED, rejected.moveOutcome().status());
        assertEquals(DungeonTravelRejectionReason.PARTY_REJECTED, rejected.moveOutcome().rejectionReason());
        assertEquals(Fixture.START, rejected.travelSurface().position().tile());
        assertEquals(1L, rejected.travelSurface().partyPositionRevision());

        Fixture failedFixture = new Fixture();
        failedFixture.service.performAction(
                failedFixture.snapshot().travelSurface().actions().getFirst().actionId());
        failedFixture.party.fail(new IllegalStateException("controlled failure"));

        TravelDungeonSnapshot failed = failedFixture.snapshot();
        assertEquals(DungeonTravelMoveStatus.REJECTED, failed.moveOutcome().status());
        assertEquals(DungeonTravelRejectionReason.PARTY_FAILURE, failed.moveOutcome().rejectionReason());
        assertEquals(Fixture.START, failed.travelSurface().position().tile());
        assertEquals(1L, failed.travelSurface().partyPositionRevision());
    }

    @Test
    void directReachabilityDistinguishesReachableOffWindowWallAndNonTraversableTargets() {
        Fixture reachableFixture = new Fixture();
        reachableFixture.service.moveTo(new DungeonCellRef(0, 1, 0));
        assertEquals(DungeonTravelMoveStatus.MOVING, reachableFixture.snapshot().moveOutcome().status());
        assertEquals(Fixture.START, reachableFixture.snapshot().travelSurface().position().tile());
        assertEquals(1, reachableFixture.party.moveCalls);
        int readsBeforeCompletion = reachableFixture.windows.windowLoads;
        reachableFixture.party.completeSuccess();

        TravelDungeonSnapshot accepted = reachableFixture.snapshot();
        assertEquals(DungeonTravelMoveStatus.ACCEPTED, accepted.moveOutcome().status());
        assertEquals(new DungeonCellRef(0, 1, 0), accepted.travelSurface().position().tile());
        assertEquals(readsBeforeCompletion + 1, reachableFixture.windows.windowLoads,
                "accepted Dungeon move performs exactly one committed Window reread");

        assertDirectRejection(
                new DungeonCellRef(100, 100, 0), DungeonTravelRejectionReason.OFF_WINDOW);
        assertDirectRejection(
                new DungeonCellRef(1, 0, 0), DungeonTravelRejectionReason.UNREACHABLE);
        assertDirectRejection(
                new DungeonCellRef(5, 5, 0), DungeonTravelRejectionReason.NON_TRAVERSABLE);
    }

    @Test
    void lateCompletionCannotReplaceNewerCommandOrItsPartyRevision() {
        Fixture fixture = new Fixture();
        var actionId = fixture.snapshot().travelSurface().actions().getFirst().actionId();

        fixture.service.performAction(actionId);
        fixture.service.moveTo(new DungeonCellRef(0, 1, 0));
        fixture.party.completeSuccess(1);

        TravelDungeonSnapshot newer = fixture.snapshot();
        assertEquals(DungeonTravelMoveStatus.ACCEPTED, newer.moveOutcome().status());
        assertEquals(3L, newer.moveOutcome().commandGeneration());
        assertEquals(2L, newer.travelSurface().partyPositionRevision());
        assertEquals(new DungeonCellRef(0, 1, 0), newer.travelSurface().position().tile());

        fixture.party.completeSuccess(0);

        TravelDungeonSnapshot afterLateCompletion = fixture.snapshot();
        assertEquals(newer, afterLateCompletion);
        assertEquals(3L, fixture.party.currentPositions.revision(),
                "controlled late Party publication is newer but cannot overwrite the newer Dungeon command");
    }

    private static void assertDirectRejection(
            DungeonCellRef target,
            DungeonTravelRejectionReason expectedReason
    ) {
        Fixture fixture = new Fixture();

        fixture.service.moveTo(target);

        TravelDungeonSnapshot rejected = fixture.snapshot();
        assertEquals(DungeonTravelMoveStatus.REJECTED, rejected.moveOutcome().status());
        assertEquals(expectedReason, rejected.moveOutcome().rejectionReason());
        assertEquals(Fixture.START, rejected.travelSurface().position().tile());
        assertEquals(0, fixture.party.moveCalls);
    }

    private static final class Fixture {
        private static final long MAP_ID = 41L;
        private static final long ROOM_ID = 11L;
        private static final Cell START_CELL = new Cell(0, 0, 0);
        private static final DungeonCellRef START = new DungeonCellRef(0, 0, 0);

        private final ControllablePartyApi party = new ControllablePartyApi(MAP_ID, ROOM_ID, START_CELL);
        private final FakeCatalog catalog = new FakeCatalog(MAP_ID);
        private final FakeWindows windows = new FakeWindows(catalog.header);
        private final DungeonTravelPublishedState publishedState =
                new DungeonTravelPublishedState(DirectUiDispatcher.INSTANCE);
        private final DungeonTravelRuntimeApplicationService service;

        private Fixture() {
            DungeonTravelPartyGateway gateway = new DungeonTravelPartyGateway(
                    party.activeParty(), party.travelPositions(), party);
            DungeonTravelAuthoredReader reader = new DungeonTravelAuthoredReader(catalog, windows);
            DungeonTravelSurfaceLoader loader = new DungeonTravelSurfaceLoader(reader, gateway);
            service = new DungeonTravelRuntimeApplicationService(
                    loader,
                    new DungeonTravelNavigator(reader, gateway, loader),
                    publishedState);
            service.refresh();
            assertNotNull(snapshot().travelSurface());
        }

        private TravelDungeonSnapshot snapshot() {
            return publishedState.travelModel().current();
        }
    }

    private static final class FakeCatalog implements DungeonCatalogStore {
        private final DungeonMapHeader header;

        private FakeCatalog(long mapId) {
            header = new DungeonMapHeader(new DungeonMapIdentity(mapId), "Pipeline", 7L);
        }

        @Override
        public List<DungeonMapHeader> search(String query) {
            return List.of(header);
        }

        @Override
        public DungeonMapHeader create(String mapName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public DungeonMapHeader rename(DungeonMapIdentity mapId, String mapName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void delete(DungeonMapIdentity mapId) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class FakeWindows implements DungeonWindowStore {
        private static final long TRANSITION_ID = 301L;
        private final DungeonMapHeader header;
        private final DungeonChunkKey chunk;
        private final Transition transition;
        private int windowLoads;

        private FakeWindows(DungeonMapHeader header) {
            this.header = header;
            chunk = new DungeonChunkKey(header.mapId().value(), 0, 0, 0);
            transition = new Transition(
                    TRANSITION_ID,
                    header.mapId().value(),
                    "Overworld portal",
                    TransitionAnchor.cell(Fixture.START_CELL),
                    TransitionDestination.overworldTile(9L, 99L),
                    null);
        }

        @Override
        public Optional<DungeonWindow> loadWindow(DungeonWindowRequest request) {
            windowLoads++;
            return Optional.of(new DungeonWindow(
                    header,
                    request.requestGeneration(),
                    List.of(new DungeonWindowChunkHeader(chunk, header.revision())),
                    List.of(room(), cluster(), transitionFragment()),
                    List.of(),
                    List.of(),
                    new features.dungeon.application.authored.port.DungeonContinuationPage(
                            List.of(), java.util.Optional.empty())));
        }

        @Override
        public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
            List<DungeonEntitySnapshot> snapshots = request.entityRefs().stream()
                    .filter(ref -> ref.equals(DungeonPatchEntityRef.transition(TRANSITION_ID)))
                    .map(ignored -> (DungeonEntitySnapshot) new DungeonEntitySnapshot.TransitionSnapshot(transition))
                    .toList();
            return new DungeonIdentityClosureResult.Complete(header, snapshots);
        }

        @Override
        public DungeonTravelChunkKeysResult discoverTravelChunkKeys(DungeonTravelChunkKeysRequest request) {
            return new DungeonTravelChunkKeysResult.Complete(header, List.of(chunk));
        }

        private DungeonWindowEntityFragment.Room room() {
            return new DungeonWindowEntityFragment.Room(
                    DungeonPatchEntityRef.room(Fixture.ROOM_ID),
                    21L,
                    "Room",
                    "",
                    List.of(Fixture.START_CELL, new Cell(1, 0, 0), new Cell(0, 1, 0)),
                    List.of(),
                    List.of(chunk),
                    List.of());
        }

        private DungeonWindowEntityFragment.RoomCluster cluster() {
            return new DungeonWindowEntityFragment.RoomCluster(
                    DungeonPatchEntityRef.roomCluster(21L),
                    "Cluster",
                    List.of(new DungeonWindowEntityFragment.ClusterMemberCellFact(
                            Fixture.ROOM_ID, "Room", Fixture.START_CELL)),
                    List.of(new DungeonWindowEntityFragment.ClusterBoundaryFact(
                            Fixture.START_CELL,
                            Direction.EAST,
                            DungeonWindowEntityFragment.BoundaryKind.WALL,
                            DungeonTopologyRef.wall(501L))),
                    List.of(chunk),
                    List.of());
        }

        private DungeonWindowEntityFragment.Transition transitionFragment() {
            return new DungeonWindowEntityFragment.Transition(
                    DungeonPatchEntityRef.transition(TRANSITION_ID),
                    transition.description(),
                    transition.anchor(),
                    transition.destination(),
                    transition.linkedTransitionId(),
                    List.of(chunk),
                    List.of());
        }
    }

    private static final class ControllablePartyApi implements PartyApi {
        private final ActivePartyModel activeParty;
        private final PartyTravelPositionsModel travelPositions;
        private PartyTravelPositionsResult currentPositions;
        private final List<PendingMove> pendingMoves = new ArrayList<>();
        private int moveCalls;

        private ControllablePartyApi(long mapId, long roomId, Cell tile) {
            activeParty = new ActivePartyModel(
                    () -> new ActivePartyResult(
                            ReadStatus.SUCCESS,
                            List.of(new PartyMemberSummary(1L, "Guide", 3))),
                    listener -> () -> { });
            PartyDungeonTravelLocationSnapshot location = new PartyDungeonTravelLocationSnapshot(
                    mapId,
                    PartyDungeonTravelLocationKind.TILE,
                    roomId,
                    new PartyTravelTile(tile.q(), tile.r(), tile.level()),
                    PartyTravelHeading.SOUTH);
            currentPositions = positions(location, 1L);
            travelPositions = new PartyTravelPositionsModel(() -> currentPositions, listener -> () -> { });
        }

        @Override
        public CompletionStage<MutationResult> moveCharacters(MovePartyCharactersCommand command) {
            moveCalls++;
            PendingMove pending = new PendingMove(command, new CompletableFuture<>());
            pendingMoves.add(pending);
            return pending.completion();
        }

        private void completeSuccess() {
            completeSuccess(pendingMoves.size() - 1);
        }

        private void completeSuccess(int index) {
            PendingMove pending = pendingMoves.get(index);
            currentPositions = positions(pending.command().target(), currentPositions.revision() + 1L);
            pending.completion().complete(new MutationResult(MutationStatus.SUCCESS));
        }

        private void complete(MutationStatus status) {
            pendingMoves.getLast().completion().complete(new MutationResult(status));
        }

        private void fail(Throwable failure) {
            pendingMoves.getLast().completion().completeExceptionally(failure);
        }

        private static PartyTravelPositionsResult positions(
                features.party.api.PartyTravelLocationSnapshot location,
                long revision
        ) {
            return new PartyTravelPositionsResult(
                    ReadStatus.SUCCESS,
                    List.of(new PartyTravelPositionSnapshot(1L, true, location)),
                    location,
                    revision);
        }

        @Override public ActivePartyModel activeParty() { return activeParty; }
        @Override public PartyTravelPositionsModel travelPositions() { return travelPositions; }
        @Override public CompletionStage<PartyPlanningFactsResponse> loadPlanningFacts(PartyPlanningFactsQuery query) {
            throw new UnsupportedOperationException();
        }
        @Override public PartySnapshotModel snapshot() { throw new UnsupportedOperationException(); }
        @Override public ActivePartyCompositionModel activeComposition() { throw new UnsupportedOperationException(); }
        @Override public AdventuringDaySummaryModel adventuringDaySummary() { throw new UnsupportedOperationException(); }
        @Override public PartyMutationModel mutation() { throw new UnsupportedOperationException(); }
        @Override public AdventuringDayCalculationModel adventuringDayCalculation() {
            throw new UnsupportedOperationException();
        }
        @Override public void createCharacter(CreateCharacterCommand command) { throw new UnsupportedOperationException(); }
        @Override public void updateCharacter(UpdateCharacterCommand command) { throw new UnsupportedOperationException(); }
        @Override public void deleteCharacter(DeleteCharacterCommand command) { throw new UnsupportedOperationException(); }
        @Override public void setMembership(SetPartyMembershipCommand command) { throw new UnsupportedOperationException(); }
        @Override public void awardXp(AwardPartyXpCommand command) { throw new UnsupportedOperationException(); }
        @Override public void adjustXp(AdjustPartyXpCommand command) { throw new UnsupportedOperationException(); }
        @Override public void performRest(PerformPartyRestCommand command) { throw new UnsupportedOperationException(); }
        @Override public void calculateAdventuringDay(CalculateAdventuringDayCommand command) {
            throw new UnsupportedOperationException();
        }

        private record PendingMove(
                MovePartyCharactersCommand command,
                CompletableFuture<MutationResult> completion
        ) {
        }
    }
}
