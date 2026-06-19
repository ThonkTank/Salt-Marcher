package src.domain.hex.model.map.usecase;

import java.util.Objects;
import java.util.Optional;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.model.map.HexEditorMode;
import src.domain.hex.model.map.HexMap;
import src.domain.hex.model.map.HexMapIdentity;
import src.domain.hex.model.map.HexMarker;
import src.domain.hex.model.map.HexMarkerIdentity;
import src.domain.hex.model.map.HexMarkerKind;
import src.domain.hex.model.map.repository.HexMapRepository;

public final class SaveHexMarkerUseCase {

    private final HexMapRepository repository;
    private final LoadHexEditorStateUseCase loadEditorStateUseCase;

    public SaveHexMarkerUseCase(
            HexMapRepository repository,
            LoadHexEditorStateUseCase loadEditorStateUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadEditorStateUseCase = Objects.requireNonNull(
                loadEditorStateUseCase,
                "loadEditorStateUseCase");
    }

    public void execute(
            long mapIdValue,
            long markerIdValue,
            int q,
            int r,
            String name,
            String typeName,
            String note
    ) {
        try {
            HexMapIdentity mapId = new HexMapIdentity(mapIdValue);
            HexMarkerIdentity markerId = markerIdValue <= 0L ? null : new HexMarkerIdentity(markerIdValue);
            HexCoordinate coordinate = new HexCoordinate(q, r);
            HexMarkerKind type = markerType(typeName);
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
            HexMarkerIdentity resolvedMarkerId = markerId == null
                    ? new HexMarkerIdentity(repository.nextMarkerId(mapId))
                    : markerId;
            HexMarker marker = new HexMarker(
                    resolvedMarkerId,
                    coordinate,
                    name,
                    type,
                    note);
            HexMap markerMap = loaded.get().saveMarker(resolvedMarkerId, coordinate, name, type, note);
            HexMap savedMap = repository.saveMarker(markerMap.mapId(), marker);
            loadEditorStateUseCase.publishLoadedWithActiveTool(
                    Optional.of(savedMap),
                    Optional.of(coordinate),
                    "Hex marker saved.",
                    HexEditorMode.PLACE_MARKER,
                    loadEditorStateUseCase.currentState().activeTerrain());
        } catch (IllegalArgumentException | IllegalStateException exception) {
            loadEditorStateUseCase.publishFailure(exception.getMessage());
        }
    }

    private static HexMarkerKind markerType(String typeName) {
        return typeName == null || typeName.isBlank() ? null : HexMarkerKind.valueOf(typeName);
    }
}
