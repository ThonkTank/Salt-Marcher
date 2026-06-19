package src.domain.hex.model.map.repository;

import java.util.List;
import java.util.Optional;
import src.domain.hex.model.map.HexMap;
import src.domain.hex.model.map.HexMapIdentity;
import src.domain.hex.model.map.HexMapSummary;
import src.domain.hex.model.map.HexMarker;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.model.map.HexTerrain;

public interface HexMapRepository {

    Optional<HexMap> loadSelected();

    Optional<HexMap> loadById(HexMapIdentity mapId);

    List<HexMapSummary> listMaps();

    HexMap save(HexMap map);

    HexMap saveTerrain(HexMapIdentity mapId, HexCoordinate coordinate, HexTerrain terrain);

    HexMap saveMarker(HexMapIdentity mapId, HexMarker marker);

    long nextMapId();

    long nextMarkerId(HexMapIdentity mapId);

    void setSelectedMap(HexMapIdentity mapId);
}
