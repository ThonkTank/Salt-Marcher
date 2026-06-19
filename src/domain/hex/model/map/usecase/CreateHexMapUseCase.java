package src.domain.hex.model.map.usecase;

import java.util.Objects;
import java.util.Optional;
import src.domain.hex.model.map.HexMap;
import src.domain.hex.model.map.HexMapIdentity;
import src.domain.hex.model.map.repository.HexMapRepository;

public final class CreateHexMapUseCase {

    private final HexMapRepository repository;
    private final LoadHexEditorStateUseCase loadEditorStateUseCase;

    public CreateHexMapUseCase(
            HexMapRepository repository,
            LoadHexEditorStateUseCase loadEditorStateUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadEditorStateUseCase = Objects.requireNonNull(
                loadEditorStateUseCase,
                "loadEditorStateUseCase");
    }

    public void execute(String displayName, int radius) {
        try {
            HexMapIdentity mapId = new HexMapIdentity(repository.nextMapId());
            HexMap savedMap = repository.save(HexMap.create(mapId, displayName, radius));
            repository.setSelectedMap(savedMap.mapId());
            loadEditorStateUseCase.publishLoaded(
                    Optional.of(savedMap),
                    Optional.empty(),
                    "Hex map created.",
                    "",
                    "");
        } catch (IllegalArgumentException | IllegalStateException exception) {
            loadEditorStateUseCase.publishFailure(exception.getMessage());
        }
    }
}
