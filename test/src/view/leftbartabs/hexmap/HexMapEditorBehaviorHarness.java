package src.view.leftbartabs.hexmap;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import javafx.event.ActionEvent;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.canvas.Canvas;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import javafx.stage.Window;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.data.hex.model.HexPersistenceSchema;
import src.domain.hex.HexEditorApplicationService;
import src.domain.hex.HexTravelApplicationService;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.published.CreateHexMapCommand;
import src.domain.hex.published.HexEditorModel;
import src.domain.hex.published.HexEditorSnapshot;
import src.domain.hex.published.HexMapId;
import src.domain.hex.published.HexTravelModel;
import src.domain.hex.published.HexTravelSnapshot;
import src.domain.hex.published.LoadHexEditorCommand;
import src.domain.hex.published.PaintHexTerrainCommand;
import src.domain.hex.published.SaveHexMarkerCommand;
import src.domain.hex.published.SelectHexMapCommand;
import src.domain.hex.published.SelectHexTileCommand;
import src.domain.hex.published.SetHexEditorToolCommand;
import src.domain.hex.published.UpdateHexMapCommand;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsView;

public final class HexMapEditorBehaviorHarness {

    private static final String ORIGINAL_NAME = "Wave 3 Hex Map";
    private static final String UPDATED_NAME = "Wave 3 Hex Map Updated";
    private static final int START_RADIUS = 2;
    private static final int UPDATED_RADIUS = 3;
    private static final int AUTHORED_Q = 2;
    private static final int AUTHORED_R = 0;
    private static final String AUTHORED_TERRAIN = "WATER";
    private static final String MARKER_NAME = "Old Tower";
    private static final String MARKER_NOTE = "Visible from the river";
    private static final String SHELL_BOUND_MAP_NAME = "Shell Bound Hex Map";
    private static final String SHELL_BOUND_UPDATED_NAME = "Shell Bound Hex Map Updated";
    private static final String SHELL_BOUND_MARKER_NAME = "Shell Tower";
    private static final String HEX_HITS_PROPERTY = "hex.hits";
    private static final int HIT_Q = 0;
    private static final int HIT_R = 1;
    private static final int HIT_CENTER_X = 2;
    private static final int HIT_CENTER_Y = 3;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();
    private static final int AWAIT_SECONDS = 10;

    private HexMapEditorBehaviorHarness() {
    }

    public static void main(String[] args) {
        List<String> results = new ArrayList<>();
        try {
            run(results);
            shutdownFx();
            System.out.println("Hex Map editor behavior harness passed: " + results.size() + " proof item(s).");
            for (String result : results) {
                System.out.println(result);
            }
        } catch (Throwable throwable) {
            throwable.printStackTrace(System.err);
            try {
                shutdownFx();
            } catch (Exception shutdownFailure) {
                shutdownFailure.printStackTrace(System.err);
            }
            System.exit(1);
        }
    }

