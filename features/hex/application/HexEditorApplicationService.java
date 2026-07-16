package features.hex.application;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import features.hex.domain.map.HexCoordinate;
import features.hex.domain.map.HexEditorMode;
import features.hex.domain.map.HexEditorState;
import features.hex.domain.map.HexEditorWorkspace;
import features.hex.domain.map.HexMap;
import features.hex.domain.map.HexMapIdentity;
import features.hex.domain.map.HexMapSummary;
import features.hex.domain.map.HexMarker;
import features.hex.domain.map.HexMarkerIdentity;
import features.hex.domain.map.HexMarkerKind;
import features.hex.domain.map.HexTerrain;
import features.hex.domain.map.repository.HexMapRepository;
import features.hex.api.CreateHexMapCommand;
import features.hex.api.HexEditorModel;
import features.hex.api.HexEditorModel.ToolIntent;
import features.hex.api.LoadHexEditorCommand;
import features.hex.api.PaintHexTerrainCommand;
import features.hex.api.RenameHexMapCommand;
import features.hex.api.SaveHexMarkerCommand;
import features.hex.api.SelectHexMapCommand;
import features.hex.api.SelectHexTileCommand;
import features.hex.api.SetHexEditorToolCommand;
import features.hex.api.UpdateHexMapCommand;

public final class HexEditorApplicationService implements features.hex.api.HexEditorApi {

    private static final DiagnosticId STORAGE_FAILURE = new DiagnosticId("hex.storage-failure");
    private static final String STORAGE_FAILURE_TEXT = "Hex-Daten konnten nicht geladen oder gespeichert werden.";

    private final EditorMutations mutations;
    private final ExecutionLane executionLane;

    public HexEditorApplicationService(
            HexMapRepository repository,
            HexEditorWorkspace workspace,
            HexEditorModel model,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        mutations = new EditorMutations(
                Objects.requireNonNull(repository, "repository"),
                new EditorPublisher(
                        Objects.requireNonNull(repository, "repository"),
                        Objects.requireNonNull(workspace, "workspace"),
                        Objects.requireNonNull(model, "model")),
                Objects.requireNonNull(diagnostics, "diagnostics"));
    }

    public void createMap(CreateHexMapCommand command) {
        CreateHexMapCommand safeCommand = Objects.requireNonNull(command, "command");
        executionLane.execute(() -> mutations.createMap(safeCommand.displayName(), safeCommand.radius()));
    }

    public void loadEditor(LoadHexEditorCommand command) {
        Objects.requireNonNull(command, "command");
        executionLane.execute(mutations::loadEditorState);
    }

    public void selectMap(SelectHexMapCommand command) {
        SelectHexMapCommand safeCommand = Objects.requireNonNull(command, "command");
        executionLane.execute(() -> mutations.selectMap(safeCommand.mapId()));
    }

    public void reloadAndSelectMap(LoadHexEditorCommand loadCommand, SelectHexMapCommand selectCommand) {
        Objects.requireNonNull(loadCommand, "loadCommand");
        SelectHexMapCommand safeSelect = Objects.requireNonNull(selectCommand, "selectCommand");
        executionLane.execute(() -> {
            mutations.loadEditorState();
            mutations.selectMap(safeSelect.mapId());
        });
    }

    public void updateMap(UpdateHexMapCommand command) {
        UpdateHexMapCommand safeCommand = Objects.requireNonNull(command, "command");
        executionLane.execute(() -> mutations.updateMap(
                safeCommand.mapId(),
                safeCommand.displayName(),
                safeCommand.radius(),
                safeCommand.confirmDestructiveShrink()));
    }

    public void renameMap(RenameHexMapCommand command) {
        RenameHexMapCommand safeCommand = Objects.requireNonNull(command, "command");
        executionLane.execute(() -> mutations.renameMap(safeCommand.mapId(), safeCommand.displayName()));
    }

