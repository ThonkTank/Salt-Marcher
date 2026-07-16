package features.hex.domain.map.repository;

import java.util.List;
import java.util.Optional;
import features.hex.domain.map.HexMap;
import features.hex.domain.map.HexMapIdentity;
import features.hex.domain.map.HexMapSummary;
import features.hex.domain.map.HexMarker;
import features.hex.domain.map.HexCoordinate;
import features.hex.domain.map.HexTerrain;

public interface HexMapRepository {

    Optional<HexMap> loadSelected();

    Optional<HexMap> loadById(HexMapIdentity mapId);

    Optional<HexMapSummary> loadSummaryById(HexMapIdentity mapId);

    List<HexMapSummary> listMaps();

    HexMap save(HexMap map);

    HexMap saveTerrain(HexMapIdentity mapId, HexCoordinate coordinate, HexTerrain terrain);

    HexMap saveMarker(HexMapIdentity mapId, HexMarker marker);

    long nextMapId();

    long nextMarkerId(HexMapIdentity mapId);

    void setSelectedMap(HexMapIdentity mapId);
}
