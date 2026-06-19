package src.domain.hex.model.map.usecase;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.model.map.HexEditorMode;
import src.domain.hex.model.map.HexEditorState;
import src.domain.hex.model.map.HexEditorWorkspace;
import src.domain.hex.model.map.HexMap;
import src.domain.hex.model.map.HexMapSummary;
import src.domain.hex.model.map.HexTerrain;
import src.domain.hex.model.map.repository.HexEditorPublishedStateRepository;
import src.domain.hex.model.map.repository.HexMapRepository;

public final class LoadHexEditorStateUseCase {

    private final HexMapRepository repository;
    private final HexEditorWorkspace workspace;
    private final HexEditorPublishedStateRepository publishedStateRepository;

    public LoadHexEditorStateUseCase(
            HexMapRepository repository,
            HexEditorWorkspace workspace,
            HexEditorPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.publishedStateRepository = Objects.requireNonNull(
                publishedStateRepository,
                "publishedStateRepository");
    }

    public HexEditorState execute() {
        try {
            return publishLoaded(repository.loadSelected(), workspace.state().selectedTile(), "", "", "");
        } catch (IllegalArgumentException | IllegalStateException exception) {
            return publish(workspace.state().withFailure(exception.getMessage()));
        }
    }

    HexEditorState publishLoaded(
            Optional<HexMap> selectedMap,
            Optional<HexCoordinate> selectedTile,
            String statusText,
            String failureText,
            String warningText
    ) {
        HexEditorState previous = workspace.state();
        Optional<HexMap> safeSelectedMap = selectedMap == null ? Optional.empty() : selectedMap;
        Optional<HexCoordinate> safeSelectedTile = validSelection(safeSelectedMap, selectedTile);
        HexEditorState nextState = new HexEditorState(
                listMaps(),
                safeSelectedMap,
                safeSelectedTile,
                previous.activeMode(),
                previous.activeTerrain(),
                statusText,
                failureText,
                warningText);
        return publish(nextState);
    }

    HexEditorState publishLoadedWithActiveTool(
            Optional<HexMap> selectedMap,
            Optional<HexCoordinate> selectedTile,
            String statusText,
            HexEditorMode activeMode,
            HexTerrain activeTerrain
    ) {
        HexEditorState previous = workspace.state();
        Optional<HexMap> safeSelectedMap = selectedMap == null ? Optional.empty() : selectedMap;
        Optional<HexCoordinate> safeSelectedTile = validSelection(safeSelectedMap, selectedTile);
        HexEditorState nextState = new HexEditorState(
                listMaps(),
                safeSelectedMap,
                safeSelectedTile,
                activeMode == null ? previous.activeMode() : activeMode,
                activeTerrain == null ? previous.activeTerrain() : activeTerrain,
                statusText,
                "",
                "");
        return publish(nextState);
    }

    HexEditorState publishFailure(String failureText) {
        try {
            return publishLoaded(repository.loadSelected(), workspace.state().selectedTile(), "", failureText, "");
        } catch (IllegalArgumentException | IllegalStateException exception) {
            return publish(workspace.state().withFailure(failureText));
        }
    }

    HexEditorState currentState() {
        return workspace.state();
    }

    HexEditorState publish(HexEditorState state) {
        HexEditorState nextState = workspace.replace(state);
        publishedStateRepository.publish(nextState);
        return nextState;
    }

    private List<HexMapSummary> listMaps() {
        return repository.listMaps();
    }

    private static Optional<HexCoordinate> validSelection(
            Optional<HexMap> selectedMap,
            Optional<HexCoordinate> selectedTile
    ) {
        if (selectedMap.isEmpty() || selectedTile == null || selectedTile.isEmpty()) {
            return Optional.empty();
        }
        HexCoordinate coordinate = selectedTile.get();
        return coordinate.insideRadius(selectedMap.get().radius())
                ? Optional.of(coordinate)
                : Optional.empty();
    }
}