    public void selectTile(SelectHexTileCommand command) {
        SelectHexTileCommand safeCommand = Objects.requireNonNull(command, "command");
        ToolIntent toolIntent = mutations.currentToolIntent();
        executionLane.execute(() -> mutations.selectTile(
                safeCommand.mapId(), safeCommand.q(), safeCommand.r(), toolIntent));
    }

    public void paintTerrain(PaintHexTerrainCommand command) {
        PaintHexTerrainCommand safeCommand = Objects.requireNonNull(command, "command");
        ToolIntent toolIntent = mutations.currentToolIntent();
        executionLane.execute(() -> mutations.paintTerrain(
                safeCommand.mapId(), safeCommand.q(), safeCommand.r(), safeCommand.terrain(), toolIntent));
    }

    public void saveMarker(SaveHexMarkerCommand command) {
        SaveHexMarkerCommand safeCommand = Objects.requireNonNull(command, "command");
        ToolIntent toolIntent = mutations.currentToolIntent();
        executionLane.execute(() -> mutations.saveMarker(
                safeCommand.mapId(),
                safeCommand.markerId(),
                safeCommand.q(),
                safeCommand.r(),
                safeCommand.name(),
                safeCommand.type(),
                safeCommand.note(),
                toolIntent));
    }

    public void setActiveTool(SetHexEditorToolCommand command) {
        SetHexEditorToolCommand safeCommand = Objects.requireNonNull(command, "command");
        mutations.setActiveTool(safeCommand.tool(), safeCommand.terrain());
    }

    private static final class EditorMutations {

        private final HexMapRepository repository;
        private final EditorPublisher publisher;
        private final Diagnostics diagnostics;

        EditorMutations(HexMapRepository repository, EditorPublisher publisher, Diagnostics diagnostics) {
            this.repository = repository;
            this.publisher = publisher;
            this.diagnostics = diagnostics;
        }

        void createMap(String displayName, int radius) {
            try {
                HexMapIdentity mapId = new HexMapIdentity(repository.nextMapId());
                HexMap savedMap = repository.save(HexMap.create(mapId, displayName, radius));
                repository.setSelectedMap(savedMap.mapId());
                publisher.publishLoaded(Optional.of(savedMap), Optional.empty(), "Hex map created.", "", "");
            } catch (IllegalArgumentException exception) {
                publisher.publishFailure(exception.getMessage());
            } catch (IllegalStateException exception) {
                publishStorageFailure(exception);
            }
        }

        void loadEditorState() {
            try {
                publisher.publishLoaded(repository.loadSelected(), publisher.currentState().selectedTile(), "", "", "");
            } catch (IllegalArgumentException exception) {
                publisher.publish(publisher.currentState().withFailure(exception.getMessage()));
            } catch (IllegalStateException exception) {
                publishStorageFailure(exception);
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
            } catch (IllegalArgumentException exception) {
                publisher.publishFailure(exception.getMessage());
            } catch (IllegalStateException exception) {
                publishStorageFailure(exception);
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
            } catch (IllegalArgumentException exception) {
                publisher.publishFailure(exception.getMessage());
            } catch (IllegalStateException exception) {
                publishStorageFailure(exception);
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
            } catch (IllegalArgumentException exception) {
                publisher.publishFailure(exception.getMessage());
            } catch (IllegalStateException exception) {
                publishStorageFailure(exception);
            }
        }

        void selectTile(long mapIdValue, int q, int r, ToolIntent submittedToolIntent) {
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
                publishSelectedTile(map, coordinate, submittedToolIntent);
            } catch (IllegalArgumentException exception) {
                publisher.publishFailure(exception.getMessage());
            } catch (IllegalStateException exception) {
                publishStorageFailure(exception);
            }
        }

