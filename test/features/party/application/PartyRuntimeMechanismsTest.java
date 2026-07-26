package features.party.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.party.PartyServiceAssembly;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletionStage;
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
import features.party.api.AwardPartyXpCommand;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.party.api.MovePartyCharactersCommand;
import features.party.api.MutationResult;
import features.party.api.MutationStatus;
import features.party.api.PartyOverworldTravelLocationSnapshot;
import features.party.api.PartyTravelPositionsResult;
import features.party.api.ReadStatus;
import features.party.api.SetPartyMembershipCommand;
import features.party.api.UpdateCharacterCommand;

final class PartyRuntimeMechanismsTest {

    @Test
    void rosterEditsPreserveEarnedXpAndOnlyRaiseAnInsufficientLevelFloor() {
        RecordingLane lane = new RecordingLane();
        RecordingRepository repository = new RecordingRepository();
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                repository, lane, lane, update -> update.run(), new RecordingDiagnostics());
        lane.runNext();

        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Aria", "Mira", 3, 14, 16)));
        lane.runNext();
        party.application().awardXp(new AwardPartyXpCommand(List.of(1L), 1_800));
        lane.runNext();

        party.application().updateCharacter(new UpdateCharacterCommand(
                1L, new CharacterDraft("Aria Prime", "Mira", 3, 15, 17)));
        lane.runNext();
        var unchangedLevel = repository.roster.characters().getFirst().progress();
        assertEquals(2_700, unchangedLevel.currentXp());
        assertEquals(1_800, unchangedLevel.xpSinceLongRest());
        assertEquals(1_800, unchangedLevel.xpSinceShortRest());

        party.application().updateCharacter(new UpdateCharacterCommand(
                1L, new CharacterDraft("Aria Prime", "Mira", 2, 15, 17)));
        lane.runNext();
        assertEquals(2_700, repository.roster.characters().getFirst().progress().currentXp(),
                "lowering an authored level cannot discard earned XP");

        party.application().updateCharacter(new UpdateCharacterCommand(
                1L, new CharacterDraft("Aria Prime", "Mira", null, 15, 17)));
        lane.runNext();
        assertEquals(2_700, repository.roster.characters().getFirst().progress().currentXp(),
                "clearing an optional level cannot discard earned XP");

