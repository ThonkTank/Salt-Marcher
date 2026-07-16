package src.domain.hex;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.model.map.HexEditorMode;
import src.domain.hex.model.map.HexEditorState;
import src.domain.hex.model.map.HexEditorWorkspace;
import src.domain.hex.model.map.HexMap;
import src.domain.hex.model.map.HexMapIdentity;
import src.domain.hex.model.map.HexMapSummary;
import src.domain.hex.model.map.HexMarker;
import src.domain.hex.model.map.HexMarkerIdentity;
import src.domain.hex.model.map.HexMarkerKind;
import src.domain.hex.model.map.HexTerrain;
import src.domain.hex.model.map.repository.HexMapRepository;
import src.domain.hex.published.CreateHexMapCommand;
import src.domain.hex.published.HexEditorModel;
import src.domain.hex.published.LoadHexEditorCommand;
import src.domain.hex.published.PaintHexTerrainCommand;
import src.domain.hex.published.RenameHexMapCommand;
import src.domain.hex.published.SaveHexMarkerCommand;
import src.domain.hex.published.SelectHexMapCommand;
import src.domain.hex.published.SelectHexTileCommand;
import src.domain.hex.published.SetHexEditorToolCommand;
import src.domain.hex.published.UpdateHexMapCommand;

public final class HexEditorApplicationService {

    private final EditorMutations mutations;

    HexEditorApplicationService(
            HexMapRepository repository,
            HexEditorWorkspace workspace,
            HexEditorModel model
    ) {
        mutations = new EditorMutations(
                Objects.requireNonNull(repository, "repository"),
                new EditorPublisher(
                        Objects.requireNonNull(repository, "repository"),
                        Objects.requireNonNull(workspace, "workspace"),
                        Objects.requireNonNull(model, "model")));
    }

    public void createMap(CreateHexMapCommand command) {
        mutations.createMap(command.displayName(), command.radius());
    }

    public void loadEditor(LoadHexEditorCommand command) {
        Objects.requireNonNull(command, "command");
        mutations.loadEditorState();
    }

    public void selectMap(SelectHexMapCommand command) {
        mutations.selectMap(command.mapId());
    }

    public void updateMap(UpdateHexMapCommand command) {
        mutations.updateMap(
                command.mapId(),
                command.displayName(),
                command.radius(),
                command.confirmDestructiveShrink());
    }

    public void renameMap(RenameHexMapCommand command) {
        mutations.renameMap(command.mapId(), command.displayName());
    }

    public void selectTile(SelectHexTileCommand command) {
        mutations.selectTile(command.mapId(), command.q(), command.r());
    }

    public void paintTerrain(PaintHexTerrainCommand command) {
        mutations.paintTerrain(command.mapId(), command.q(), command.r(), command.terrain());
    }

    public void saveMarker(SaveHexMarkerCommand command) {
        mutations.saveMarker(
                command.mapId(),
                command.markerId(),
                command.q(),
                command.r(),
                command.name(),
                command.type(),
                command.note());
    }

    public void setActiveTool(SetHexEditorToolCommand command) {
        mutations.setActiveTool(command.tool(), command.terrain());
    }

    private static final class EditorMutations {

        private final HexMapRepository repository;
        private final EditorPublisher publisher;

        EditorMutations(HexMapRepository repository, EditorPublisher publisher) {
            this.repository = repository;
            this.publisher = publisher;
        }

        void createMap(String displayName, int radius) {
            try {
                HexMapIdentity mapId = new HexMapIdentity(repository.nextMapId());
                HexMap savedMap = repository.save(HexMap.create(mapId, displayName, radius));
                repository.setSelectedMap(savedMap.mapId());
                publisher.publishLoaded(Optional.of(savedMap), Optional.empty(), "Hex map created.", "", "");
            } catch (IllegalArgumentException | IllegalStateException exception) {
                publisher.publishFailure(exception.getMessage());
            }
        }

