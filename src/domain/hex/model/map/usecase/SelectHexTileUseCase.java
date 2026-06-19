package src.domain.hex.model.map.usecase;

import java.util.Objects;
import java.util.Optional;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.model.map.HexEditorMode;
import src.domain.hex.model.map.HexMap;
import src.domain.hex.model.map.HexMapIdentity;
import src.domain.hex.model.map.repository.HexMapRepository;

public final class SelectHexTileUseCase {

    private final HexMapRepository repository;
    private final LoadHexEditorStateUseCase loadEditorStateUseCase;

    public SelectHexTileUseCase(
            HexMapRepository repository,
            LoadHexEditorStateUseCase loadEditorStateUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadEditorStateUseCase = Objects.requireNonNull(
                loadEditorStateUseCase,
                "loadEditorStateUseCase");
    }

    public void execute(long mapIdValue, int q, int r) {
        try {
            HexMapIdentity mapId = new HexMapIdentity(mapIdValue);
            HexCoordinate coordinate = new HexCoordinate(q, r);
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
            HexMap map = loaded.get();
            map.requireInside(coordinate);
            loadEditorStateUseCase.publishLoadedWithActiveTool(
                    Optional.of(map),
                    Optional.of(coordinate),
                    "Hex tile selected.",
                    HexEditorMode.defaultMode(),
                    loadEditorStateUseCase.currentState().activeTerrain());
        } catch (IllegalArgumentException | IllegalStateException exception) {
            loadEditorStateUseCase.publishFailure(exception.getMessage());
        }
    }
}
