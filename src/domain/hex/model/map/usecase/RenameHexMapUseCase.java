package src.domain.hex.model.map.usecase;

import java.util.Objects;
import java.util.Optional;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.model.map.HexMap;
import src.domain.hex.model.map.HexMapIdentity;
import src.domain.hex.model.map.repository.HexMapRepository;

public final class RenameHexMapUseCase {

    private final HexMapRepository repository;
    private final LoadHexEditorStateUseCase loadEditorStateUseCase;

    public RenameHexMapUseCase(
            HexMapRepository repository,
            LoadHexEditorStateUseCase loadEditorStateUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadEditorStateUseCase = Objects.requireNonNull(
                loadEditorStateUseCase,
                "loadEditorStateUseCase");
    }

    public void execute(long mapIdValue, String displayName) {
        try {
            HexMapIdentity mapId = new HexMapIdentity(mapIdValue);
            Optional<HexMap> loaded = repository.loadById(mapId);
            if (loaded.isEmpty()) {
                publishMissingMap();
                return;
            }
            HexMap map = loaded.get();
            repository.save(map.updateMetadata(displayName, map.radius()));
            Optional<HexCoordinate> selectedTile = loadEditorStateUseCase.currentState().selectedTile();
            loadEditorStateUseCase.publishLoaded(
                    repository.loadSelected(),
                    selectedTile,
                    "Hex map renamed.",
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
