package src.domain.hex.model.map.usecase;

import java.util.Objects;
import java.util.Optional;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.model.map.HexEditorMode;
import src.domain.hex.model.map.HexMap;
import src.domain.hex.model.map.HexMapIdentity;
import src.domain.hex.model.map.HexTerrain;
import src.domain.hex.model.map.repository.HexMapRepository;

public final class PaintHexTerrainUseCase {

    private final HexMapRepository repository;
    private final LoadHexEditorStateUseCase loadEditorStateUseCase;

    public PaintHexTerrainUseCase(
            HexMapRepository repository,
            LoadHexEditorStateUseCase loadEditorStateUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadEditorStateUseCase = Objects.requireNonNull(
                loadEditorStateUseCase,
                "loadEditorStateUseCase");
    }

    public void execute(long mapIdValue, int q, int r, String terrainName) {
        try {
            HexMapIdentity mapId = new HexMapIdentity(mapIdValue);
            HexCoordinate coordinate = new HexCoordinate(q, r);
            HexTerrain terrain = terrain(terrainName);
            Optional<HexMap> loaded = repository.loadById(mapId);
            if (loaded.isEmpty()) {
                loadEditorStateUseCase.publishLoaded(
                        repository.loadSelected(),
                        Optional.empty(),
                        "",
                        "Hex map not found.",
                        "");
                return;
            }
            HexMap paintedMap = loaded.get().paintTerrain(coordinate, terrain);
            HexMap savedMap = repository.saveTerrain(paintedMap.mapId(), coordinate, terrain);
            loadEditorStateUseCase.publishLoadedWithActiveTool(
                    Optional.of(savedMap),
                    Optional.of(coordinate),
                    "Hex terrain painted.",
                    HexEditorMode.PAINT_TERRAIN,
                    terrain);
        } catch (IllegalArgumentException | IllegalStateException exception) {
            loadEditorStateUseCase.publishFailure(exception.getMessage());
        }
    }

    private static HexTerrain terrain(String terrainName) {
        return terrainName == null || terrainName.isBlank()
                ? HexTerrain.defaultTerrain()
                : HexTerrain.valueOf(terrainName);
    }
}
