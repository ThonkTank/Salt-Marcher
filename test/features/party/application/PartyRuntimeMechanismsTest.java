package features.party.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.party.PartyServiceAssembly;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.ui.UiDispatcher;
import features.party.domain.roster.PartyCharacterDraft;
import features.party.domain.roster.PartyMembership;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;
import features.party.domain.roster.PartyTravelLocation;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.party.api.MutationStatus;
import features.party.api.PartyOverworldTravelLocationSnapshot;
import features.party.api.PartyTravelPositionsResult;
import features.party.api.ReadStatus;

final class PartyRuntimeMechanismsTest {

    @Test
    void queuedInitializationPublishesPersistedRosterAndHexTravelToExistingSubscribers() {
        RecordingLane lane = new RecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        RecordingRepository repository = new RecordingRepository();
        repository.seedOverworldTravel();

        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                repository, lane, lane, dispatcher, new RecordingDiagnostics());
        List<Integer> observedActiveCounts = new ArrayList<>();
        List<PartyTravelPositionsResult> observedTravel = new ArrayList<>();
        party.snapshot().subscribe(result -> observedActiveCounts.add(
                result.snapshot().summary().activeCount()));
        party.travelPositions().subscribe(observedTravel::add);

        assertEquals(0, repository.loads);
        assertEquals(1, lane.pending());
        lane.runNext();

        assertEquals(1, repository.loads, "initial refresh reads the persisted roster once");
        assertEquals(1, party.snapshot().current().snapshot().summary().activeCount());
        PartyOverworldTravelLocationSnapshot currentLocation =
                (PartyOverworldTravelLocationSnapshot) party.travelPositions().current().partyTokenLocation();
        assertEquals(7L, currentLocation.mapId());
        assertEquals(42L, currentLocation.tileId());
        assertTrue(observedActiveCounts.isEmpty(), "initial roster delivery waits for the UI dispatcher");
        assertTrue(observedTravel.isEmpty(), "initial travel delivery waits for the UI dispatcher");

        dispatcher.runAll();

        assertEquals(List.of(1), observedActiveCounts);
        assertEquals(1, observedTravel.size());
        PartyOverworldTravelLocationSnapshot deliveredLocation =
                (PartyOverworldTravelLocationSnapshot) observedTravel.getFirst().partyTokenLocation();
        assertEquals(7L, deliveredLocation.mapId());
        assertEquals(42L, deliveredLocation.tileId());
    }

    @Test
    void queuedInitializationPublishesStorageFailureToExistingSubscribers() {
        RecordingLane lane = new RecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        RecordingRepository repository = new RecordingRepository();
        repository.failLoads = true;

        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                repository, lane, lane, dispatcher, diagnostics);
        List<ReadStatus> snapshotStatuses = new ArrayList<>();
        List<ReadStatus> travelStatuses = new ArrayList<>();
        party.snapshot().subscribe(result -> snapshotStatuses.add(result.status()));
        party.travelPositions().subscribe(result -> travelStatuses.add(result.status()));

        lane.runNext();
        assertTrue(snapshotStatuses.isEmpty(), "initial failure delivery waits for the UI dispatcher");
        assertTrue(travelStatuses.isEmpty(), "initial travel failure waits for the UI dispatcher");
        dispatcher.runAll();

        assertEquals(List.of(ReadStatus.STORAGE_ERROR), snapshotStatuses);
        assertEquals(List.of(ReadStatus.STORAGE_ERROR), travelStatuses);
        assertEquals(List.of("party.storage-failure"), diagnostics.ids);
        assertEquals(List.of(IllegalStateException.class), diagnostics.failureTypes);
    }

    @Test
    void partyUsesOneLaneReadAndDispatcherForOneCoherentRosterRevision() {
        RecordingLane lane = new RecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        RecordingRepository repository = new RecordingRepository();

        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                repository, lane, lane, dispatcher, diagnostics);

        assertEquals(0, repository.loads);
        assertEquals(1, lane.pending());
        lane.runNext();
        assertEquals(1, repository.loads, "initial refresh reads the roster once");

        List<Integer> observedActiveCounts = new ArrayList<>();
        party.snapshot().subscribe(result -> observedActiveCounts.add(
                result.snapshot().summary().activeCount()));
        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Aria", "Mira", 3, 14, 16),
                MembershipState.ACTIVE));

        assertEquals(1, lane.pending(), "persistence-backed command enters the lane");
        assertEquals(1, repository.loads, "repository is untouched before lane execution");
        lane.runNext();

        assertEquals(2, repository.loads, "mutation reads one roster revision");
        assertEquals(1, repository.saves);
        assertEquals(1, party.snapshot().current().snapshot().summary().activeCount());
        assertEquals(List.of(3), party.activeComposition().current().composition().activePartyLevels());
        assertTrue(observedActiveCounts.isEmpty(), "callback waits for the UI dispatcher");
        dispatcher.runAll();
        assertEquals(List.of(1), observedActiveCounts);
        assertTrue(diagnostics.ids.isEmpty());
    }

    @Test
    void partyReportsOnePayloadFreeDiagnosticForTerminalStorageFailure() {
        RecordingLane lane = new RecordingLane();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        RecordingRepository repository = new RecordingRepository();
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                repository, lane, lane, update -> update.run(), diagnostics);
        lane.runNext();
        repository.failLoads = true;

        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Aria", "Mira", 3, 14, 16),
                MembershipState.ACTIVE));
        lane.runNext();

        assertEquals(List.of("party.storage-failure"), diagnostics.ids);
        assertEquals(List.of(IllegalStateException.class), diagnostics.failureTypes);
        assertEquals(MutationStatus.STORAGE_ERROR, party.mutation().current().status());
    }

    private static final class RecordingRepository implements PartyRosterRepository {

        private PartyRoster roster = new PartyRoster(1L, List.of());
        private int loads;
        private int saves;
        private boolean failLoads;

        void seedOverworldTravel() {
            roster = roster.createCharacter(
                    new PartyCharacterDraft("Aria", "Mira", 3, 14, 16),
                    PartyMembership.ACTIVE).roster();
            roster = roster.moveCharacters(
                    List.of(1L),
                    PartyTravelLocation.overworld(7L, 42L),
                    true).roster();
        }

        @Override
        public PartyRoster load() {
            loads++;
            if (failLoads) {
                throw new IllegalStateException("user-authored roster payload must not enter diagnostics");
            }
            return roster;
        }

        @Override
        public void save(PartyRoster nextRoster) {
            saves++;
            roster = nextRoster;
        }
    }

    private static final class RecordingLane implements ExecutionLane {

        private final ArrayDeque<Runnable> work = new ArrayDeque<>();

        @Override
        public void execute(Runnable task) {
            work.addLast(task);
        }

        int pending() {
            return work.size();
        }

        void runNext() {
            work.removeFirst().run();
        }

        @Override
        public void close() {
            work.clear();
        }
    }

    private static final class RecordingDispatcher implements UiDispatcher {

        private final ArrayDeque<Runnable> updates = new ArrayDeque<>();

        @Override
        public void dispatch(Runnable update) {
            updates.addLast(update);
        }

        void runAll() {
            while (!updates.isEmpty()) {
                updates.removeFirst().run();
            }
        }
    }

    private static final class RecordingDiagnostics implements Diagnostics {

        private final List<String> ids = new ArrayList<>();
        private final List<Class<? extends Throwable>> failureTypes = new ArrayList<>();

        @Override
        public void failure(DiagnosticId id, Class<? extends Throwable> failureType) {
            ids.add(id.value());
            failureTypes.add(failureType);
        }
    }
}
