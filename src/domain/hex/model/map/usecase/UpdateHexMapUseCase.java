package src.domain.hex.model.map.usecase;

import java.util.Objects;
import java.util.Optional;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.model.map.HexMap;
import src.domain.hex.model.map.HexMapIdentity;
import src.domain.hex.model.map.repository.HexMapRepository;

public final class UpdateHexMapUseCase {

    private final HexMapRepository repository;
    private final LoadHexEditorStateUseCase loadEditorStateUseCase;

    public UpdateHexMapUseCase(
            HexMapRepository repository,
            LoadHexEditorStateUseCase loadEditorStateUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadEditorStateUseCase = Objects.requireNonNull(
                loadEditorStateUseCase,
                "loadEditorStateUseCase");
    }

    public void execute(long mapIdValue, String displayName, int radius, boolean confirmDestructiveShrink) {
        try {
            HexMapIdentity mapId = new HexMapIdentity(mapIdValue);
            Optional<HexMap> loaded = repository.loadById(mapId);
            if (loaded.isEmpty()) {
                publishMissingMap();
                return;
            }
            HexMap map = loaded.get();
            Optional<HexCoordinate> selectedTile = loadEditorStateUseCase.currentState().selectedTile();
            if (map.wouldRemoveAuthoredData(radius) && !confirmDestructiveShrink) {
                loadEditorStateUseCase.publishLoaded(
                        Optional.of(map),
                        selectedTile,
                        "",
                        "",
                        "Radius shrink would remove authored Hex tile data.");
                return;
            }
            HexMap savedMap = repository.save(map.updateMetadata(displayName, radius));
            repository.setSelectedMap(savedMap.mapId());
            loadEditorStateUseCase.publishLoaded(
                    Optional.of(savedMap),
                    selectedTile,
                    "Hex map updated.",
                    "",
                    "");
        } catch (IllegalArgumentException | IllegalStateException exception) {
            loadEditorStateUseCase.publishFailure(exception.getMessage());
        }
    }

    private void publishMissingMap() {
        loadEditorStateUseCase.publishLoaded(
                repository.loadSelected(),
                Optional.empty(),
                "",
                "Hex map not found.",
                "");
    }
}