        party.application().updateCharacter(new UpdateCharacterCommand(
                1L, new CharacterDraft("Aria Prime", "Mira", 5, 15, 17)));
        lane.runNext();
        assertEquals(6_500, repository.roster.characters().getFirst().progress().currentXp(),
                "raising a level establishes its minimum without an upper cap");
    }

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
        assertEquals(1L, party.travelPositions().current().revision());
        assertEquals(List.of("party.storage-failure"), diagnostics.ids);
        assertEquals(List.of(IllegalStateException.class), diagnostics.failureTypes);

        repository.failLoads = false;
        ((PartyApplicationService) party.application()).refreshPublishedState();
        lane.runNext();

        assertEquals(ReadStatus.SUCCESS, party.travelPositions().current().status());
        assertEquals(2L, party.travelPositions().current().revision(),
                "a successful publication follows the failed publication monotonically");
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
                new CharacterDraft("Aria", "Mira", 3, 14, 16)));

        assertEquals(1, lane.pending(), "persistence-backed command enters the lane");
        assertEquals(1, repository.loads, "repository is untouched before lane execution");
        lane.runNext();

        assertEquals(2, repository.loads, "mutation reads one roster revision");
        assertEquals(1, repository.saves);
        assertEquals(0, party.snapshot().current().snapshot().summary().activeCount());
        assertEquals(1, party.snapshot().current().snapshot().summary().reserveCount());
        assertEquals(List.of(), party.activeComposition().current().composition().activePartyLevels());
        assertTrue(observedActiveCounts.isEmpty(), "callback waits for the UI dispatcher");
        dispatcher.runAll();
        assertEquals(List.of(0), observedActiveCounts);
        assertTrue(diagnostics.ids.isEmpty());
    }

    @Test
    void nameOnlyCreationIsRosterOnlyAndNeverInventsActivePartyTruth() {
        RecordingLane lane = new RecordingLane();
        RecordingRepository repository = new RecordingRepository();
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                repository, lane, lane, update -> update.run(), new RecordingDiagnostics());
        lane.runNext();

        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Aria", null, null, null, null)));
        lane.runNext();

        assertEquals(1, repository.saves, "name is the only universally required authored fact");
        assertEquals(0, party.snapshot().current().snapshot().summary().activeCount(),
                "creation must never imply current-Party membership");
        assertEquals(1, party.snapshot().current().snapshot().summary().reserveCount());
        assertFalse(repository.roster.characters().getFirst().travel().attachedToPartyToken(),
                "a newly rostered character is detached from Party travel");
        var published = party.snapshot().current().snapshot().reserveMembers().getFirst();
        assertNull(published.playerName());
        assertNull(published.level());
        assertNull(published.passivePerception());
        assertNull(published.armorClass());
    }

    @Test
    void namesakesRemainDistinctAndEditingOneCanClearEveryOptionalFact() {
        RecordingLane lane = new RecordingLane();
        RecordingRepository repository = new RecordingRepository();
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                repository, lane, lane, update -> update.run(), new RecordingDiagnostics());
        lane.runNext();

        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Aria", "First", 3, 14, 16)));
        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Aria", "Second", 7, 15, 18)));
        lane.runNext();
        lane.runNext();
        party.application().updateCharacter(new UpdateCharacterCommand(
                2L, new CharacterDraft("Aria", null, null, null, null)));
        lane.runNext();

        var first = repository.roster.characters().getFirst();
        var second = repository.roster.characters().get(1);
        assertEquals(1L, first.id());
        assertEquals("First", first.identity().playerName());
        assertEquals(Integer.valueOf(3), first.progress().level());
        assertEquals(2L, second.id());
        assertNull(second.identity().playerName());
        assertNull(second.progress().level());
        assertNull(second.combat().passivePerception());
        assertNull(second.combat().armorClass());
    }

    @Test
    void activeCharacterWithoutLevelBlocksDerivedCompositionInsteadOfInventingOne() {
        RecordingLane lane = new RecordingLane();
        RecordingRepository repository = new RecordingRepository();
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                repository, lane, lane, update -> update.run(), new RecordingDiagnostics());
        lane.runNext();
        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Aria", null, null, null, null)));
        lane.runNext();

        party.application().setMembership(new SetPartyMembershipCommand(1L, MembershipState.ACTIVE));
        lane.runNext();

        assertEquals(1, party.snapshot().current().snapshot().summary().activeCount());
        assertNull(party.snapshot().current().snapshot().summary().averageLevel());
        assertNull(party.activeParty().current().members().getFirst().level());
        assertEquals(List.of(), party.activeComposition().current().composition().activePartyLevels());
        assertNull(party.activeComposition().current().composition().averageLevel());
        assertEquals(List.of(), party.adventuringDaySummary().current().summary().activePartyLevels());
        assertEquals(0, party.adventuringDaySummary().current().summary().totalBudgetXp());
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
                new CharacterDraft("Aria", "Mira", 3, 14, 16)));
        lane.runNext();

        assertEquals(List.of("party.storage-failure"), diagnostics.ids);
        assertEquals(List.of(IllegalStateException.class), diagnostics.failureTypes);
        assertEquals(MutationStatus.STORAGE_ERROR, party.mutation().current().status());
    }

    @Test
    void committedRosterPublishesEveryModelWhenOnePublicationCallbackFails() {
        RecordingLane lane = new RecordingLane();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        RecordingRepository repository = new RecordingRepository();
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                repository, lane, lane, Runnable::run, diagnostics);
        lane.runNext();
        List<Long> observedFactsRevisions = new ArrayList<>();
        party.activePartyFacts().subscribe(ignored -> {
            throw new IllegalStateException("synthetic publication callback failure");
        });
        party.activePartyFacts().subscribe(result -> observedFactsRevisions.add(result.facts().revision()));

        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Aria", null, null, null, null)));
        lane.runNext();

        assertEquals(1, repository.saves, "the successful durable write remains committed");
        assertEquals("Aria", repository.roster.characters().getFirst().identity().name());
        assertEquals(MutationStatus.SUCCESS, party.mutation().current().status(),
                "a callback failure cannot turn a committed mutation into a storage failure");
        assertEquals(1, party.snapshot().current().snapshot().summary().reserveCount());
        assertEquals(List.of(), party.activeParty().current().members());
        assertEquals(List.of(), party.activeComposition().current().composition().activePartyLevels());
        assertEquals(ReadStatus.SUCCESS, party.adventuringDaySummary().current().status());
        assertEquals(2L, party.travelPositions().current().revision());
        assertEquals(2L, party.activePartyFacts().current().facts().revision());
        assertEquals(List.of(2L), observedFactsRevisions,
                "one failing observer cannot suppress later observers of the committed revision");
        assertEquals(List.of("party.publication-callback-failure"), diagnostics.ids);
        assertEquals(List.of(IllegalStateException.class), diagnostics.failureTypes);
    }

    @Test
    void queuedMovePublishesPositionAndHigherRevisionBeforeItsCompletion() {
        RecordingLane lane = new RecordingLane();
        RecordingRepository repository = new RecordingRepository();
        repository.seedOverworldTravel();
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                repository, lane, lane, update -> update.run(), new RecordingDiagnostics());
        lane.runNext();
        PartyTravelPositionsResult before = party.travelPositions().current();
        List<MutationStatus> statusAtCompletion = new ArrayList<>();
        List<Long> revisionAtCompletion = new ArrayList<>();
        List<Long> tileAtCompletion = new ArrayList<>();

        CompletionStage<MutationResult> move = party.application().moveCharacters(new MovePartyCharactersCommand(
                List.of(1L),
                new PartyOverworldTravelLocationSnapshot(7L, 84L),
                true));
        move.thenAccept(result -> {
            PartyTravelPositionsResult published = party.travelPositions().current();
            statusAtCompletion.add(result.status());
            revisionAtCompletion.add(published.revision());
            tileAtCompletion.add(((PartyOverworldTravelLocationSnapshot) published.partyTokenLocation()).tileId());
        });

        assertFalse(move.toCompletableFuture().isDone(), "queued move remains open before lane execution");
        assertEquals(before, party.travelPositions().current(), "queued move does not publish early");
        lane.runNext();

        assertEquals(MutationStatus.SUCCESS, move.toCompletableFuture().join().status());
        assertEquals(List.of(MutationStatus.SUCCESS), statusAtCompletion);
        assertEquals(List.of(before.revision() + 1L), revisionAtCompletion);
        assertEquals(List.of(84L), tileAtCompletion);
        assertEquals(1, repository.saves);
    }

    @Test
    void rejectedMoveCompletesWithItsOwnResultWithoutPublishingFalseRevision() {
        RecordingLane lane = new RecordingLane();
        RecordingRepository repository = new RecordingRepository();
        repository.seedOverworldTravel();
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                repository, lane, lane, update -> update.run(), new RecordingDiagnostics());
        lane.runNext();
        PartyTravelPositionsResult before = party.travelPositions().current();

        CompletionStage<MutationResult> move = party.application().moveCharacters(new MovePartyCharactersCommand(
                List.of(999L),
                new PartyOverworldTravelLocationSnapshot(7L, 84L),
                true));

        assertFalse(move.toCompletableFuture().isDone());
        lane.runNext();

        assertEquals(MutationStatus.NOT_FOUND, move.toCompletableFuture().join().status());
        assertEquals(before, party.travelPositions().current());
        assertEquals(0, repository.saves);
    }

    @Test
    void failedMoveSaveCompletesWithStorageErrorWithoutPublishingFalseRevision() {
        RecordingLane lane = new RecordingLane();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        RecordingRepository repository = new RecordingRepository();
        repository.seedOverworldTravel();
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                repository, lane, lane, update -> update.run(), diagnostics);
        lane.runNext();
        PartyTravelPositionsResult before = party.travelPositions().current();
        repository.failSaves = true;

        CompletionStage<MutationResult> move = party.application().moveCharacters(new MovePartyCharactersCommand(
                List.of(1L),
                new PartyOverworldTravelLocationSnapshot(7L, 84L),
                true));

        assertFalse(move.toCompletableFuture().isDone());
        lane.runNext();

        assertEquals(MutationStatus.STORAGE_ERROR, move.toCompletableFuture().join().status());
        assertEquals(before, party.travelPositions().current());
        assertEquals(MutationStatus.STORAGE_ERROR, party.mutation().current().status());
        assertEquals(List.of("party.storage-failure"), diagnostics.ids);
    }

    private static final class RecordingRepository implements PartyRosterRepository {

        private PartyRoster roster = new PartyRoster(1L, List.of());
        private int loads;
        private int saves;
        private boolean failLoads;
        private boolean failSaves;

        void seedOverworldTravel() {
            roster = roster.createCharacter(
                    new PartyCharacterDraft("Aria", "Mira", 3, 14, 16)).roster();
            roster = roster.setMembership(1L, PartyMembership.ACTIVE).roster();
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
            if (failSaves) {
                throw new IllegalStateException("user-authored roster payload must not enter diagnostics");
            }
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