    static void run(List<String> results) throws Exception {
        RuntimeSurface runtime = RuntimeSurface.create();
        runtime.editor().createMap(new CreateHexMapCommand(ORIGINAL_NAME, START_RADIUS));
        HexEditorSnapshot created = runtime.current();
        HexMapId mapId = selectedMapId(created);
        long authoredTileId = new HexCoordinate(AUTHORED_Q, AUTHORED_R).stableTileId();
        HexCoordinate decodedAuthoredTile = HexCoordinate.fromStableTileId(authoredTileId)
                .orElseThrow(() -> new IllegalStateException("HEX-TRAVEL-001 expected tile id decode."));
        assertEquals(new HexCoordinate(AUTHORED_Q, AUTHORED_R), decodedAuthoredTile,
                "HEX-TRAVEL-001 stable tile id roundtrip");
        assertEquals(ORIGINAL_NAME, selectedMap(created).displayName(), "HEX-EDITOR-001 created map name");
        assertEquals(START_RADIUS, selectedMap(created).radius(), "HEX-EDITOR-001 created map radius");
        assertEquals(19, selectedMap(created).tileCount(), "HEX-EDITOR-001 created radius-2 tile count");
        assertTrue(created.catalog().stream().anyMatch(map -> map.mapId().equals(mapId)),
                "HEX-EDITOR-001 catalog exposes created map");
        assertEquals(ORIGINAL_NAME, mainProjection(created).title(), "HEX-EDITOR-001 projection title");

        runtime.editor().paintTerrain(new PaintHexTerrainCommand(
                mapId.value(),
                AUTHORED_Q,
                AUTHORED_R,
                AUTHORED_TERRAIN));
        HexEditorSnapshot painted = runtime.current();
        assertTileTerrain(painted, AUTHORED_Q, AUTHORED_R, AUTHORED_TERRAIN, "HEX-EDITOR-004 painted snapshot");
        assertEquals(
                HexMapVocabularyContentPartModel.terrainLabel(AUTHORED_TERRAIN),
                mainTileProjection(painted, AUTHORED_Q, AUTHORED_R).terrainLabel(),
                "HEX-EDITOR-004 visible terrain label");
        assertEquals(1L, runtime.database().terrainOverrideCount(mapId.value()),
                "HEX-EDITOR-004 persisted terrain override row");

        runtime.editor().updateMap(new UpdateHexMapCommand(mapId.value(), UPDATED_NAME, UPDATED_RADIUS, false));
        HexEditorSnapshot expanded = runtime.current();
        assertEquals(UPDATED_NAME, selectedMap(expanded).displayName(), "HEX-EDITOR-002 metadata name persists");
        assertEquals(UPDATED_RADIUS, selectedMap(expanded).radius(), "HEX-EDITOR-002 radius expansion persists");
        assertTileTerrain(expanded, AUTHORED_Q, AUTHORED_R, AUTHORED_TERRAIN,
                "HEX-EDITOR-002 authored terrain survives expansion");
        runOnFxThread(() -> assertStatePaneAllowsDomainRadius(runtime, expanded, 21));

        runtime.editor().updateMap(new UpdateHexMapCommand(mapId.value(), "Unsafe Shrink", 1, false));
        HexEditorSnapshot shrinkBlocked = runtime.current();
        assertContains(shrinkBlocked.warningText(), "remove authored Hex tile data",
                "HEX-EDITOR-002 shrink warning");
        assertEquals(UPDATED_NAME, selectedMap(shrinkBlocked).displayName(),
                "HEX-EDITOR-002 shrink warning does not rename");
        assertEquals(UPDATED_RADIUS, selectedMap(shrinkBlocked).radius(),
                "HEX-EDITOR-002 shrink warning does not shrink");

        runtime.editor().selectTile(new SelectHexTileCommand(mapId.value(), AUTHORED_Q, AUTHORED_R));
        HexEditorSnapshot selected = runtime.current();
        HexEditorSnapshot.TileDetails tileDetails = selected.selectedTile()
                .orElseThrow(() -> new IllegalStateException("HEX-EDITOR-003 selected tile details missing"));
        assertEquals(AUTHORED_Q, tileDetails.q(), "HEX-EDITOR-003 selected q");
        assertEquals(AUTHORED_R, tileDetails.r(), "HEX-EDITOR-003 selected r");
        assertEquals(AUTHORED_TERRAIN, tileDetails.terrain(), "HEX-EDITOR-003 selected terrain");
        HexMapStateContentModel.Projection stateProjection = stateProjection(selected);
        assertTrue(stateProjection.tileSelected(), "HEX-EDITOR-003 state projection selected");
        assertEquals("2,0", stateProjection.coordinateText(), "HEX-EDITOR-003 visible coordinate");
        assertEquals("Wasser", stateProjection.terrainText(), "HEX-EDITOR-003 visible terrain detail");

        runtime.editor().saveMarker(new SaveHexMarkerCommand(
                mapId.value(),
                0L,
                AUTHORED_Q,
                AUTHORED_R,
                MARKER_NAME,
                "LANDMARK",
                MARKER_NOTE));
        HexEditorSnapshot markerSaved = runtime.current();
        assertMarker(markerSaved, MARKER_NAME, "LANDMARK", MARKER_NOTE, "HEX-EDITOR-005");
        assertEquals("Landmarke", mainTileProjection(markerSaved, AUTHORED_Q, AUTHORED_R).markerText(),
                "HEX-EDITOR-005 visible marker label");
        assertEquals(1L, runtime.database().markerCount(mapId.value()),
                "HEX-EDITOR-005 persisted one marker row");
        runtime.party().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Guide", "Player", 3, 12, 14),
                MembershipState.ACTIVE));
        runtime.party().moveCharacters(new MovePartyCharactersCommand(
                List.of(1L),
                new PartyOverworldTravelLocationSnapshot(mapId.value(), authoredTileId),
                true));
        HexTravelSnapshot travel = runtime.travel().current();
        assertTrue(travel.active(), "HEX-TRAVEL-002 active Hex travel readback");
        assertEquals(AUTHORED_Q, travel.q(), "HEX-TRAVEL-002 travel q");
        assertEquals(AUTHORED_R, travel.r(), "HEX-TRAVEL-002 travel r");
        assertEquals(List.of(1L), travel.partyTokenCharacterIds(), "HEX-TRAVEL-002 party token character ids");
        assertTrue(mainProjection(markerSaved, travel).partyToken().active(),
                "HEX-TRAVEL-002 visible party token projection");
        assertContains(stateProjection(markerSaved, travel).travelText(), "2,0",
                "HEX-TRAVEL-002 state travel readback");
        runOnFxThread(() -> assertMainViewTravelOverlayDoesNotRedrawTiles(markerSaved, travel));
        runtime.editor().setActiveTool(new SetHexEditorToolCommand("MOVE_PARTY", "GRASSLAND"));
        HexEditorSnapshot moveToolSnapshot = runtime.current();
        runOnFxThread(() -> assertMainViewUsesToolLabel(moveToolSnapshot));
        runOnFxThread(() -> assertMarkerDraftPreservedAcrossToolRefresh(markerSaved, moveToolSnapshot));
        runOnFxThread(() -> assertMovePartyToolMovesPartyToken(runtime, markerSaved, travel));
        runtime.hexTravel().movePartyToken(new src.domain.hex.published.MoveHexPartyTokenCommand(
                mapId.value(),
                99,
                99,
                List.of(1L)));
        HexTravelSnapshot invalidMove = runtime.travel().current();
        assertEquals(0, invalidMove.q(), "HEX-TRAVEL-004 invalid move keeps previous q");
        assertEquals(0, invalidMove.r(), "HEX-TRAVEL-004 invalid move keeps previous r");
        runOnFxThread(() -> assertMapSaveDoesNotRouteToMarkerSave(runtime, markerSaved));
        runOnFxThread(() -> assertMarkerSaveDoesNotRouteToMapUpdate(runtime, markerSaved));

        runtime.editor().saveMarker(new SaveHexMarkerCommand(
                mapId.value(),
                0L,
                1,
                0,
                " ",
                "RESOURCE",
                ""));
        HexEditorSnapshot missingName = runtime.current();
        assertContains(missingName.failureText(), "name must be nonblank",
                "HEX-EDITOR-006 missing name validation");
        assertEquals(2L, runtime.database().markerCount(mapId.value()),
                "HEX-EDITOR-006 missing name does not persist");
        runtime.editor().saveMarker(new SaveHexMarkerCommand(
                mapId.value(),
                0L,
                1,
                0,
                "Unnamed Resource",
                "",
                ""));
        HexEditorSnapshot missingType = runtime.current();
        assertContains(missingType.failureText(), "type is required",
                "HEX-EDITOR-006 missing type validation");
        assertEquals(2L, runtime.database().markerCount(mapId.value()),
                "HEX-EDITOR-006 missing type does not persist");
        runOnFxThread(() -> assertMapSaveFailureVisible(runtime, missingType));

        RuntimeSurface reloadedRuntime = RuntimeSurface.create();
        activateEditorThroughIntentHandler(reloadedRuntime);
        HexEditorSnapshot reloaded = reloadedRuntime.current();
        assertEquals(UPDATED_NAME, selectedMap(reloaded).displayName(), "HEX-EDITOR-007 reloaded map name");
        assertEquals(UPDATED_RADIUS, selectedMap(reloaded).radius(), "HEX-EDITOR-007 reloaded radius");
        assertTileTerrain(reloaded, AUTHORED_Q, AUTHORED_R, AUTHORED_TERRAIN,
                "HEX-EDITOR-007 reloaded terrain");
        assertMarker(reloaded, MARKER_NAME, "LANDMARK", MARKER_NOTE,
                "HEX-EDITOR-007 reloaded marker");
        runOnFxThread(HexMapEditorBehaviorHarness::assertBinderActivationLoadsAfterReadSideSetup);
        assertCatalogRenamePreservesNonCurrentRadius(runtime);

        runOnFxThread(() -> assertMarkerDraftPreservedAfterFailure(selected, missingName));
        runOnFxThread(HexMapEditorBehaviorHarness::assertShellBoundContributionRoute);
        runtime.database().forceMapRadius(mapId.value(), 100);
        runtime.editor().loadEditor(new LoadHexEditorCommand());
        HexEditorSnapshot corruptRadius = runtime.current();
        assertContains(corruptRadius.failureText(), "radius must be at most",
                "HEX-EDITOR-002 corrupt radius validation");
        runtime.database().forceMapRadius(mapId.value(), UPDATED_RADIUS);
        runtime.database().insertCorruptCatalogMap(999L, 100);
        runtime.editor().loadEditor(new LoadHexEditorCommand());
        HexEditorSnapshot corruptCatalogRadius = runtime.current();
        assertContains(corruptCatalogRadius.failureText(), "radius must be at most",
                "HEX-EDITOR-002 corrupt catalog radius validation");
        assertOversizedMapDoesNotRenderCanvasTiles();

        results.add("HEX-EDITOR-001 Ready: HexEditorApplicationService createMap -> HexEditorModel readback -> main projection title");
        results.add("HEX-EDITOR-002 Ready: updateMap expands metadata/radius, state pane accepts domain radius range, rejects over-limit stored radius, and blocks destructive shrink with warning before confirmation");
        results.add("HEX-EDITOR-003 Ready: selectTile -> selected tile details and state projection expose q,r plus terrain");
        results.add("HEX-EDITOR-004 Ready: paintTerrain -> HexEditorModel tile terrain, main projection label, and SQLite terrain override row");
        results.add("HEX-EDITOR-005 Ready: saveMarker -> one-tile marker readback, visible marker label, and one SQLite marker row");
        results.add("HEX-EDITOR-006 Ready: missing marker name/type publish validation failures and leave marker row count unchanged");
        results.add("HEX-EDITOR-007 Ready: same-root HexMapIntentHandler activation reloads metadata, terrain override, and marker from isolated SQLite route");
        results.add("HEX-EDITOR-010 Ready: HexMapBinder wires read-side subscribe/current before same-root activation intent loads persisted editor state");
        results.add("HEX-EDITOR-008 Ready: map save controls event does not route marker draft into marker persistence");
        results.add("HEX-EDITOR-009 Ready: marker save controls event does not route map draft into map metadata update");
        results.add("HEX-EDITOR-011 Ready: shared catalog rename preserves non-current Hex map radius");
        results.add("HEX-EDITOR-013 Ready: state-pane map save failure publishes visible error and keeps persisted map unchanged");
        results.add("HEX-TRAVEL-001 Ready: HexCoordinate stable tile id round-trips q,r for Party overworld travel");
        results.add("HEX-TRAVEL-002 Ready: Party overworld travel position projects as HexTravelModel and visible party token");
        results.add("HEX-TRAVEL-003 Ready: MOVE_PARTY Hex tool moves the existing party token through PartyApplicationService");
        results.add("HEX-TRAVEL-004 Ready: MOVE_PARTY rejects coordinates outside the selected Hex map radius");
        results.add("HEX-TRAVEL-005 Ready: travel overlay update does not redraw the Hex tile layer");
        results.add("HEX-TRAVEL-006 Ready: Hex map header shows user-facing Reisegruppe tool label");
        results.add("HEX-TRAVEL-007 Ready: marker draft survives Reisegruppe tool refresh");
        results.add("HEX-TRAVEL-008 Ready: oversized Hex map readback does not allocate rendered Canvas tiles");
        results.add("HEX-EDITOR-012 Ready: HexMapContribution shell-bound route creates, edits, paints, selects, saves marker, moves the party token, and reloads through bound Shell slots");
    }

    private static HexEditorSnapshot.MapSnapshot selectedMap(HexEditorSnapshot snapshot) {
        return snapshot.selectedMap()
                .orElseThrow(() -> new IllegalStateException("Expected selected Hex map."));
    }

    private static HexMapId selectedMapId(HexEditorSnapshot snapshot) {
        HexMapId mapId = selectedMap(snapshot).mapId();
        if (mapId.value() <= 0L) {
            throw new IllegalStateException("Expected resolved selected Hex map id.");
        }
        return mapId;
    }

    private static void assertTileTerrain(
            HexEditorSnapshot snapshot,
            int q,
            int r,
            String expectedTerrain,
            String message
    ) {
        HexEditorSnapshot.TileSnapshot tile = tile(snapshot, q, r);
        assertEquals(expectedTerrain, tile.terrain(), message);
    }

    private static HexEditorSnapshot.TileSnapshot tile(HexEditorSnapshot snapshot, int q, int r) {
        return snapshot.tiles().stream()
                .filter(candidate -> candidate.q() == q && candidate.r() == r)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Expected Hex tile " + q + "," + r + "."));
    }

    private static void assertMarker(
            HexEditorSnapshot snapshot,
            String expectedName,
            String expectedType,
            String expectedNote,
            String message
    ) {
        HexEditorSnapshot.MarkerSnapshot marker = tile(snapshot, AUTHORED_Q, AUTHORED_R).markers().stream()
                .filter(candidate -> expectedName.equals(candidate.name()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(message + " marker missing"));
        assertEquals(AUTHORED_Q, marker.q(), message + " marker q");
        assertEquals(AUTHORED_R, marker.r(), message + " marker r");
        assertEquals(expectedType, marker.type(), message + " marker type");
        assertEquals(expectedNote, marker.note(), message + " marker note");
    }

    private static void assertMarkerDraftPreservedAfterFailure(
            HexEditorSnapshot beforeFailure,
            HexEditorSnapshot failureSnapshot
    ) {
        HexMapViewModel viewModel = new HexMapViewModel();
        HexMapStateView view = new HexMapStateView();
        view.bind(viewModel);
        wireMarkerDraftEvents(view, viewModel);
        viewModel.applySnapshot(beforeFailure);
        TextField markerName = markerNameField(view);
        ComboBox<String> markerType = markerTypeSelector(view);
        TextArea markerNote = markerNoteArea(view);
        markerName.setText("Draft Camp");
        selectMarkerType(markerType, "RESOURCE");
        markerNote.setText("Draft note");
        viewModel.applySnapshot(failureSnapshot);
        assertEquals("Draft Camp", markerName.getText(),
                "HEX-EDITOR-006 controls preserve marker name draft after validation failure");
        assertEquals("RESOURCE", markerTypeKey(markerType.getValue()),
                "HEX-EDITOR-006 controls preserve marker type draft after validation failure");
        assertEquals("Draft note", markerNote.getText(),
                "HEX-EDITOR-006 controls preserve marker note draft after validation failure");
    }

    private static void assertMarkerDraftPreservedAcrossToolRefresh(
            HexEditorSnapshot beforeToolRefresh,
            HexEditorSnapshot afterToolRefresh
    ) {
        HexMapViewModel stateViewModel = new HexMapViewModel();
        HexMapStateView stateView = new HexMapStateView();
        stateView.bind(stateViewModel);
        wireMarkerDraftEvents(stateView, stateViewModel);
        stateViewModel.applySnapshot(beforeToolRefresh);
        TextField markerName = markerNameField(stateView);
        ComboBox<String> markerType = markerTypeSelector(stateView);
        TextArea markerNote = markerNoteArea(stateView);
        markerName.setText("Draft Shrine");
        selectMarkerType(markerType, "DANGER");
        markerNote.setText("Draft danger note");
        stateViewModel.applySnapshot(afterToolRefresh);
        assertEquals("Draft Shrine", markerName.getText(),
                "HEX-TRAVEL-007 state preserves marker name draft across tool refresh");
        assertEquals("DANGER", markerTypeKey(markerType.getValue()),
                "HEX-TRAVEL-007 state preserves marker type draft across tool refresh");
        assertEquals("Draft danger note", markerNote.getText(),
                "HEX-TRAVEL-007 state preserves marker note draft across tool refresh");

        HexMapViewModel controlsViewModel = new HexMapViewModel();
        HexMapControlsView controlsView = new HexMapControlsView();
        controlsView.bind(controlsViewModel);
        controlsViewModel.applySnapshot(afterToolRefresh);
        assertTrue(reisegruppeToolButton(controlsView).isSelected(),
                "HEX-TRAVEL-007 Reisegruppe tool selected after refresh");
    }

    private static void wireMarkerDraftEvents(
            HexMapStateView stateView,
            HexMapViewModel viewModel
    ) {
        stateView.onViewInputEvent(event -> {
            HexMapStateContentModel state = viewModel.stateContentModel();
            long markerId = state.resolvedMarkerId(event.markerOptionIndex());
            String markerName = state.resolvedMarkerName(
                    event.markerOptionIndex(),
                    event.markerName(),
                    event.markerSelectionRequested());
            String markerTypeKey = state.resolvedMarkerTypeKey(
                    event.markerOptionIndex(),
                    event.markerTypeOptionIndex(),
                    event.markerSelectionRequested());
            String markerNote = state.resolvedMarkerNote(
                    event.markerOptionIndex(),
                    event.markerNote(),
                    event.markerSelectionRequested());
            state.updateMarkerDraft(
                    markerId,
                    markerName,
                    markerTypeKey,
                    markerNote);
        });
    }

    private static void assertStatePaneAllowsDomainRadius(
            RuntimeSurface runtime,
            HexEditorSnapshot snapshot,
            int proofRadius
    ) {
        HexMapViewModel viewModel = viewModel(snapshot);
        HexMapStateView view = new HexMapStateView();
        AtomicReference<HexMapStateViewInputEvent> emitted = new AtomicReference<>();
        view.onViewInputEvent(emitted::set);
        view.bind(viewModel);
        Spinner<Integer> radiusSpinner = radiusSpinner(view);
        radiusSpinner.getValueFactory().setValue(proofRadius);
        mapSaveButton(view).fire();

        HexMapIntentHandler handler = intentHandler(runtime, viewModel);
        handler.consume(requiredEvent(emitted, "HEX-EDITOR-002 expected radius state event."));
        assertEquals(proofRadius, selectedMap(runtime.current()).radius(),
                "HEX-EDITOR-002 state pane accepts radius above old UI cap");
        runtime.editor().updateMap(new UpdateHexMapCommand(
                selectedMapId(runtime.current()).value(),
                UPDATED_NAME,
                UPDATED_RADIUS,
                false));
    }

    private static void assertMapSaveFailureVisible(
            RuntimeSurface runtime,
            HexEditorSnapshot snapshot
    ) {
        long mapId = selectedMapId(snapshot).value();
        String persistedName = selectedMap(snapshot).displayName();
        HexMapViewModel viewModel = viewModel(snapshot);
        HexMapStateView view = new HexMapStateView();
        AtomicReference<HexMapStateViewInputEvent> emitted = new AtomicReference<>();
        view.onViewInputEvent(emitted::set);
        view.bind(viewModel);
        mapNameField(view).setText("Save Failure Draft");
        mapSaveButton(view).fire();

        HexMapIntentHandler handler = intentHandler(runtime, viewModel);
        runtime.database().installFailingMapUpdateTrigger();
        try {
            handler.consume(requiredEvent(emitted, "HEX-EDITOR-013 expected map save state event."));
            HexEditorSnapshot failed = runtime.current();
            assertContains(failed.failureText(), "Failed to save Hex map to SQLite",
                    "HEX-EDITOR-013 save failure published through snapshot");
            assertEquals(persistedName, runtime.database().mapName(mapId),
                    "HEX-EDITOR-013 failed save leaves persisted map name unchanged");
            viewModel.applySnapshot(failed);
            assertVisibleLabelContains(view, "Failed to save Hex map to SQLite",
                    "HEX-EDITOR-013 save failure visible in state pane");
        } finally {
            runtime.database().dropFailingMapUpdateTrigger();
        }
    }

    private static void activateEditorThroughIntentHandler(RuntimeSurface runtime) {
        HexMapViewModel viewModel = viewModel(runtime.current(), runtime.travel().current());
        HexMapIntentHandler handler = intentHandler(runtime, viewModel);
        handler.activateEditor();
    }

    private static void assertBinderActivationLoadsAfterReadSideSetup() {
        RuntimeSurface runtime = RuntimeSurface.create();
        if (runtime.current().selectedMap().isPresent()) {
            throw new IllegalStateException("HEX-EDITOR-010 expected fresh Hex editor model before binder activation.");
        }
        List<String> events = new ArrayList<>();
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        builder.register(HexEditorApplicationService.class, runtime.editor());
        builder.register(HexTravelApplicationService.class, runtime.hexTravel());
        builder.register(HexEditorModel.class, new HexEditorModel(
                () -> {
                    events.add("editor.current");
                    return runtime.model().current();
                },
                listener -> {
                    events.add("editor.subscribe");
                    return runtime.model().subscribe(listener);
                }));
        builder.register(HexTravelModel.class, new HexTravelModel(
                () -> {
                    events.add("travel.current");
                    return runtime.travel().current();
                },
                listener -> {
                    events.add("travel.subscribe");
                    return runtime.travel().subscribe(listener);
                }));
        ShellRuntimeContext context = new ShellRuntimeContext(NoopInspectorSink.INSTANCE, builder.build());

        ShellBinding binding = new HexMapBinder(context).bind();

        assertEquals(List.of(
                "editor.subscribe",
                "travel.subscribe",
                "editor.current",
                "travel.current"), events, "HEX-EDITOR-010 read-side setup order before activation");
        assertTrue(runtime.current().selectedMap().isPresent(),
                "HEX-EDITOR-010 binder activation loads persisted Hex editor state");
        assertTrue(binding.slotContent().containsKey(shell.api.ShellSlot.COCKPIT_MAIN),
                "HEX-EDITOR-010 binder returns main slot binding");
    }

    private static void assertCatalogRenamePreservesNonCurrentRadius(RuntimeSurface runtime) {
        long currentMapId = selectedMapId(runtime.current()).value();
        runtime.editor().createMap(new CreateHexMapCommand("Catalog Rename Target", 7));
        long targetMapId = selectedMapId(runtime.current()).value();
        runtime.editor().selectMap(new SelectHexMapCommand(currentMapId));
        HexEditorSnapshot snapshot = runtime.current();
        HexMapIntentHandler handler = intentHandler(runtime, viewModel(snapshot));
        handler.consume(new src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsViewInputEvent(
                "",
                "",
                "",
                false,
                "",
                "",
                Long.toString(targetMapId),
                "Catalog Rename Target Updated",
                "",
                "",
                false,
                ""));

        assertEquals(currentMapId, selectedMapId(runtime.current()).value(),
                "HEX-EDITOR-011 catalog rename preserves the current map selection");
        assertEquals(7, runtime.database().mapRadius(targetMapId),
                "HEX-EDITOR-011 catalog rename preserves non-current map radius in storage");
        HexEditorSnapshot renamed = runtime.current();
        HexEditorSnapshot.MapSummary renamedSummary = renamed.catalog().stream()
                .filter(summary -> summary.mapId().value() == targetMapId)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("HEX-EDITOR-011 renamed catalog map missing."));
        assertEquals("Catalog Rename Target Updated", renamedSummary.displayName(),
                "HEX-EDITOR-011 catalog rename updates non-current map name");
        assertEquals(7, renamedSummary.radius(),
                "HEX-EDITOR-011 catalog rename readback preserves non-current map radius");
    }

    private static void assertMapSaveDoesNotRouteToMarkerSave(
            RuntimeSurface runtime,
            HexEditorSnapshot snapshot
    ) {
        long mapId = selectedMapId(snapshot).value();
        HexMapViewModel viewModel = viewModel(snapshot);
        HexMapStateView view = new HexMapStateView();
        AtomicReference<HexMapStateViewInputEvent> emitted = new AtomicReference<>();
        view.onViewInputEvent(emitted::set);
        view.bind(viewModel);
        TextField markerName = markerNameField(view);
        ComboBox<String> markerType = markerTypeSelector(view);
        TextArea markerNote = markerNoteArea(view);
        markerName.setText("Draft Camp");
        selectMarkerType(markerType, "RESOURCE");
        markerNote.setText("Should stay a draft");
        mapSaveButton(view).fire();

        HexMapStateViewInputEvent event = emitted.get();
        if (event == null) {
            throw new IllegalStateException("HEX-EDITOR-008 expected map save state event.");
        }
        assertTrue(event.updateMapRequested(), "HEX-EDITOR-008 map save requests map update");
        assertTrue(!event.saveMarkerRequested(), "HEX-EDITOR-008 map save must not request marker save");
        assertEquals(1L, runtime.database().markerCount(mapId), "HEX-EDITOR-008 marker count before handler");

        HexMapIntentHandler handler = intentHandler(runtime, viewModel);
        handler.consume(event);
        assertEquals(1L, runtime.database().markerCount(mapId),
                "HEX-EDITOR-008 map save does not persist marker draft");
    }

    private static void assertMarkerSaveDoesNotRouteToMapUpdate(
            RuntimeSurface runtime,
            HexEditorSnapshot snapshot
    ) {
        long mapId = selectedMapId(snapshot).value();
        HexMapViewModel viewModel = viewModel(snapshot);
        HexMapStateView view = new HexMapStateView();
        AtomicReference<HexMapStateViewInputEvent> emitted = new AtomicReference<>();
        view.onViewInputEvent(emitted::set);
        view.bind(viewModel);
        mapNameField(view).setText("Incidental Map Draft");
        TextField markerName = markerNameField(view);
        ComboBox<String> markerType = markerTypeSelector(view);
        TextArea markerNote = markerNoteArea(view);
        markerName.setText("Draft Camp");
        selectMarkerType(markerType, "RESOURCE");
        markerNote.setText("Should become a marker");
        markerSaveButton(view).fire();

        HexMapStateViewInputEvent event = emitted.get();
        if (event == null) {
            throw new IllegalStateException("HEX-EDITOR-009 expected marker save state event.");
        }
        assertTrue(event.saveMarkerRequested(), "HEX-EDITOR-009 marker save requests marker save");
        assertTrue(!event.updateMapRequested(), "HEX-EDITOR-009 marker save must not request map update");

        HexMapIntentHandler handler = intentHandler(runtime, viewModel);
        handler.consume(event);
        HexEditorSnapshot afterMarkerSave = runtime.current();
        assertEquals(UPDATED_NAME, selectedMap(afterMarkerSave).displayName(),
                "HEX-EDITOR-009 marker save leaves map name unchanged");
        assertEquals(2L, runtime.database().markerCount(mapId),
                "HEX-EDITOR-009 marker save persists marker despite incidental map draft");
        assertMarker(afterMarkerSave, "Draft Camp", "RESOURCE", "Should become a marker", "HEX-EDITOR-009");
    }

    private static void assertMovePartyToolMovesPartyToken(
            RuntimeSurface runtime,
            HexEditorSnapshot snapshot,
            HexTravelSnapshot travel
    ) {
        HexMapViewModel viewModel = viewModel(snapshot, travel);
        HexMapIntentHandler handler = intentHandler(runtime, viewModel);
        handler.consume(new HexMapMainViewInputEvent(
                selectedMapId(snapshot).value(),
                0,
                0,
                "MOVE_PARTY",
                "GRASSLAND"));
        HexTravelSnapshot moved = runtime.travel().current();
        assertTrue(moved.active(), "HEX-TRAVEL-003 moved travel remains active");
        assertEquals(0, moved.q(), "HEX-TRAVEL-003 moved q");
        assertEquals(0, moved.r(), "HEX-TRAVEL-003 moved r");
    }

    private static void assertMainViewTravelOverlayDoesNotRedrawTiles(
            HexEditorSnapshot snapshot,
            HexTravelSnapshot travel
    ) {
        HexMapViewModel viewModel = new HexMapViewModel();
        HexMapMainView view = new HexMapMainView();
        view.bind(viewModel);
        viewModel.applySnapshot(snapshot);
        Canvas tileCanvas = tileCanvas(view);
        long beforeTravelDraws = tileDrawCount(tileCanvas);
        viewModel.applyTravelSnapshot(travel);
        assertEquals(beforeTravelDraws, tileDrawCount(tileCanvas),
                "HEX-TRAVEL-005 first travel overlay update does not redraw tiles");
        viewModel.applyTravelSnapshot(new HexTravelSnapshot(
                true,
                selectedMapId(snapshot).value(),
                0,
                0,
                "Wave 3 Hex Map Updated 0,0",
                "Reisend",
                "nicht verfuegbar",
                "nicht verfuegbar",
                "Normal",
                "Reisegruppe auf der Hex-Karte bewegen",
                travel.partyTokenCharacterIds()));
        assertEquals(beforeTravelDraws, tileDrawCount(tileCanvas),
                "HEX-TRAVEL-005 subsequent travel overlay update does not redraw tiles");
    }

    private static void assertMainViewUsesToolLabel(HexEditorSnapshot snapshot) {
        HexMapViewModel viewModel = new HexMapViewModel();
        HexMapMainView view = new HexMapMainView();
        view.bind(viewModel);
        viewModel.applySnapshot(snapshot);
        List<String> labels = labels(view).stream()
                .map(Label::getText)
                .toList();
        assertTrue(labels.stream().anyMatch(text -> text.contains("Werkzeug: Reisegruppe")),
                "HEX-TRAVEL-006 expected Reisegruppe tool label");
        assertTrue(labels.stream().noneMatch(text -> text.contains("MOVE_PARTY")),
                "HEX-TRAVEL-006 must not show internal MOVE_PARTY key");
    }

    private static void assertOversizedMapDoesNotRenderCanvasTiles() {
        HexEditorSnapshot oversized = new HexEditorSnapshot(
                List.of(new HexEditorSnapshot.MapSummary(new HexMapId(77L), "Oversized", 21)),
                Optional.of(new HexEditorSnapshot.MapSnapshot(new HexMapId(77L), "Oversized", 21, 1_387)),
                List.of(new HexEditorSnapshot.TileSnapshot(0, 0, "GRASSLAND", false, List.of())),
                Optional.empty(),
                "SELECT",
                "GRASSLAND",
                "Oversized loaded.",
                "",
                "");
        HexMapViewModel viewModel = viewModel(oversized);
        assertTrue(!viewModel.mainContentModel().projectionProperty().get().mapLoaded(),
                "HEX-TRAVEL-008 oversized map hides Canvas projection");
        assertContains(viewModel.mainContentModel().projectionProperty().get().emptyText(), "zu gross",
                "HEX-TRAVEL-008 oversized map explains render cap");
        assertEquals(0, viewModel.mainContentModel().tileLayerProperty().get().tiles().size(),
                "HEX-TRAVEL-008 oversized map does not project rendered tiles");
        assertEquals(0, viewModel.mainContentModel().tileLayerProperty().get().hits().size(),
                "HEX-TRAVEL-008 oversized map does not project hit data");
    }

    private static void assertShellBoundContributionRoute() {
        RuntimeSurface runtime = RuntimeSurface.create();
        ShellBinding binding = new HexMapContribution().bind(runtime.shellContext());
        Parent controlsRoot = slot(binding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        HexMapMainView mainView = slot(binding, ShellSlot.COCKPIT_MAIN, HexMapMainView.class);
        HexMapStateView stateView = slot(binding, ShellSlot.COCKPIT_STATE, HexMapStateView.class);
        Stage stage = new Stage();
        HBox root = new HBox(controlsRoot, mainView, stateView);
        try {
            stage.setScene(new Scene(root, 1_260.0, 760.0));
            stage.show();
            layout(root);

            createShellBoundMap(controlsRoot, SHELL_BOUND_MAP_NAME);
            HexEditorSnapshot created = runtime.current();
            HexMapId mapId = selectedMapId(created);
            assertEquals(SHELL_BOUND_MAP_NAME, selectedMap(created).displayName(),
                    "HEX-EDITOR-012 shell-bound create selects new map");
            assertEquals(START_RADIUS, selectedMap(created).radius(),
                    "HEX-EDITOR-012 shell-bound create uses catalog default radius");
            assertContains(labelText(mainView), SHELL_BOUND_MAP_NAME,
                    "HEX-EDITOR-012 shell-bound main slot shows created map");

            mapNameField(stateView).setText(SHELL_BOUND_UPDATED_NAME);
            radiusSpinner(stateView).getValueFactory().setValue(UPDATED_RADIUS);
            mapSaveButton(stateView).fire();
            assertEquals(SHELL_BOUND_UPDATED_NAME, selectedMap(runtime.current()).displayName(),
                    "HEX-EDITOR-012 shell-bound state save updates name");
            assertEquals(UPDATED_RADIUS, selectedMap(runtime.current()).radius(),
                    "HEX-EDITOR-012 shell-bound state save updates radius");

            toggleButtonDescendant(controlsRoot, "Terrain").fire();
            ComboBox<String> terrainSelector = comboBoxByAccessibleText(controlsRoot, "Hex-Terrain");
            selectComboBoxItem(terrainSelector, "Wasser");
            fireComboBoxAction(terrainSelector);
            assertEquals(AUTHORED_TERRAIN, runtime.current().activeTerrain(),
                    "HEX-EDITOR-012 shell-bound terrain control publishes active terrain");
            assertContains(labelText(mainView), "Terrain: Wasser",
                    "HEX-EDITOR-012 shell-bound main slot shows active terrain");
            clickHexTile(mainView, AUTHORED_Q, AUTHORED_R);
            assertTileTerrain(runtime.current(), AUTHORED_Q, AUTHORED_R, AUTHORED_TERRAIN,
                    "HEX-EDITOR-012 shell-bound paint terrain");
            assertEquals(1L, runtime.database().terrainOverrideCount(mapId.value()),
                    "HEX-EDITOR-012 shell-bound paint persists terrain override");

            toggleButtonDescendant(controlsRoot, "Auswahl").fire();
            clickHexTile(mainView, AUTHORED_Q, AUTHORED_R);
            HexEditorSnapshot selected = runtime.current();
            assertEquals(AUTHORED_Q, selected.selectedTile().orElseThrow().q(),
                    "HEX-EDITOR-012 shell-bound select q");
            assertContains(labelText(stateView), "Position: 2,0",
                    "HEX-EDITOR-012 shell-bound state slot shows selected tile");

            toggleButtonDescendant(controlsRoot, "Marker").fire();
            markerNameField(stateView).setText(SHELL_BOUND_MARKER_NAME);
            selectMarkerType(markerTypeSelector(stateView), "LANDMARK");
            markerNoteArea(stateView).setText(MARKER_NOTE);
            markerSaveButton(stateView).fire();
            assertMarker(runtime.current(), SHELL_BOUND_MARKER_NAME, "LANDMARK", MARKER_NOTE,
                    "HEX-EDITOR-012 shell-bound marker save");
            assertEquals(1L, runtime.database().markerCount(mapId.value()),
                    "HEX-EDITOR-012 shell-bound marker save persists one marker");

            runtime.party().createCharacter(new CreateCharacterCommand(
                    new CharacterDraft("Shell Guide", "Player", 3, 12, 14),
                    MembershipState.ACTIVE));
            long characterId = newestActiveMemberId(runtime);
            runtime.party().moveCharacters(new MovePartyCharactersCommand(
                    List.of(characterId),
                    new PartyOverworldTravelLocationSnapshot(
                            mapId.value(),
                            new HexCoordinate(AUTHORED_Q, AUTHORED_R).stableTileId()),
                    true));
            List<Long> partyTokenCharacterIds = runtime.travel().current().partyTokenCharacterIds();
            assertTrue(partyTokenCharacterIds.contains(characterId),
                    "HEX-EDITOR-012 shell-bound travel includes newly positioned party member");
            toggleButtonDescendant(controlsRoot, "Reisegruppe").fire();
            clickHexTile(mainView, 0, 0);
            HexTravelSnapshot moved = runtime.travel().current();
            assertTrue(moved.active(), "HEX-EDITOR-012 shell-bound travel remains active");
            assertEquals(0, moved.q(), "HEX-EDITOR-012 shell-bound travel moved q");
            assertEquals(0, moved.r(), "HEX-EDITOR-012 shell-bound travel moved r");
            assertEquals(partyTokenCharacterIds, moved.partyTokenCharacterIds(),
                    "HEX-EDITOR-012 shell-bound travel preserves party token characters");

            RuntimeSurface reloadedRuntime = RuntimeSurface.create();
            ShellBinding reloadBinding = new HexMapContribution().bind(reloadedRuntime.shellContext());
            slot(reloadBinding, ShellSlot.COCKPIT_MAIN, HexMapMainView.class);
            HexEditorSnapshot reloaded = reloadedRuntime.current();
            assertEquals(SHELL_BOUND_UPDATED_NAME, selectedMap(reloaded).displayName(),
                    "HEX-EDITOR-012 shell-bound reload reads persisted map");
            assertTileTerrain(reloaded, AUTHORED_Q, AUTHORED_R, AUTHORED_TERRAIN,
                    "HEX-EDITOR-012 shell-bound reload reads persisted terrain");
            assertMarker(reloaded, SHELL_BOUND_MARKER_NAME, "LANDMARK", MARKER_NOTE,
                    "HEX-EDITOR-012 shell-bound reload reads persisted marker");
        } finally {
            stage.hide();
        }
    }

    private static void createShellBoundMap(Parent controlsRoot, String mapName) {
        CatalogCrudControlsView catalogView = descendant(controlsRoot, CatalogCrudControlsView.class);
        buttonDescendant(controlsRoot, "Neu").fire();
        Parent operationContent = catalogOperationContent(catalogView);
        descendant(operationContent, TextField.class, "Name").setText(mapName);
        buttonDescendant(operationContent, "Erstellen").fire();
    }

    private static Parent catalogOperationContent(CatalogCrudControlsView catalogView) {
        Object content = catalogView.getProperties().get(CatalogCrudControlsView.OPERATION_CONTENT_PROPERTY);
        if (content instanceof Parent parent) {
            return parent;
        }
        throw new IllegalStateException("Expected Catalog CRUD operation content.");
    }

    private static long newestActiveMemberId(RuntimeSurface runtime) {
        return runtime.partySnapshots().current().snapshot().activeMembers().stream()
                .map(src.domain.party.published.PartyMemberDetails::id)
                .filter(id -> id != null && id > 0L)
                .reduce((first, second) -> second)
                .orElseThrow(() -> new IllegalStateException("Expected active party member id."));
    }

    private static void clickHexTile(HexMapMainView view, int q, int r) {
        Canvas canvas = tileCanvas(view);
        double[] hit = hit(canvas, q, r);
        MouseEvent event = new MouseEvent(
                canvas,
                canvas,
                MouseEvent.MOUSE_CLICKED,
                hit[HIT_CENTER_X],
                hit[HIT_CENTER_Y],
                hit[HIT_CENTER_X],
                hit[HIT_CENTER_Y],
                MouseButton.PRIMARY,
                1,
                false,
                false,
                false,
                false,
                true,
                false,
                false,
                false,
                false,
                false,
                null);
        canvas.fireEvent(event);
    }

    @SuppressWarnings("unchecked")
    private static double[] hit(Canvas canvas, int q, int r) {
        Object rawHits = canvas.getProperties().get(HEX_HITS_PROPERTY);
        List<double[]> hits = rawHits instanceof List<?> ? (List<double[]>) rawHits : List.of();
        return hits.stream()
                .filter(candidate -> ((int) candidate[HIT_Q]) == q && ((int) candidate[HIT_R]) == r)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Expected Hex hit " + q + "," + r + "."));
    }

    private static <T extends Node> T slot(ShellBinding binding, ShellSlot slot, Class<T> type) {
        Node node = binding.slotContent().get(slot);
        if (type.isInstance(node)) {
            return type.cast(node);
        }
        throw new IllegalStateException("Expected " + type.getSimpleName() + " in " + slot + ".");
    }

    private static void layout(Parent root) {
        root.applyCss();
        root.layout();
        for (Node child : root.getChildrenUnmodifiable()) {
            if (child instanceof Parent childParent) {
                layout(childParent);
            }
        }
    }

    private static String labelText(Parent parent) {
        return String.join("\n", labels(parent).stream().map(Label::getText).toList());
    }

    private static void assertVisibleLabelContains(Parent parent, String expectedFragment, String message) {
        boolean found = labels(parent).stream()
                .anyMatch(label -> label.isVisible()
                        && label.isManaged()
                        && label.getText() != null
                        && label.getText().contains(expectedFragment));
        if (!found) {
            throw new IllegalStateException(message + " expected visible label containing <"
                    + expectedFragment + "> but labels were <" + labelText(parent) + ">.");
        }
    }

    private static Canvas tileCanvas(Parent parent) {
        if (parent instanceof javafx.scene.control.ScrollPane scrollPane
                && scrollPane.getContent() instanceof Parent content) {
            return tileCanvas(content);
        }
        for (Node child : parent.getChildrenUnmodifiable()) {
            if (child instanceof Canvas canvas && canvas.getProperties().containsKey(HexMapMainView.KEY_TILE_DRAW_COUNT)) {
                return canvas;
            }
            if (child instanceof Parent childParent) {
                try {
                    return tileCanvas(childParent);
                } catch (IllegalStateException ignored) {
                    // Continue scanning sibling branches.
                }
            }
        }
        throw new IllegalStateException("Expected Hex tile canvas.");
    }

    private static long tileDrawCount(Canvas canvas) {
        Object count = canvas.getProperties().get(HexMapMainView.KEY_TILE_DRAW_COUNT);
        return count instanceof Number number ? number.longValue() : 0L;
    }

    private static List<Label> labels(Parent parent) {
        List<Label> labels = new ArrayList<>();
        collectLabels(parent, labels);
        return labels;
    }

    private static void collectLabels(Node node, List<Label> labels) {
        if (node instanceof Label label) {
            labels.add(label);
        }
        if (node instanceof javafx.scene.control.ScrollPane scrollPane && scrollPane.getContent() != null) {
            collectLabels(scrollPane.getContent(), labels);
        }
        if (node instanceof Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                collectLabels(child, labels);
            }
        }
    }

    private static TextField markerNameField(Parent parent) {
        return descendant(parent, TextField.class, "Markername");
    }

    private static TextField mapNameField(Parent parent) {
        return descendant(parent, TextField.class, "Kartenname");
    }

    private static TextArea markerNoteArea(Parent parent) {
        return descendant(parent, TextArea.class, "Notiz optional");
    }

    private static Button mapSaveButton(Parent parent) {
        return buttonDescendant(parent, "Speichern");
    }

    private static Button markerSaveButton(Parent parent) {
        return buttonDescendant(parent, "Marker speichern");
    }

    private static Spinner<Integer> radiusSpinner(Parent parent) {
        for (Node child : parent.getChildrenUnmodifiable()) {
            if (child instanceof Spinner<?> spinner) {
                @SuppressWarnings("unchecked")
                Spinner<Integer> typedSpinner = (Spinner<Integer>) spinner;
                return typedSpinner;
            }
            if (child instanceof Parent childParent) {
                try {
                    return radiusSpinner(childParent);
                } catch (IllegalStateException ignored) {
                    // Continue scanning sibling branches.
                }
            }
        }
        throw new IllegalStateException("Expected Hex radius spinner.");
    }

    private static ToggleButton reisegruppeToolButton(Parent parent) {
        return toggleButtonDescendant(parent, "Reisegruppe");
    }

    private static ComboBox<String> markerTypeSelector(Parent parent) {
        for (Node child : parent.getChildrenUnmodifiable()) {
            if (child instanceof ComboBox<?> comboBox && containsMarkerTypeValue(comboBox)) {
                @SuppressWarnings("unchecked")
                ComboBox<String> typedComboBox = (ComboBox<String>) comboBox;
                return typedComboBox;
            }
            if (child instanceof Parent childParent) {
                try {
                    return markerTypeSelector(childParent);
                } catch (IllegalStateException ignored) {
                    // Continue scanning sibling branches.
                }
            }
        }
        throw new IllegalStateException("Expected marker type selector.");
    }

    private static boolean containsMarkerTypeValue(ComboBox<?> comboBox) {
        Object value = comboBox.getValue();
        if (value instanceof String label && markerTypeKey(label).equals("SETTLEMENT")) {
            return true;
        }
        return comboBox.getItems().stream()
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .anyMatch(label -> markerTypeKey(label).equals("SETTLEMENT"));
    }

    private static void selectMarkerType(
            ComboBox<String> markerType,
            String key
    ) {
        for (String label : markerType.getItems()) {
            if (key.equals(markerTypeKey(label))) {
                markerType.getSelectionModel().select(label);
                return;
            }
        }
        throw new IllegalStateException("Expected marker type " + key + ".");
    }

    private static String markerTypeKey(String label) {
        String safeLabel = label == null ? "" : label;
        return HexMapVocabularyContentPartModel.MARKER_TYPE_OPTIONS.stream()
                .filter(option -> option.label().equals(safeLabel))
                .map(HexMapVocabularyContentPartModel.Option::key)
                .findFirst()
                .orElse("");
    }

    private static long parseLong(String value) {
        try {
            return Long.parseLong(value == null ? "" : value.trim());
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private static <T extends Node> T descendant(Parent parent, Class<T> type, String promptText) {
        for (Node child : parent.getChildrenUnmodifiable()) {
            if (type.isInstance(child) && promptText.equals(prompt(child))) {
                return type.cast(child);
            }
            if (child instanceof Parent childParent) {
                try {
                    return descendant(childParent, type, promptText);
                } catch (IllegalStateException ignored) {
                    // Continue scanning sibling branches.
                }
            }
        }
        throw new IllegalStateException("Expected control with prompt " + promptText + ".");
    }

    private static Button buttonDescendant(Parent parent, String text) {
        for (Node child : parent.getChildrenUnmodifiable()) {
            if (child instanceof Button button && text.equals(button.getText())) {
                return button;
            }
            if (child instanceof Parent childParent) {
                try {
                    return buttonDescendant(childParent, text);
                } catch (IllegalStateException ignored) {
                    // Continue scanning sibling branches.
                }
            }
        }
        throw new IllegalStateException("Expected button " + text + ".");
    }

    private static ToggleButton toggleButtonDescendant(Parent parent, String text) {
        for (Node child : parent.getChildrenUnmodifiable()) {
            if (child instanceof ToggleButton button && text.equals(button.getText())) {
                return button;
            }
            if (child instanceof Parent childParent) {
                try {
                    return toggleButtonDescendant(childParent, text);
                } catch (IllegalStateException ignored) {
                    // Continue scanning sibling branches.
                }
            }
        }
        throw new IllegalStateException("Expected toggle button " + text + ".");
    }

    private static <T extends Node> T descendant(Parent parent, Class<T> type) {
        for (Node child : parent.getChildrenUnmodifiable()) {
            if (type.isInstance(child)) {
                return type.cast(child);
            }
            if (child instanceof Parent childParent) {
                try {
                    return descendant(childParent, type);
                } catch (IllegalStateException ignored) {
                    // Continue scanning sibling branches.
                }
            }
        }
        throw new IllegalStateException("Expected descendant of type " + type.getSimpleName() + ".");
    }

    private static ComboBox<String> comboBoxByAccessibleText(Parent parent, String accessibleText) {
        for (Node child : parent.getChildrenUnmodifiable()) {
            if (child instanceof ComboBox<?> comboBox && accessibleText.equals(comboBox.getAccessibleText())) {
                @SuppressWarnings("unchecked")
                ComboBox<String> typedComboBox = (ComboBox<String>) comboBox;
                return typedComboBox;
            }
            if (child instanceof Parent childParent) {
                try {
                    return comboBoxByAccessibleText(childParent, accessibleText);
                } catch (IllegalStateException ignored) {
                    // Continue scanning sibling branches.
                }
            }
        }
        throw new IllegalStateException("Expected combo box " + accessibleText + ".");
    }

    private static void selectComboBoxItem(ComboBox<String> comboBox, String displayText) {
        for (String item : comboBox.getItems()) {
            if (displayText.equals(item)) {
                comboBox.getSelectionModel().select(item);
                if (!displayText.equals(comboBox.getValue())) {
                    throw new IllegalStateException("Expected combo box value " + displayText + ".");
                }
                return;
            }
        }
        throw new IllegalStateException("Expected combo box item " + displayText + ".");
    }

    private static void fireComboBoxAction(ComboBox<String> comboBox) {
        if (comboBox.getOnAction() == null) {
            throw new IllegalStateException("Expected combo box action handler.");
        }
        comboBox.getOnAction().handle(new ActionEvent(comboBox, comboBox));
    }

    private static String prompt(Node node) {
        if (node instanceof TextField textField) {
            return textField.getPromptText();
        }
        if (node instanceof TextArea textArea) {
            return textArea.getPromptText();
        }
        return "";
    }

    private static HexMapMainContentModel.Projection mainProjection(HexEditorSnapshot snapshot) {
        return viewModel(snapshot).mainContentModel().projectionProperty().get();
    }

    private static HexMapMainContentModel.Projection mainProjection(
            HexEditorSnapshot snapshot,
            HexTravelSnapshot travel
    ) {
        return viewModel(snapshot, travel).mainContentModel().projectionProperty().get();
    }

    private static HexMapMainContentModel.TileItem mainTileProjection(
            HexEditorSnapshot snapshot,
            int q,
            int r
    ) {
        return viewModel(snapshot).mainContentModel().tileLayerProperty().get().tiles().stream()
                .filter(candidate -> candidate.q() == q && candidate.r() == r)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Expected projected Hex tile " + q + "," + r + "."));
    }

    private static HexMapStateContentModel.Projection stateProjection(HexEditorSnapshot snapshot) {
        return viewModel(snapshot).stateContentModel().currentProjection();
    }

    private static HexMapStateContentModel.Projection stateProjection(
            HexEditorSnapshot snapshot,
            HexTravelSnapshot travel
    ) {
        return viewModel(snapshot, travel).stateContentModel().currentProjection();
    }

    private static HexMapViewModel viewModel(HexEditorSnapshot snapshot) {
        HexMapViewModel viewModel = new HexMapViewModel();
        viewModel.applySnapshot(snapshot);
        return viewModel;
    }

    private static HexMapViewModel viewModel(
            HexEditorSnapshot snapshot,
            HexTravelSnapshot travel
    ) {
        HexMapViewModel viewModel = viewModel(snapshot);
        viewModel.applyTravelSnapshot(travel);
        return viewModel;
    }

    private static HexMapIntentHandler intentHandler(RuntimeSurface runtime, HexMapViewModel viewModel) {
        return new HexMapIntentHandler(runtime.editor(), runtime.hexTravel(), viewModel);
    }

    private static void assertContains(String actual, String expectedFragment, String message) {
        if (actual == null || !actual.contains(expectedFragment)) {
            throw new IllegalStateException(message + " expected to contain <"
                    + expectedFragment + "> but was <" + actual + ">.");
        }
    }

    private static HexMapStateViewInputEvent requiredEvent(
            AtomicReference<HexMapStateViewInputEvent> emitted,
            String message
    ) {
        HexMapStateViewInputEvent event = emitted.get();
        if (event == null) {
            throw new IllegalStateException(message);
        }
        return event;
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!expected.equals(actual)) {
            throw new IllegalStateException(message + " expected <" + expected + "> but was <" + actual + ">.");
        }
    }

    private static void assertTrue(boolean condition, String message) {
        if (!condition) {
            throw new IllegalStateException(message);
        }
    }

    private static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrappedAction = () -> {
            try {
                action.run();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        };
        if (FX_STARTED.compareAndSet(false, true)) {
            Platform.startup(() -> {
                Platform.setImplicitExit(false);
                wrappedAction.run();
            });
        } else {
            Platform.runLater(wrappedAction);
        }
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX Hex Map editor behavior harness.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Hex Map editor behavior harness failed.", failure[0]);
        }
    }

    private static void shutdownFx() throws Exception {
        if (!FX_STARTED.get()) {
            return;
        }
        runOnFxThread(() -> {
            for (Window window : List.copyOf(Window.getWindows())) {
                window.hide();
            }
            Platform.exit();
        });
    }

    private interface ThrowingRunnable {

        void run() throws Exception;
    }

    private enum NoopInspectorSink implements InspectorSink {

        INSTANCE;

        @Override
        public void push(InspectorEntrySpec entry) {
        }

        @Override
        public void clear() {
        }

        @Override
        public boolean isShowing(Object entryKey) {
            return false;
        }
    }

    private record RuntimeSurface(
            ServiceRegistry services,
            HexEditorApplicationService editor,
            HexEditorModel model,
            HexTravelModel travel,
            HexTravelApplicationService hexTravel,
            PartyApplicationService party,
            PartySnapshotModel partySnapshots,
            DatabaseAssertions database
    ) {
        static RuntimeSurface create() {
            ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
            new src.data.hex.HexServiceContribution().register(builder);
            new src.data.party.PartyServiceContribution().register(builder);
            new src.domain.party.PartyServiceContribution().register(builder);
            new src.domain.hex.HexServiceContribution().register(builder);
            ServiceRegistry registry = builder.build();
            return new RuntimeSurface(
                    registry,
                    registry.require(HexEditorApplicationService.class),
                    registry.require(HexEditorModel.class),
                    registry.require(HexTravelModel.class),
                    registry.require(HexTravelApplicationService.class),
                    registry.require(PartyApplicationService.class),
                    registry.require(PartySnapshotModel.class),
                    new DatabaseAssertions());
        }

        ShellRuntimeContext shellContext() {
            return new ShellRuntimeContext(NoopInspectorSink.INSTANCE, services);
        }

        HexEditorSnapshot current() {
            return model.current();
        }
    }

    private static final class DatabaseAssertions {

        private final Path databasePath;

        DatabaseAssertions() {
            String xdgDataHome = System.getenv("XDG_DATA_HOME");
            if (xdgDataHome == null || xdgDataHome.isBlank()) {
                throw new IllegalStateException("XDG_DATA_HOME must isolate the Hex Map editor behavior DB.");
            }
            databasePath = Path.of(
                    xdgDataHome,
                    "salt-marcher",
                    HexPersistenceSchema.DATABASE_FILE_NAME);
        }

        long terrainOverrideCount(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM " + HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE
                            + " WHERE map_id = ?",
                    mapId);
        }

        long markerCount(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM " + HexPersistenceSchema.MARKERS_TABLE
                            + " WHERE map_id = ?",
                    mapId);
        }

        int mapRadius(long mapId) {
            try (Connection connection = open();
                    PreparedStatement statement = connection.prepareStatement(
                            "SELECT radius FROM " + HexPersistenceSchema.MAPS_TABLE
                                    + " WHERE map_id = ?")) {
                statement.setLong(1, mapId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (resultSet.next()) {
                        return resultSet.getInt(1);
                    }
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to inspect Hex map radius.", exception);
            }
            throw new IllegalStateException("Expected Hex map radius row.");
        }

        String mapName(long mapId) {
            try (Connection connection = open();
                    PreparedStatement statement = connection.prepareStatement(
                            "SELECT display_name FROM " + HexPersistenceSchema.MAPS_TABLE
                                    + " WHERE map_id = ?")) {
                statement.setLong(1, mapId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (resultSet.next()) {
                        return resultSet.getString(1);
                    }
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to inspect Hex map name.", exception);
            }
            throw new IllegalStateException("Expected Hex map name row.");
        }

        void installFailingMapUpdateTrigger() {
            execute("CREATE TRIGGER hex_map_update_failure BEFORE UPDATE ON "
                    + HexPersistenceSchema.MAPS_TABLE
                    + " BEGIN SELECT RAISE(FAIL, 'forced Hex map save failure'); END");
        }

        void dropFailingMapUpdateTrigger() {
            execute("DROP TRIGGER IF EXISTS hex_map_update_failure");
        }

        void forceMapRadius(long mapId, int radius) {
            try (Connection connection = open();
                    PreparedStatement statement = connection.prepareStatement(
                            "UPDATE " + HexPersistenceSchema.MAPS_TABLE
                                    + " SET radius = ? WHERE map_id = ?")) {
                statement.setInt(1, radius);
                statement.setLong(2, mapId);
                int updated = statement.executeUpdate();
                if (updated != 1) {
                    throw new IllegalStateException("Expected one Hex map row to corrupt for radius proof.");
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to corrupt Hex map radius for proof.", exception);
            }
        }

        void insertCorruptCatalogMap(long mapId, int radius) {
            try (Connection connection = open();
                    PreparedStatement mapStatement = connection.prepareStatement(
                            "INSERT INTO " + HexPersistenceSchema.MAPS_TABLE
                                    + " (map_id, display_name, radius) VALUES (?, ?, ?)")) {
                mapStatement.setLong(1, mapId);
                mapStatement.setString(2, "Corrupt Catalog Map");
                mapStatement.setInt(3, radius);
                mapStatement.executeUpdate();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to insert corrupt Hex catalog map for proof.", exception);
            }
        }

        private long count(String sql, long mapId) {
            try (Connection connection = open();
                    PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setLong(1, mapId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    return resultSet.next() ? resultSet.getLong(1) : 0L;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to inspect Hex editor behavior DB.", exception);
            }
        }

        private void execute(String sql) {
            try (Connection connection = open();
                    PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.executeUpdate();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to update Hex editor behavior DB.", exception);
            }
        }

        private Connection open() throws SQLException {
            return DriverManager.getConnection("jdbc:sqlite:" + databasePath.toAbsolutePath().normalize());
        }
    }
}