        void paintTerrain(long mapIdValue, int q, int r, String terrainName, ToolIntent submittedToolIntent) {
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
                publisher.publishLoadedCompletion(
                        Optional.of(savedMap),
                        Optional.of(coordinate),
                        "Hex terrain painted.",
                        HexEditorMode.PAINT_TERRAIN,
                        terrain,
                        submittedToolIntent.revision());
            } catch (IllegalArgumentException exception) {
                publisher.publishFailure(exception.getMessage());
            } catch (IllegalStateException exception) {
                publishStorageFailure(exception);
            }
        }

        void saveMarker(
                long mapIdValue,
                long markerIdValue,
                int q,
                int r,
                String name,
                String typeName,
                String note,
                ToolIntent submittedToolIntent
        ) {
            try {
                HexMapIdentity mapId = new HexMapIdentity(mapIdValue);
                HexCoordinate coordinate = new HexCoordinate(q, r);
                HexMarkerKind type = EditorKeys.markerType(typeName);
                Optional<HexMap> loaded = repository.loadById(mapId);
                if (loaded.isEmpty()) {
                    publisher.publishMissingMap();
                    return;
                }
                MarkerPersistence.save(
                        repository,
                        publisher,
                        mapId,
                        markerIdValue,
                        coordinate,
                        name,
                        type,
                        note,
                        loaded.get(),
                        submittedToolIntent);
            } catch (IllegalArgumentException exception) {
                publisher.publishFailure(exception.getMessage());
            } catch (IllegalStateException exception) {
                publishStorageFailure(exception);
            }
        }

        ToolIntent currentToolIntent() {
            return publisher.currentToolIntent();
        }

        void setActiveTool(String modeName, String terrainName) {
            publisher.publishImmediateToolIntent(
                    EditorKeys.mode(modeName),
                    EditorKeys.terrain(terrainName));
        }

        private void publishSelectedTile(
                HexMap map,
                HexCoordinate coordinate,
                ToolIntent submittedToolIntent
        ) {
            publisher.publishLoadedCompletion(
                    Optional.of(map),
                    Optional.of(coordinate),
                    "Hex tile selected.",
                    HexEditorMode.defaultMode(),
                    EditorKeys.terrain(submittedToolIntent.activeTerrain()),
                    submittedToolIntent.revision());
        }

        private void publishStorageFailure(IllegalStateException exception) {
            diagnostics.failure(STORAGE_FAILURE, exception.getClass());
            publisher.publishFailure(STORAGE_FAILURE_TEXT);
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
                HexMap map,
                ToolIntent submittedToolIntent
        ) {
            HexMarkerIdentity resolvedMarkerId = markerIdValue <= 0L
                    ? new HexMarkerIdentity(repository.nextMarkerId(mapId))
                    : new HexMarkerIdentity(markerIdValue);
            HexMarker marker = new HexMarker(resolvedMarkerId, coordinate, name, type, note);
            HexMap markerMap = map.saveMarker(resolvedMarkerId, coordinate, name, type, note);
            HexMap savedMap = repository.saveMarker(markerMap.mapId(), marker);
            publisher.publishLoadedCompletion(
                    Optional.of(savedMap),
                    Optional.of(coordinate),
                    "Hex marker saved.",
                    HexEditorMode.PLACE_MARKER,
                    EditorKeys.terrain(submittedToolIntent.activeTerrain()),
                    submittedToolIntent.revision());
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

        HexEditorState publishLoadedCompletion(
                Optional<HexMap> selectedMap,
                Optional<HexCoordinate> selectedTile,
                String statusText,
                HexEditorMode activeMode,
                HexTerrain activeTerrain,
                long submittedToolRevision
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
            return publishCompletion(nextState, submittedToolRevision);
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

        private HexEditorState publishCompletion(HexEditorState state, long submittedToolRevision) {
            HexEditorState nextState = workspace.replace(state);
            model.publishCompletion(HexEditorSnapshotProjection.project(nextState), submittedToolRevision);
            return nextState;
        }

        ToolIntent currentToolIntent() {
            return model.currentToolIntent();
        }

        void publishImmediateToolIntent(HexEditorMode activeMode, HexTerrain activeTerrain) {
            model.publishImmediateToolIntent(activeMode.name(), activeTerrain.name());
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
