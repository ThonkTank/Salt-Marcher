package src.domain.hex.model.map.usecase;

import java.util.Objects;
import java.util.Optional;
import src.domain.hex.model.map.HexMap;
import src.domain.hex.model.map.HexMapIdentity;
import src.domain.hex.model.map.repository.HexMapRepository;

public final class SelectHexMapUseCase {

    private final HexMapRepository repository;
    private final LoadHexEditorStateUseCase loadEditorStateUseCase;

    public SelectHexMapUseCase(
            HexMapRepository repository,
            LoadHexEditorStateUseCase loadEditorStateUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadEditorStateUseCase = Objects.requireNonNull(
                loadEditorStateUseCase,
                "loadEditorStateUseCase");
    }

    public void execute(long mapIdValue) {
        try {
            HexMapIdentity mapId = new HexMapIdentity(mapIdValue);
            Optional<HexMap> selectedMap = repository.loadById(mapId);
            if (selectedMap.isEmpty()) {
                loadEditorStateUseCase.publishLoaded(
                        repository.loadSelected(),
                        Optional.empty(),
                        "",
                        "Hex map not found.",
                        "");
                return;
            }
            repository.setSelectedMap(mapId);
            loadEditorStateUseCase.publishLoaded(
                    selectedMap,
                    Optional.empty(),
                    "Hex map selected.",
                    "",
                    "");
        } catch (IllegalArgumentException | IllegalStateException exception) {
            loadEditorStateUseCase.publishFailure(exception.getMessage());
        }
    }
}
