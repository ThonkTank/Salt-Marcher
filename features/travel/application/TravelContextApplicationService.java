package features.travel.application;

import features.dungeon.api.DungeonTravelContextModel;
import features.dungeon.api.DungeonTravelContextSnapshot;
import features.hex.api.HexTravelModel;
import features.hex.api.HexTravelSnapshot;
import features.party.api.PartyTravelLocationSnapshot;
import features.party.api.PartyTravelPositionsModel;
import features.party.api.PartyTravelPositionsResult;
import features.party.api.ReadStatus;
import features.travel.api.TravelContextApi;
import features.travel.api.TravelContextKind;
import features.travel.api.TravelContextModel;
import features.travel.api.TravelContextSnapshot;
import java.util.List;
import java.util.Objects;

public final class TravelContextApplicationService implements TravelContextApi {

    private final PartyTravelPositionsModel partyPositions;
    private final DungeonTravelContextModel dungeonContexts;
    private final HexTravelModel hexContexts;
    private final TravelContextPublishedState publishedState;
    private PartyTravelPositionsResult party = failedParty();
    private DungeonTravelContextSnapshot dungeon = DungeonTravelContextSnapshot.empty(0L, 0L);
    private HexTravelSnapshot hex = HexTravelSnapshot.empty(0L, "Kein Hex-Reisekontext");
    private long partyRevision = -1L;
    private long dungeonSourceRevision = -1L;
    private long hexSourceRevision = -1L;
    private boolean started;

    public TravelContextApplicationService(
            PartyTravelPositionsModel partyPositions,
            DungeonTravelContextModel dungeonContexts,
            HexTravelModel hexContexts,
            TravelContextPublishedState publishedState
    ) {
        this.partyPositions = Objects.requireNonNull(partyPositions, "partyPositions");
        this.dungeonContexts = Objects.requireNonNull(dungeonContexts, "dungeonContexts");
        this.hexContexts = Objects.requireNonNull(hexContexts, "hexContexts");
        this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
    }

    @Override
    public TravelContextModel context() {
        return publishedState.model();
    }

    public synchronized void start() {
        if (started) {
            return;
        }
        started = true;
        partyPositions.subscribe(this::acceptParty);
        dungeonContexts.subscribe(this::acceptDungeon);
        hexContexts.subscribe(this::acceptHex);
        acceptParty(partyPositions.current());
        acceptDungeon(dungeonContexts.current());
        acceptHex(hexContexts.current());
    }

    private synchronized void acceptParty(PartyTravelPositionsResult result) {
        PartyTravelPositionsResult safeResult = result == null ? failedParty() : result;
        if (safeResult.revision() <= partyRevision) {
            return;
        }
        partyRevision = safeResult.revision();
        party = safeResult;
        publishSelectedContext();
    }

    private synchronized void acceptDungeon(DungeonTravelContextSnapshot snapshot) {
        DungeonTravelContextSnapshot safeSnapshot = snapshot == null
                ? DungeonTravelContextSnapshot.empty(0L, 0L)
                : snapshot;
        if (safeSnapshot.sourceRevision() <= dungeonSourceRevision) {
            return;
        }
        dungeonSourceRevision = safeSnapshot.sourceRevision();
        dungeon = safeSnapshot;
        publishSelectedContext();
    }

    private synchronized void acceptHex(HexTravelSnapshot snapshot) {
        HexTravelSnapshot safeSnapshot = snapshot == null
                ? HexTravelSnapshot.empty(0L, "Kein Hex-Reisekontext")
                : snapshot;
        if (safeSnapshot.sourceRevision() <= hexSourceRevision) {
            return;
        }
        hexSourceRevision = safeSnapshot.sourceRevision();
        hex = safeSnapshot;
        publishSelectedContext();
    }

    private void publishSelectedContext() {
        publishedState.publishIfChanged(selectContext());
    }

    private TravelContextSnapshot selectContext() {
        PartyTravelLocationSnapshot location = party.partyTokenLocation();
        if (party.status() != ReadStatus.SUCCESS || location == null) {
            return TravelContextSnapshot.none(party.revision());
        }
        if (location.isDungeon() && matchesDungeon(location)) {
            return dungeonContext();
        }
        if (location.isOverworld() && matchesHex(location)) {
            return hexContext();
        }
        return TravelContextSnapshot.none(party.revision());
    }

    private boolean matchesDungeon(PartyTravelLocationSnapshot location) {
        return dungeon.active()
                && dungeon.partyPositionRevision() == party.revision()
                && dungeon.mapId() == location.mapId();
    }

    private boolean matchesHex(PartyTravelLocationSnapshot location) {
        return hex.active()
                && hex.partyPositionRevision() == party.revision()
                && hex.mapId() == location.mapId();
    }

    private TravelContextSnapshot dungeonContext() {
        return new TravelContextSnapshot(
                0L,
                dungeon.sourceRevision(),
                party.revision(),
                TravelContextKind.DUNGEON,
                dungeon.mapId(),
                dungeon.mapName(),
                dungeon.areaLabel(),
                dungeon.tileLabel(),
                dungeon.headingLabel(),
                dungeon.statusText(),
                dungeon.hintText(),
                "",
                "",
                "");
    }

    private TravelContextSnapshot hexContext() {
        return new TravelContextSnapshot(
                0L,
                hex.sourceRevision(),
                party.revision(),
                TravelContextKind.HEX,
                hex.mapId(),
                hex.locationText(),
                "",
                hex.q() + "," + hex.r(),
                "",
                hex.statusText(),
                hex.hintText(),
                hex.weatherText(),
                hex.timeOfDayText(),
                hex.paceText());
    }

    private static PartyTravelPositionsResult failedParty() {
        return new PartyTravelPositionsResult(ReadStatus.STORAGE_ERROR, List.of(), null);
    }
}
