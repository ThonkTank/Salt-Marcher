package features.hex.adapter.sqlite.repository;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import platform.persistence.SqliteDatabase;
import features.hex.adapter.sqlite.gateway.local.SqliteHexMapLocalGateway;
import features.hex.adapter.sqlite.mapper.HexMapMapper;
import features.hex.domain.map.HexMap;
import features.hex.domain.map.HexMapIdentity;
import features.hex.domain.map.HexMapSummary;
import features.hex.domain.map.HexMarker;
import features.hex.domain.map.HexCoordinate;
import features.hex.domain.map.HexTerrain;
import features.hex.domain.map.repository.HexMapRepository;

public final class SqliteHexMapRepository implements HexMapRepository {

    private static final String MAP_ID_ARGUMENT = "mapId";

    private final SqliteHexMapLocalGateway gateway;

    public SqliteHexMapRepository() {
        this(new SqliteHexMapLocalGateway());
    }

    public SqliteHexMapRepository(SqliteDatabase database) {
        this(new SqliteHexMapLocalGateway(database));
    }

    SqliteHexMapRepository(SqliteHexMapLocalGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public Optional<HexMap> loadSelected() {
        return gateway.loadSelected().map(HexMapMapper::toDomain);
    }

    @Override
    public Optional<HexMap> loadById(HexMapIdentity mapId) {
        Objects.requireNonNull(mapId, MAP_ID_ARGUMENT);
        return gateway.loadById(mapId.value()).map(HexMapMapper::toDomain);
    }

    @Override
    public Optional<HexMapSummary> loadSummaryById(HexMapIdentity mapId) {
        Objects.requireNonNull(mapId, MAP_ID_ARGUMENT);
        return gateway.loadSummaryById(mapId.value()).map(HexMapMapper::toSummary);
    }

    @Override
    public List<HexMapSummary> listMaps() {
        return gateway.listMaps().stream()
                .map(HexMapMapper::toSummary)
                .toList();
    }

    @Override
    public HexMap save(HexMap map) {
        Objects.requireNonNull(map, "map");
        return HexMapMapper.toDomain(gateway.save(HexMapMapper.toSnapshot(map)));
    }

    @Override
    public HexMap saveTerrain(HexMapIdentity mapId, HexCoordinate coordinate, HexTerrain terrain) {
        Objects.requireNonNull(mapId, MAP_ID_ARGUMENT);
        Objects.requireNonNull(coordinate, "coordinate");
        Objects.requireNonNull(terrain, "terrain");
        return HexMapMapper.toDomain(gateway.saveTerrain(
                mapId.value(),
                coordinate.q(),
                coordinate.r(),
                terrain.name()));
    }

    @Override
    public HexMap saveMarker(HexMapIdentity mapId, HexMarker marker) {
        Objects.requireNonNull(mapId, MAP_ID_ARGUMENT);
        Objects.requireNonNull(marker, "marker");
        return HexMapMapper.toDomain(gateway.saveMarker(
                mapId.value(),
                HexMapMapper.toMarkerRecord(mapId, marker)));
    }

    @Override
    public long nextMapId() {
        return gateway.nextMapId();
    }

    @Override
    public long nextMarkerId(HexMapIdentity mapId) {
        Objects.requireNonNull(mapId, MAP_ID_ARGUMENT);
        return gateway.nextMarkerId(mapId.value());
    }

    @Override
    public void setSelectedMap(HexMapIdentity mapId) {
        Objects.requireNonNull(mapId, MAP_ID_ARGUMENT);
        gateway.setSelectedMap(mapId.value());
    }
}