        void loadEditorState() {
            try {
                publisher.publishLoaded(repository.loadSelected(), publisher.currentState().selectedTile(), "", "", "");
            } catch (IllegalArgumentException | IllegalStateException exception) {
                publisher.publish(publisher.currentState().withFailure(exception.getMessage()));
            }
        }

        void selectMap(long mapIdValue) {
            try {
                HexMapIdentity mapId = new HexMapIdentity(mapIdValue);
                Optional<HexMap> selectedMap = repository.loadById(mapId);
                if (selectedMap.isEmpty()) {
                    publisher.publishMissingMap();
                    return;
                }
                repository.setSelectedMap(mapId);
                publisher.publishLoaded(selectedMap, Optional.empty(), "Hex map selected.", "", "");
            } catch (IllegalArgumentException | IllegalStateException exception) {
                publisher.publishFailure(exception.getMessage());
            }
        }

        void updateMap(long mapIdValue, String displayName, int radius, boolean confirmDestructiveShrink) {
            try {
                HexMapIdentity mapId = new HexMapIdentity(mapIdValue);
                Optional<HexMap> loaded = repository.loadById(mapId);
                if (loaded.isEmpty()) {
                    publisher.publishMissingMap();
                    return;
                }
                updateLoadedMap(loaded.get(), displayName, radius, confirmDestructiveShrink);
            } catch (IllegalArgumentException | IllegalStateException exception) {
                publisher.publishFailure(exception.getMessage());
            }
        }

        void renameMap(long mapIdValue, String displayName) {
            try {
                HexMapIdentity mapId = new HexMapIdentity(mapIdValue);
                Optional<HexMap> loaded = repository.loadById(mapId);
                if (loaded.isEmpty()) {
                    publisher.publishMissingMap();
                    return;
                }
                repository.save(loaded.get().updateMetadata(displayName, loaded.get().radius()));
                publisher.publishLoaded(
                        repository.loadSelected(),
                        publisher.currentState().selectedTile(),
                        "Hex map renamed.",
                        "",
                        "");
            } catch (IllegalArgumentException | IllegalStateException exception) {
                publisher.publishFailure(exception.getMessage());
            }
        }

        void selectTile(long mapIdValue, int q, int r) {
            try {
                HexMapIdentity mapId = new HexMapIdentity(mapIdValue);
                HexCoordinate coordinate = new HexCoordinate(q, r);
                Optional<HexMap> loaded = repository.loadById(mapId);
                if (loaded.isEmpty()) {
                    publisher.publishMissingMap();
                    return;
                }
                HexMap map = loaded.get();
                map.requireInside(coordinate);
                publisher.publishLoadedWithActiveTool(
                        Optional.of(map),
                        Optional.of(coordinate),
                        "Hex tile selected.",
                        HexEditorMode.defaultMode(),
                        publisher.currentState().activeTerrain());
            } catch (IllegalArgumentException | IllegalStateException exception) {
                publisher.publishFailure(exception.getMessage());
            }
        }

        void paintTerrain(long mapIdValue, int q, int r, String terrainName) {
            try {
                HexMapIdentity mapId = new HexMapIdentity(mapIdValue);
                HexCoordinate coordinate = new HexCoordinate(q, r);
                HexTerrain terrain = EditorKeys.terrain(terrainName);
                Optional<HexMap> loaded = repository.loadById(mapId);
                if (loaded.isEmpty()) {
                    publisher.publishMissingMap();
                    return;
                }
                HexMap paintedMap = loaded.get().paintTerrain(coordinate, terrain);
                HexMap savedMap = repository.saveTerrain(paintedMap.mapId(), coordinate, terrain);
                publisher.publishLoadedWithActiveTool(
                        Optional.of(savedMap),
                        Optional.of(coordinate),
                        "Hex terrain painted.",
                        HexEditorMode.PAINT_TERRAIN,
                        terrain);
            } catch (IllegalArgumentException | IllegalStateException exception) {
                publisher.publishFailure(exception.getMessage());
            }
        }

