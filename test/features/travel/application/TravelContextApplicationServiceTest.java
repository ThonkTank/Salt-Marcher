package features.travel.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.dungeon.api.DungeonTravelContextModel;
import features.dungeon.api.DungeonTravelContextSnapshot;
import features.hex.api.HexTravelModel;
import features.hex.api.HexTravelSnapshot;
import features.party.api.PartyDungeonTravelLocationKind;
import features.party.api.PartyDungeonTravelLocationSnapshot;
import features.party.api.PartyOverworldTravelLocationSnapshot;
import features.party.api.PartyTravelHeading;
import features.party.api.PartyTravelPositionsModel;
import features.party.api.PartyTravelPositionsResult;
import features.party.api.PartyTravelTile;
import features.party.api.ReadStatus;
import features.travel.api.TravelContextKind;
import features.travel.api.TravelContextSnapshot;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;

final class TravelContextApplicationServiceTest {

    @Test
    void selectsOnlyExactRevisionAndLocationMatchesWithoutDuplicatePublication() {
        MutableSource<PartyTravelPositionsResult> parties = new MutableSource<>(partyNone(1L));
        MutableSource<DungeonTravelContextSnapshot> dungeons = new MutableSource<>(
                DungeonTravelContextSnapshot.empty(0L, 0L));
        MutableSource<HexTravelSnapshot> hexes = new MutableSource<>(
                HexTravelSnapshot.empty(0L, "Kein Hex-Reisekontext"));
        TravelContextPublishedState state = new TravelContextPublishedState(DirectUiDispatcher.INSTANCE);
        TravelContextApplicationService service = new TravelContextApplicationService(
                partyModel(parties), dungeonModel(dungeons), hexModel(hexes), state);
        List<TravelContextSnapshot> updates = new ArrayList<>();
        state.model().subscribe(updates::add);

        service.start();
        parties.publish(partyOverworld(2L, 9L));
        hexes.publish(activeHex(1L, 2L, 9L));
        hexes.publish(activeHex(1L, 2L, 9L));
        hexes.publish(activeHex(0L, 2L, 9L));
        parties.publish(partyDungeon(3L, 7L));
        dungeons.publish(activeDungeon(1L, 3L, 99L));
        dungeons.publish(activeDungeon(2L, 3L, 7L));
        dungeons.publish(activeDungeon(1L, 3L, 7L));
        parties.publish(partyNone(4L));

        assertEquals(
                List.of(
                        TravelContextKind.NONE,
                        TravelContextKind.NONE,
                        TravelContextKind.HEX,
                        TravelContextKind.NONE,
                        TravelContextKind.DUNGEON,
                        TravelContextKind.NONE),
                updates.stream().map(TravelContextSnapshot::kind).toList());
        assertEquals(List.of(1L, 2L, 3L, 4L, 5L, 6L),
                updates.stream().map(TravelContextSnapshot::publicationRevision).toList());
        assertEquals(2L, updates.get(2).partyPositionRevision());
        assertEquals(1L, updates.get(2).sourceRevision());
        assertEquals(3L, updates.get(4).partyPositionRevision());
        assertEquals(2L, updates.get(4).sourceRevision());
        assertEquals(4L, state.model().current().partyPositionRevision());
        assertEquals(TravelContextKind.NONE, state.model().current().kind());
    }

    @Test
    void newerPartyRevisionPublishesNoneUntilMatchingSourceArrives() {
        MutableSource<PartyTravelPositionsResult> parties = new MutableSource<>(partyOverworld(5L, 9L));
        MutableSource<DungeonTravelContextSnapshot> dungeons = new MutableSource<>(
                DungeonTravelContextSnapshot.empty(0L, 0L));
        MutableSource<HexTravelSnapshot> hexes = new MutableSource<>(activeHex(4L, 4L, 9L));
        TravelContextPublishedState state = new TravelContextPublishedState(DirectUiDispatcher.INSTANCE);
        TravelContextApplicationService service = new TravelContextApplicationService(
                partyModel(parties), dungeonModel(dungeons), hexModel(hexes), state);

        service.start();

        assertEquals(TravelContextKind.NONE, state.model().current().kind());
        assertEquals(5L, state.model().current().partyPositionRevision());

        hexes.publish(activeHex(5L, 5L, 9L));

        assertEquals(TravelContextKind.HEX, state.model().current().kind());
        assertEquals(5L, state.model().current().partyPositionRevision());
    }

    private static PartyTravelPositionsModel partyModel(MutableSource<PartyTravelPositionsResult> source) {
        return new PartyTravelPositionsModel(source::current, source::subscribe);
    }

    private static DungeonTravelContextModel dungeonModel(MutableSource<DungeonTravelContextSnapshot> source) {
        return new DungeonTravelContextModel(source::current, source::subscribe);
    }

    private static HexTravelModel hexModel(MutableSource<HexTravelSnapshot> source) {
        return new HexTravelModel(source::current, source::subscribe);
    }

    private static PartyTravelPositionsResult partyNone(long revision) {
        return new PartyTravelPositionsResult(ReadStatus.SUCCESS, List.of(), null, List.of(), revision);
    }

    private static PartyTravelPositionsResult partyOverworld(long revision, long mapId) {
        return new PartyTravelPositionsResult(
                ReadStatus.SUCCESS,
                List.of(),
                new PartyOverworldTravelLocationSnapshot(mapId, 33L),
                List.of(41L),
                revision);
    }

    private static PartyTravelPositionsResult partyDungeon(long revision, long mapId) {
        return new PartyTravelPositionsResult(
                ReadStatus.SUCCESS,
                List.of(),
                new PartyDungeonTravelLocationSnapshot(
                        mapId,
                        PartyDungeonTravelLocationKind.TILE,
                        0L,
                        new PartyTravelTile(2, 3, 0),
                        PartyTravelHeading.NORTH),
                List.of(41L),
                revision);
    }

    private static HexTravelSnapshot activeHex(long sourceRevision, long partyRevision, long mapId) {
        return new HexTravelSnapshot(
                sourceRevision,
                partyRevision,
                true,
                mapId,
                2,
                -1,
                "Westmark 2,-1",
                "Reisend",
                "nicht verfuegbar",
                "nicht verfuegbar",
                "Normal",
                "Reisegruppe auf der Hex-Karte bewegen",
                List.of(41L));
    }

    private static DungeonTravelContextSnapshot activeDungeon(
            long sourceRevision,
            long partyRevision,
            long mapId
    ) {
        return new DungeonTravelContextSnapshot(
                sourceRevision,
                partyRevision,
                true,
                mapId,
                12,
                "Tiefenhallen",
                "Nordkammer",
                "2,3 / Ebene 0",
                "Norden",
                "Bereit",
                "Dungeon-Reise im Reisearbeitsbereich steuern.");
    }

    private static final class MutableSource<T> {

        private final List<Consumer<T>> subscribers = new ArrayList<>();
        private T current;

        private MutableSource(T initial) {
            current = initial;
        }

        private T current() {
            return current;
        }

        private Runnable subscribe(Consumer<T> subscriber) {
            subscribers.add(subscriber);
            return () -> subscribers.remove(subscriber);
        }

        private void publish(T value) {
            current = value;
            List.copyOf(subscribers).forEach(subscriber -> subscriber.accept(value));
        }
    }
}
