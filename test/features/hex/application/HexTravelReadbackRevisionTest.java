package features.hex.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.hex.api.HexTravelModel;
import features.hex.api.HexTravelSnapshot;
import features.hex.domain.map.HexCoordinate;
import features.hex.domain.map.HexMap;
import features.hex.domain.map.HexMapIdentity;
import features.hex.domain.map.HexMapSummary;
import features.hex.domain.map.HexMarker;
import features.hex.domain.map.HexTerrain;
import features.hex.domain.map.repository.HexMapRepository;
import features.party.api.PartyApi;
import features.party.api.PartyOverworldTravelLocationSnapshot;
import features.party.api.PartyTravelPositionsResult;
import features.party.api.ReadStatus;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.ui.DirectUiDispatcher;

final class HexTravelReadbackRevisionTest {

    @Test
    void activeReadbackCarriesExactPartyRevisionAndMonotonicHexRevision() {
        TravelHarness harness = harness(new TravelRepository());
        List<HexTravelSnapshot> updates = new ArrayList<>();
        harness.model().subscribe(updates::add);

        harness.service().acceptPartyTravelPosition(successAt(11L, 2, -1));

        HexTravelSnapshot active = harness.model().current();
        assertTrue(active.active());
        assertEquals(1L, active.sourceRevision());
        assertEquals(11L, active.partyPositionRevision());
        assertEquals(7L, active.mapId());
        assertEquals(2, active.q());
        assertEquals(-1, active.r());
        assertEquals("Westmark 2,-1", active.locationText());
        assertEquals(List.of(41L, 42L), active.partyTokenCharacterIds());
        assertEquals(List.of(active), updates);

        harness.service().acceptPartyTravelPosition(new PartyTravelPositionsResult(
                ReadStatus.SUCCESS, List.of(), null, List.of(), 12L));

        HexTravelSnapshot inactive = harness.model().current();
        assertFalse(inactive.active());
        assertEquals(2L, inactive.sourceRevision());
        assertEquals(12L, inactive.partyPositionRevision());
        assertEquals(0L, inactive.mapId());
        assertEquals(2, updates.size());
    }

    @Test
    void duplicateAndOlderPartyRevisionsNeitherProjectNorPublish() {
        TravelRepository repository = new TravelRepository();
        TravelHarness harness = harness(repository);
        List<HexTravelSnapshot> updates = new ArrayList<>();
        harness.model().subscribe(updates::add);

        harness.service().acceptPartyTravelPosition(successAt(8L, 0, 0));
        harness.service().acceptPartyTravelPosition(successAt(8L, 1, 0));
        harness.service().acceptPartyTravelPosition(successAt(7L, -1, 0));

        HexTravelSnapshot current = harness.model().current();
        assertEquals(1L, current.sourceRevision());
        assertEquals(8L, current.partyPositionRevision());
        assertEquals(0, current.q());
        assertEquals(0, current.r());
        assertEquals(1, repository.summaryReads);
        assertEquals(1, updates.size());
    }

    @Test
    void inactiveAndRepositoryFailurePreserveTheAcceptedPartyRevision() {
        TravelRepository repository = new TravelRepository();
        TravelHarness harness = harness(repository);

        harness.service().acceptPartyTravelPosition(new PartyTravelPositionsResult(
                ReadStatus.STORAGE_ERROR, List.of(), null, List.of(), 20L));

        HexTravelSnapshot storageReadFailure = harness.model().current();
        assertFalse(storageReadFailure.active());
        assertEquals(1L, storageReadFailure.sourceRevision());
        assertEquals(20L, storageReadFailure.partyPositionRevision());
        assertEquals(0L, storageReadFailure.mapId());

        repository.failure = new IllegalStateException("unavailable");
        harness.service().acceptPartyTravelPosition(successAt(21L, 0, 0));

        HexTravelSnapshot repositoryFailure = harness.model().current();
        assertFalse(repositoryFailure.active());
        assertEquals(2L, repositoryFailure.sourceRevision());
        assertEquals(21L, repositoryFailure.partyPositionRevision());
        assertEquals(0L, repositoryFailure.mapId());
        assertEquals("Hex-Reise konnte nicht geladen werden.", repositoryFailure.statusText());
    }

    private static PartyTravelPositionsResult successAt(long revision, int q, int r) {
        return new PartyTravelPositionsResult(
                ReadStatus.SUCCESS,
                List.of(),
                new PartyOverworldTravelLocationSnapshot(7L, new HexCoordinate(q, r).stableTileId()),
                List.of(41L, 42L),
                revision);
    }

    private static TravelHarness harness(TravelRepository repository) {
        HexTravelPublishedState publishedState = new HexTravelPublishedState(DirectUiDispatcher.INSTANCE);
        return new TravelHarness(
                new HexTravelApplicationService(
                        repository,
                        unusedParty(),
                        publishedState,
                        DirectExecutionLane.INSTANCE,
                        NoopDiagnostics.INSTANCE),
                publishedState.model());
    }

    private static PartyApi unusedParty() {
        return (PartyApi) Proxy.newProxyInstance(
                PartyApi.class.getClassLoader(),
                new Class<?>[]{PartyApi.class},
                (proxy, method, arguments) -> {
                    throw new AssertionError("Unexpected Party API call: " + method.getName());
                });
    }

    private record TravelHarness(HexTravelApplicationService service, HexTravelModel model) {
    }

    private static final class TravelRepository implements HexMapRepository {
        private final HexMap map = HexMap.create(new HexMapIdentity(7L), "Westmark", 3);
        private int summaryReads;
        private IllegalStateException failure;

        @Override
        public Optional<HexMap> loadSelected() {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<HexMap> loadById(HexMapIdentity mapId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<HexMapSummary> loadSummaryById(HexMapIdentity mapId) {
            summaryReads++;
            if (failure != null) {
                throw failure;
            }
            return map.mapId().equals(mapId)
                    ? Optional.of(new HexMapSummary(map.mapId(), map.displayName(), map.radius()))
                    : Optional.empty();
        }

        @Override
        public List<HexMapSummary> listMaps() {
            throw new UnsupportedOperationException();
        }

        @Override
        public HexMap save(HexMap map) {
            throw new UnsupportedOperationException();
        }

        @Override
        public HexMap saveTerrain(HexMapIdentity mapId, HexCoordinate coordinate, HexTerrain terrain) {
            throw new UnsupportedOperationException();
        }

        @Override
        public HexMap saveMarker(HexMapIdentity mapId, HexMarker marker) {
            throw new UnsupportedOperationException();
        }

        @Override
        public long nextMapId() {
            throw new UnsupportedOperationException();
        }

        @Override
        public long nextMarkerId(HexMapIdentity mapId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void setSelectedMap(HexMapIdentity mapId) {
            throw new UnsupportedOperationException();
        }
    }
}