        void saveMarker(long mapIdValue, long markerIdValue, int q, int r, String name, String typeName, String note) {
            try {
                HexMapIdentity mapId = new HexMapIdentity(mapIdValue);
                HexCoordinate coordinate = new HexCoordinate(q, r);
                HexMarkerKind type = EditorKeys.markerType(typeName);
                Optional<HexMap> loaded = repository.loadById(mapId);
                if (loaded.isEmpty()) {
                    publisher.publishMissingMap();
                    return;
                }
                MarkerPersistence.save(repository, publisher, mapId, markerIdValue, coordinate, name, type, note, loaded.get());
            } catch (IllegalArgumentException | IllegalStateException exception) {
                publisher.publishFailure(exception.getMessage());
            }
        }

        void setActiveTool(String modeName, String terrainName) {
            HexEditorState loaded = publisher.currentState();
            publisher.publish(loaded.withActiveTool(
                    EditorKeys.mode(modeName),
                    EditorKeys.terrain(terrainName)).withStatus("Hex editor tool selected."));
        }

        private void updateLoadedMap(
                HexMap map,
                String displayName,
                int radius,
                boolean confirmDestructiveShrink
        ) {
            Optional<HexCoordinate> selectedTile = publisher.currentState().selectedTile();
            if (map.wouldRemoveAuthoredData(radius) && !confirmDestructiveShrink) {
                publisher.publishLoaded(
                        Optional.of(map),
                        selectedTile,
                        "",
                        "",
                        "Radius shrink would remove authored Hex tile data.");
                return;
            }
            HexMap savedMap = repository.save(map.updateMetadata(displayName, radius));
            repository.setSelectedMap(savedMap.mapId());
            publisher.publishLoaded(Optional.of(savedMap), selectedTile, "Hex map updated.", "", "");
        }

    }

    private static final class MarkerPersistence {

        static void save(
                HexMapRepository repository,
                EditorPublisher publisher,
                HexMapIdentity mapId,
                long markerIdValue,
                HexCoordinate coordinate,
                String name,
                HexMarkerKind type,
                String note,
                HexMap map
        ) {
            HexMarkerIdentity resolvedMarkerId = markerIdValue <= 0L
                    ? new HexMarkerIdentity(repository.nextMarkerId(mapId))
                    : new HexMarkerIdentity(markerIdValue);
            HexMarker marker = new HexMarker(resolvedMarkerId, coordinate, name, type, note);
            HexMap markerMap = map.saveMarker(resolvedMarkerId, coordinate, name, type, note);
            HexMap savedMap = repository.saveMarker(markerMap.mapId(), marker);
            publisher.publishLoadedWithActiveTool(
                    Optional.of(savedMap),
                    Optional.of(coordinate),
                    "Hex marker saved.",
                    HexEditorMode.PLACE_MARKER,
                    publisher.currentState().activeTerrain());
        }
    }

    private static final class EditorPublisher {

        private final HexMapRepository repository;
        private final HexEditorWorkspace workspace;
        private final HexEditorModel model;

        EditorPublisher(
                HexMapRepository repository,
                HexEditorWorkspace workspace,
                HexEditorModel model
        ) {
            this.repository = repository;
            this.workspace = workspace;
            this.model = model;
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

        HexEditorState publish(HexEditorState state) {
            HexEditorState nextState = workspace.replace(state);
            model.publish(HexEditorSnapshotProjection.project(nextState));
            return nextState;
        }

        HexEditorState currentState() {
            return workspace.state();
        }

        void publishMissingMap() {
            publishLoaded(repository.loadSelected(), Optional.empty(), "", "Hex map not found.", "");
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

    private static final class EditorKeys {

        static HexEditorMode mode(String modeName) {
            return modeName == null || modeName.isBlank()
                    ? HexEditorMode.defaultMode()
                    : HexEditorMode.valueOf(modeName);
        }

        static HexTerrain terrain(String terrainName) {
            return terrainName == null || terrainName.isBlank()
                    ? HexTerrain.defaultTerrain()
                    : HexTerrain.valueOf(terrainName);
        }

        static HexMarkerKind markerType(String typeName) {
            return typeName == null || typeName.isBlank() ? null : HexMarkerKind.valueOf(typeName);
        }
    }
}
