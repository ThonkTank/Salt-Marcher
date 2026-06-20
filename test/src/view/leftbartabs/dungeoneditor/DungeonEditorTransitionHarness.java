package src.view.leftbartabs.dungeoneditor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import javafx.event.ActionEvent;
import javafx.geometry.Bounds;
import javafx.geometry.Point2D;
import javafx.scene.Parent;
import javafx.scene.control.ButtonBase;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.HBox;
import javafx.stage.Window;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.*;

final class DungeonEditorTransitionHarness {

    private static final String OWNER = "DungeonEditorTransitionHarness";

    private DungeonEditorTransitionHarness() {
    }

    static void run(List<String> results) throws Exception {
        route(results, () -> verifyTransitionCreateThroughMapView(results));
        route(results, () -> verifyTransitionDescriptionThroughStateView(results));
        route(results, () -> verifyBidirectionalTransitionLinkThroughStateView(results));
        route(results, () -> verifyTransitionDeleteThroughMapView(results));
    }

    private static void route(
            List<String> results,
            DungeonEditorBehaviorHarnessSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runRouteProof(results, OWNER, action);
    }

    private static void verifyTransitionDescriptionThroughStateView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Transition Description Map");
        runtime.database().seedTransitionDescriptionFixture(mapId);
        List<String> transitionStableStateBefore = runtime.database().transitionStableState(mapId);
        long transitionId = runtime.database().transitionIdByDescription(mapId, "Initial transition.");
        createMapThroughControls(controls, runtime, "Transition Description Reload Hop");
        selectMap(controls, "Transition Description Map");
        click(button(controls, "Auswahl"));

        DungeonEditorTopologyElementRef transitionRef = new DungeonEditorTopologyElementRef("TRANSITION", transitionId);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D transitionCenter = glyphCenterForRef(binding.mapContentModel(), transitionRef);
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(transitionCenter.getX()),
                viewport.sceneToScreenY(transitionCenter.getY()),
                false);

        DungeonEditorStateSnapshot selectedState = runtime.stateModel().current();
        assertEquals(transitionRef, selectedState.selection().topologyRef(),
                "DE-TRN-004 state model selects transition topology ref");
        assertTrue(selectedState.inspector() != null, "DE-TRN-004 inspector is published for selected transition");
        assertEquals("Initial transition.", selectedState.inspector().summary(),
                "DE-TRN-004 inspector exposes initial transition description");
        assertTrue(!textFieldPresent(stateView, "Korridorpunkt q"),
                "DE-TRN-004 transition marker does not expose the corridor point card");
        TextArea descriptionArea = textArea(stateView, "Übergang Beschreibung");
        assertEquals("Initial transition.", descriptionArea.getText(),
                "DE-TRN-004 state panel exposes transition description");
        descriptionArea.requestFocus();
        descriptionArea.positionCaret("Initial ".length());
        descriptionArea.replaceSelection("draft ");
        descriptionArea = textArea(stateView, "Übergang Beschreibung");
        assertTrue(descriptionArea.isFocused(),
                "DE-TRN-004 runtime draft publication keeps transition description focus");
        assertEquals("Initial draft transition.", descriptionArea.getText(),
                "DE-TRN-004 runtime draft publication keeps middle insertion text");
        assertEquals("Initial draft ".length(), descriptionArea.getCaretPosition(),
                "DE-TRN-004 runtime draft publication keeps transition description caret");
        descriptionArea.setText("Hidden stairwell to the cistern.");
        click(buttonWithAccessibleText(stateView, "Übergang " + transitionId + " speichern"));

        assertEquals(1L, runtime.database().countTransitionDescription(
                        mapId,
                        transitionId,
                        "Hidden stairwell to the cistern."),
                "DE-TRN-004 persists dungeon_transitions.description");
        assertEquals(transitionStableStateBefore, runtime.database().transitionStableState(mapId),
                "DE-TRN-004 leaves transition destination/link/cell state unchanged");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(transitionRef, committedSurface.selection().topologyRef(),
                "DE-TRN-004 map surface keeps transition selected after save");
        assertTrue(committedSurface.surface().map().features().stream().anyMatch(feature ->
                        feature.id() == transitionId
                                && "TRANSITION".equals(feature.kind())
                                && "Hidden stairwell to the cistern.".equals(feature.description())),
                "DE-TRN-004 published feature exposes saved transition description");
        assertEquals("Hidden stairwell to the cistern.", runtime.stateModel().current().inspector().summary(),
                "DE-TRN-004 inspector readback exposes saved transition description");
        assertEquals("Hidden stairwell to the cistern.",
                textArea(stateView, "Übergang Beschreibung").getText(),
                "DE-TRN-004 state panel readback shows saved transition description");
        assertTrue(renderHasSelectedGlyphPrimitive(binding.mapContentModel(), transitionRef),
                "DE-TRN-004 render scene keeps the selected transition marker");
        assertCanvasPaintedAtScene(mapView, transitionCenter.getX(), transitionCenter.getY(),
                "DE-TRN-004 rendered canvas paints the selected transition marker");

        selectMap(controls, "Transition Description Reload Hop");
        selectMap(controls, "Transition Description Map");
        click(button(controls, "Auswahl"));
        Point2D reloadedTransitionCenter = glyphCenterForRef(binding.mapContentModel(), transitionRef);
        DungeonMapContentModel.Viewport reloadedViewport = binding.mapContentModel().currentViewport();
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                reloadedViewport.sceneToScreenX(reloadedTransitionCenter.getX()),
                reloadedViewport.sceneToScreenY(reloadedTransitionCenter.getY()),
                false);
        assertEquals("Hidden stairwell to the cistern.", runtime.stateModel().current().inspector().summary(),
                "DE-TRN-004 reload inspector keeps saved transition description");
        assertEquals("Hidden stairwell to the cistern.",
                textArea(stateView, "Übergang Beschreibung").getText(),
                "DE-TRN-004 reload state panel keeps saved transition description");
        assertTrue(renderHasSelectedGlyphPrimitive(binding.mapContentModel(), transitionRef),
                "DE-TRN-004 reload render keeps selected transition marker");

        results.add("DE-TRN-004 Ready: DungeonEditorStateView transition description save -> SQLite -> readback");
    }


    private static void verifyBidirectionalTransitionLinkThroughStateView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long sourceMapId = createMapThroughControls(controls, runtime, "Transition Link Source Map");
        long targetMapId = createMapThroughControls(controls, runtime, "Transition Link Target Map");
        runtime.database().seedTransitionLinkFixture(sourceMapId, targetMapId);
        long sourceTransitionId = runtime.database().transitionIdByDescription(sourceMapId, "Source transition.");
        long targetTransitionId = runtime.database().transitionIdByDescription(targetMapId, "Target transition.");
        createMapThroughControls(controls, runtime, "Transition Link Reload Hop");
        selectMap(controls, "Transition Link Source Map");
        click(button(controls, "Auswahl"));

        DungeonEditorTopologyElementRef sourceRef =
                new DungeonEditorTopologyElementRef("TRANSITION", sourceTransitionId);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D sourceCenter = glyphCenterForRef(binding.mapContentModel(), sourceRef);
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(sourceCenter.getX()),
                viewport.sceneToScreenY(sourceCenter.getY()),
                false);
        assertEquals(sourceRef, runtime.mapSurfaceModel().current().selection().topologyRef(),
                "DE-TRN-003 entrance-link route selects source transition before linking");
        assertTransitionEntranceLinkCard(stateView);

        List<String> sourceRowsBefore = runtime.database().transitionStableState(sourceMapId);
        List<String> targetRowsBefore = runtime.database().transitionStableState(targetMapId);
        submitTransitionEntranceLink(stateView, targetMapId + 1000L, targetTransitionId, true);
        assertEquals(sourceRowsBefore, runtime.database().transitionStableState(sourceMapId),
                "DE-TRN-003 invalid entrance-link target map leaves source transitions unchanged");
        assertEquals(targetRowsBefore, runtime.database().transitionStableState(targetMapId),
                "DE-TRN-003 invalid entrance-link target map leaves target transitions unchanged");
        assertEquals(sourceRef, runtime.mapSurfaceModel().current().selection().topologyRef(),
                "DE-TRN-003 invalid entrance-link target map keeps source selected");
        assertTransitionEntranceLinkDraft(
                stateView,
                targetMapId + 1000L,
                targetTransitionId,
                "DE-TRN-003 invalid target-map rejection keeps entrance-link draft visible");

        ComboBox<?> entranceDestinationType = comboBox(stateView, "Eingangslink Zieltyp");
        entranceDestinationType.requestFocus();
        selectComboItem(entranceDestinationType, "DUNGEON_MAP");
        entranceDestinationType = comboBox(stateView, "Eingangslink Zieltyp");
        assertTrue(entranceDestinationType.isFocused(),
                "DE-TRN-003 runtime draft publication keeps entrance-link destination-type focus");
        assertEquals("DUNGEON_MAP", String.valueOf(entranceDestinationType.getValue()),
                "DE-TRN-003 runtime draft publication keeps entrance-link destination type");
        textField(stateView, "Eingangslink Zielkarte").setText(Long.toString(targetMapId));
        TextField targetTransitionField = textField(stateView, "Eingangslink Zieluebergang");
        targetTransitionField.requestFocus();
        targetTransitionField.selectAll();
        targetTransitionField.replaceSelection(Long.toString(targetTransitionId + 1000L));
        targetTransitionField = textField(stateView, "Eingangslink Zieluebergang");
        assertTrue(targetTransitionField.isFocused(),
                "DE-TRN-003 runtime draft publication keeps entrance-link transition focus");
        assertEquals(Long.toString(targetTransitionId + 1000L), targetTransitionField.getText(),
                "DE-TRN-003 runtime draft publication keeps entrance-link transition text");
        assertEquals(Long.toString(targetTransitionId + 1000L).length(), targetTransitionField.getCaretPosition(),
                "DE-TRN-003 runtime draft publication keeps entrance-link transition caret");
        CheckBox bidirectionalBox = checkBox(stateView, "Ruecklink zum ausgewaehlten Eingang speichern");
        bidirectionalBox.requestFocus();
        if (!bidirectionalBox.isSelected()) {
            click(bidirectionalBox);
        }
        bidirectionalBox = checkBox(stateView, "Ruecklink zum ausgewaehlten Eingang speichern");
        assertTrue(bidirectionalBox.isFocused(),
                "DE-TRN-003 runtime draft publication keeps entrance-link bidirectional focus");
        assertTrue(bidirectionalBox.isSelected(),
                "DE-TRN-003 runtime draft publication keeps entrance-link bidirectional value");
        click(button(stateView, "Eingangslink speichern"));
        assertEquals(sourceRowsBefore, runtime.database().transitionStableState(sourceMapId),
                "DE-TRN-003 invalid entrance-link target transition leaves source transitions unchanged");
        assertEquals(targetRowsBefore, runtime.database().transitionStableState(targetMapId),
                "DE-TRN-003 invalid entrance-link target transition leaves target transitions unchanged");
        assertEquals(sourceRef, runtime.mapSurfaceModel().current().selection().topologyRef(),
                "DE-TRN-003 invalid entrance-link target transition keeps source selected");
        assertTransitionEntranceLinkDraft(
                stateView,
                targetMapId,
                targetTransitionId + 1000L,
                "DE-TRN-003 invalid target-transition rejection keeps entrance-link draft visible");

        submitTransitionEntranceLink(stateView, targetMapId, targetTransitionId, true);
        assertTransitionRowContains(
                runtime.database().transitionStableState(sourceMapId),
                sourceTransitionId,
                List.of(
                        "destination_type=DUNGEON_MAP",
                        "target_overworld_map_id=<null>",
                        "target_overworld_tile_id=<null>",
                        "target_dungeon_map_id=" + targetMapId,
                        "target_transition_id=" + targetTransitionId,
                        "linked_transition_id=<null>"),
                "DE-TRN-003 source transition row targets T2");
        assertTransitionRowContains(
                runtime.database().transitionStableState(targetMapId),
                targetTransitionId,
                List.of("linked_transition_id=" + sourceTransitionId),
                "DE-TRN-003 target transition row links back to T1");
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(sourceMapId, sourceTransitionId),
                "DE-TRN-003 source transition topology ref remains stable");
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(targetMapId, targetTransitionId),
                "DE-TRN-003 target transition topology ref remains stable");

        String destinationLabel = "Dungeon " + targetMapId + " / Übergang " + targetTransitionId;
        DungeonEditorMapSurfaceSnapshot sourceSurface = runtime.mapSurfaceModel().current();
        assertEquals(sourceRef, sourceSurface.selection().topologyRef(),
                "DE-TRN-003 entrance-link source selection remains after save");
        assertEquals(DungeonEditorPreview.none(), sourceSurface.preview(),
                "DE-TRN-003 entrance-link save clears preview");
        assertTransitionCreatedInSnapshot(
                sourceSurface,
                binding.mapContentModel(),
                sourceTransitionId,
                5,
                2,
                0,
                5.5,
                2.5,
                destinationLabel,
                "DE-TRN-003 committed entrance link");

        selectMap(controls, "Transition Link Reload Hop");
        selectMap(controls, "Transition Link Source Map");
        assertTransitionCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                sourceTransitionId,
                5,
                2,
                0,
                5.5,
                2.5,
                destinationLabel,
                "DE-TRN-003 reloaded entrance link");

        selectMap(controls, "Transition Link Target Map");
        DungeonEditorTopologyElementRef targetRef =
                new DungeonEditorTopologyElementRef("TRANSITION", targetTransitionId);
        assertTransitionCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                targetTransitionId,
                6,
                2,
                0,
                6.5,
                2.5,
                "Overworld-Feld 88",
                "DE-TRN-003 target marker remains selectable after source reload");
        click(button(controls, "Auswahl"));
        Point2D targetCenter = glyphCenterForRef(binding.mapContentModel(), targetRef);
        DungeonMapContentModel.Viewport targetViewport = binding.mapContentModel().currentViewport();
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                targetViewport.sceneToScreenX(targetCenter.getX()),
                targetViewport.sceneToScreenY(targetCenter.getY()),
                false);
        assertEquals(targetRef, runtime.mapSurfaceModel().current().selection().topologyRef(),
                "DE-TRN-003 target entrance remains selectable");
        assertSelectedTransitionKeepsOverworldDestinationSurface(stateView);

        List<String> protectedTargetRowsBefore = runtime.database().transitionStableState(targetMapId);
        click(button(controls, "Übergang"));
        clickMap(
                mapView,
                MouseButton.SECONDARY,
                targetViewport.sceneToScreenX(targetCenter.getX()),
                targetViewport.sceneToScreenY(targetCenter.getY()),
                false);
        assertEquals(protectedTargetRowsBefore, runtime.database().transitionStableState(targetMapId),
                "DE-TRN-003 linked target delete protection leaves target transition rows unchanged");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), targetRef, 6.5, 2.5, false),
                "DE-TRN-003 linked target entrance remains rendered after protected delete");

        results.add("DE-TRN-003 Ready: DungeonEditorStateView entrance-link save -> SQLite source/target"
                + " persisted destination/link fields -> snapshot/render/reload/delete protection");
    }

    private static void assertTransitionEntranceLinkCard(DungeonEditorStateView stateView) {
        assertTransitionStateTextPresent(stateView, "Übergang-Ziel / Eingangslink");
        assertTransitionStateTextPresent(stateView, "Quelle: ausgewaehlter Übergang");
        assertTransitionStateTextPresent(stateView, "Eingangslink: Zieltyp DUNGEON_MAP und Ziel-Eingang wählen");
        assertTransitionStateTextPresent(stateView, "Ziel-Eingang");
        assertTrue(button(stateView, "Eingangslink speichern").isVisible(),
                "DE-TRN-003 entrance-link route exposes the selected-source save button");
        assertTrue(buttonWithAccessibleText(stateView, "Übergang-Ziel / Eingangslink speichern").isVisible(),
                "DE-TRN-003 entrance-link route exposes the selected-source accessible save action");
        ComboBox<?> destinationType = comboBox(stateView, "Eingangslink Zieltyp");
        assertTrue(destinationType.isVisible(),
                "DE-TRN-003 entrance-link route keeps target type visible for honest selected-transition readback");
        assertTrue(comboBoxContainsDisplayText(destinationType, "OVERWORLD_TILE"),
                "DE-TRN-003 entrance-link route exposes overworld destination option");
        assertTrue(comboBoxContainsDisplayText(destinationType, "DUNGEON_MAP"),
                "DE-TRN-003 entrance-link route exposes dungeon destination option");
        assertTrue(textField(stateView, "Eingangslink Zielkarte").isVisible(),
                "DE-TRN-003 entrance-link route exposes the target-map field");
        assertTrue(textField(stateView, "Eingangslink Zielkachel").isVisible(),
                "DE-TRN-003 entrance-link route keeps overworld tile target input visible");
        assertTrue(textField(stateView, "Eingangslink Zieluebergang").isVisible(),
                "DE-TRN-003 entrance-link route exposes the target-transition field");
        assertTrue(checkBox(stateView, "Ruecklink zum ausgewaehlten Eingang speichern").isVisible(),
                "DE-TRN-003 entrance-link route exposes the reverse-link toggle");
    }

    private static void assertTransitionEntranceLinkDraft(
            DungeonEditorStateView stateView,
            long targetMapId,
            long targetTransitionId,
            String message
    ) {
        assertTransitionEntranceLinkCard(stateView);
        assertEquals("DUNGEON_MAP", String.valueOf(comboBox(stateView, "Eingangslink Zieltyp").getValue()),
                message + " target type");
        assertEquals(Long.toString(targetMapId), textField(stateView, "Eingangslink Zielkarte").getText(),
                message + " target map");
        assertEquals(Long.toString(targetTransitionId), textField(stateView, "Eingangslink Zieluebergang").getText(),
                message + " target transition");
    }

    private static void assertSelectedTransitionKeepsOverworldDestinationSurface(DungeonEditorStateView stateView) {
        assertTransitionStateTextPresent(stateView, "Übergang-Ziel / Eingangslink");
        assertTransitionStateTextAbsent(stateView, "Dungeon-Eingangslink");
        ComboBox<?> destinationType = comboBox(stateView, "Eingangslink Zieltyp");
        assertTrue(destinationType.isVisible(),
                "DE-TRN-003 selected overworld-backed transition keeps visible target type");
        assertEquals("OVERWORLD_TILE", String.valueOf(destinationType.getValue()),
                "DE-TRN-003 selected overworld-backed transition does not masquerade as dungeon map");
        assertEquals("77", textField(stateView, "Eingangslink Zielkarte").getText(),
                "DE-TRN-003 selected overworld-backed transition reads persisted overworld map");
        assertEquals("88", textField(stateView, "Eingangslink Zielkachel").getText(),
                "DE-TRN-003 selected overworld-backed transition reads persisted overworld tile");
        assertEquals("", textField(stateView, "Eingangslink Zieluebergang").getText(),
                "DE-TRN-003 selected overworld-backed transition has no dungeon target transition");
        assertTrue(textField(stateView, "Eingangslink Zielkachel").isVisible(),
                "DE-TRN-003 selected overworld-backed transition keeps tile target field visible");
        assertTrue(textField(stateView, "Eingangslink Zielkarte").isDisabled(),
                "DE-TRN-003 selected overworld-backed transition map readback is not an unsaveable edit");
        assertTrue(textField(stateView, "Eingangslink Zielkachel").isDisabled(),
                "DE-TRN-003 selected overworld-backed transition tile readback is not an unsaveable edit");
    }

    private static void submitTransitionEntranceLink(
            DungeonEditorStateView stateView,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        selectComboItem(comboBox(stateView, "Eingangslink Zieltyp"), "DUNGEON_MAP");
        textField(stateView, "Eingangslink Zielkarte").setText(Long.toString(targetMapId));
        textField(stateView, "Eingangslink Zieluebergang").setText(Long.toString(targetTransitionId));
        CheckBox bidirectionalBox = checkBox(stateView, "Ruecklink zum ausgewaehlten Eingang speichern");
        if (bidirectionalBox.isSelected() != bidirectional) {
            click(bidirectionalBox);
        }
        click(button(stateView, "Eingangslink speichern"));
    }

    private static void assertTransitionStateTextPresent(Parent parent, String expectedText) {
        boolean found = descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .anyMatch(label -> expectedText.equals(label.getText()) && label.isVisible());
        assertTrue(found, "Visible state-panel text present: " + expectedText);
    }

    private static void assertTransitionStateTextAbsent(Parent parent, String unexpectedText) {
        boolean found = descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .anyMatch(label -> unexpectedText.equals(label.getText()) && label.isVisible());
        assertTrue(!found, "Visible state-panel text absent: " + unexpectedText);
    }


    private static void verifyTransitionCreateThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Transition Create Map");
        runtime.database().seedF6MultiLevelFloors(mapId);
        long reloadHopMapId = createMapThroughControls(controls, runtime, "Transition Create Reload Hop");
        runtime.database().seedGlobalTransitionIdentitySentinel(reloadHopMapId);
        long globalTransitionIdBefore = runtime.database().maxTransitionId();
        selectMap(controls, "Transition Create Map");
        assertTrue(runtime.database().transitionStableState(mapId).isEmpty(),
                "DE-TRN-001 fixture starts without transition rows");

        click(button(controls, "Übergang"));
        assertEquals("TRANSITION_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-TRN-001 transition family selects transition creation");
        ComboBox<?> destinationType = comboBox(stateView, "Übergang Zieltyp");
        assertTrue(comboBoxContainsDisplayText(destinationType, "OVERWORLD_TILE"),
                "DE-TRN-001 destination surface exposes overworld destination option");
        assertTrue(comboBoxContainsDisplayText(destinationType, "DUNGEON_MAP"),
                "DE-TRN-001 destination surface exposes dungeon destination option");
        destinationType.requestFocus();
        selectComboItem(destinationType, "DUNGEON_MAP");
        destinationType = comboBox(stateView, "Übergang Zieltyp");
        assertTrue(destinationType.isFocused(),
                "DE-TRN-001 runtime draft publication keeps create destination-type focus");
        assertEquals("DUNGEON_MAP", String.valueOf(destinationType.getValue()),
                "DE-TRN-001 runtime draft publication keeps create destination type");
        selectComboItem(destinationType, "OVERWORLD_TILE");
        destinationType = comboBox(stateView, "Übergang Zieltyp");
        assertTrue(destinationType.isFocused(),
                "DE-TRN-001 runtime draft publication keeps create destination-type focus after second change");
        assertEquals("OVERWORLD_TILE", String.valueOf(destinationType.getValue()),
                "DE-TRN-001 runtime draft publication keeps create overworld destination type");
        TextField destinationMapField = textField(stateView, "Übergang Zielkarte");
        destinationMapField.requestFocus();
        destinationMapField.positionCaret(0);
        destinationMapField.replaceSelection("77");
        destinationMapField = textField(stateView, "Übergang Zielkarte");
        assertTrue(destinationMapField.isFocused(),
                "DE-TRN-001 runtime draft publication keeps create target-map focus");
        assertEquals("77", destinationMapField.getText(),
                "DE-TRN-001 runtime draft publication keeps create target-map text");
        assertEquals(2, destinationMapField.getCaretPosition(),
                "DE-TRN-001 runtime draft publication keeps create target-map caret");
        textField(stateView, "Übergang Zielkachel").setText("88");
        assertEquals("88", textField(stateView, "Übergang Zielkachel").getText(),
                "DE-TRN-001 runtime draft publication keeps create target-tile text");
        textField(stateView, "Übergang Zieluebergang").setText("");

        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(5.5),
                viewport.sceneToScreenY(2.5),
                false);

        long transitionId = runtime.database().transitionIdAt(mapId, 5, 2, 0);
        assertTrue(transitionId > globalTransitionIdBefore,
                "DE-TRN-001 allocates transition id from global SQLite identity state, not selected-map rows");
        List<String> stableRowsAfter = runtime.database().transitionStableState(mapId);
        assertTrue(stableRowsAfter.stream().anyMatch(row -> row.startsWith("dungeon_transitions|transition_id=" + transitionId)
                        && row.contains("|cell_x=5")
                        && row.contains("|cell_y=2")
                        && row.contains("|level_z=0")
                        && row.contains("|destination_type=OVERWORLD_TILE")
                        && row.contains("|target_overworld_map_id=77")
                        && row.contains("|target_overworld_tile_id=88")),
                "DE-TRN-001 persists transition cell and overworld destination: " + stableRowsAfter);
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                "DE-TRN-001 persists stable transition topology ref");
        DungeonEditorTopologyElementRef transitionRef = new DungeonEditorTopologyElementRef("TRANSITION", transitionId);
        assertTransitionCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                transitionId,
                5,
                2,
                0,
                5.5,
                2.5,
                "Overworld-Feld 88",
                "DE-TRN-001 committed create");

        selectMap(controls, "Transition Create Reload Hop");
        selectMap(controls, "Transition Create Map");
        assertEquals(stableRowsAfter, runtime.database().transitionStableState(mapId),
                "DE-TRN-001 reload keeps transition stable rows");
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                "DE-TRN-001 reload keeps transition topology ref");
        assertTransitionCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                transitionId,
                5,
                2,
                0,
                5.5,
                2.5,
                "Overworld-Feld 88",
                "DE-TRN-001 reload");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), transitionRef, 5.5, 2.5, false),
                "DE-TRN-001 reload render keeps committed transition marker");

        results.add("DE-TRN-001 Ready: DungeonEditorControlsView Übergang + DungeonEditorStateView destination"
                + " -> DungeonMapView primary create -> SQLite transition/topology -> render");
    }


    private static void verifyTransitionDeleteThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Transition Delete Map");
        runtime.database().seedTransitionDescriptionFixture(mapId);
        long transitionId = runtime.database().transitionIdByDescription(mapId, "Initial transition.");
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                "DE-TRN-002 fixture starts with one transition topology ref");
        createMapThroughControls(controls, runtime, "Transition Delete Reload Hop");
        selectMap(controls, "Transition Delete Map");

        DungeonEditorTopologyElementRef transitionRef = new DungeonEditorTopologyElementRef("TRANSITION", transitionId);
        Point2D transitionCenter = glyphCenterForRef(binding.mapContentModel(), transitionRef);
        assertEquals("HANDLE", binding.mapContentModel()
                        .resolvePointerTarget(transitionCenter.getX(), transitionCenter.getY())
                        .targetKind()
                        .name(),
                "DE-TRN-002 transition marker resolves as a real map pointer target");
        assertEquals("TRANSITION", binding.mapContentModel()
                        .resolvePointerTarget(transitionCenter.getX(), transitionCenter.getY())
                        .topologyKind(),
                "DE-TRN-002 transition marker carries a transition topology ref");
        click(button(controls, "Übergang"));
        assertEquals("TRANSITION_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-TRN-002 transition family selects the transition family tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        clickMap(
                mapView,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(transitionCenter.getX()),
                viewport.sceneToScreenY(transitionCenter.getY()),
                false);

        assertEquals(0L, runtime.database().countTransitionById(mapId, transitionId),
                "DE-TRN-002 deletes the selected dungeon_transitions row");
        assertEquals(0L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                "DE-TRN-002 deletes the selected transition topology ref");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEmptySelection(committedSurface.selection(), "DE-TRN-002 map surface after transition delete");
        assertEmptySelection(runtime.stateModel().current().selection(), "DE-TRN-002 state after transition delete");
        assertTrue(committedSurface.surface().map().features().stream().noneMatch(feature ->
                        feature.id() == transitionId && "TRANSITION".equals(feature.kind())),
                "DE-TRN-002 published feature list omits the deleted transition");
        assertTrue(!renderHasGlyphAt(binding.mapContentModel(), transitionRef, transitionCenter.getX(), transitionCenter.getY(), false),
                "DE-TRN-002 render scene omits the deleted transition marker");

        selectMap(controls, "Transition Delete Reload Hop");
        selectMap(controls, "Transition Delete Map");
        assertEquals(0L, runtime.database().countTransitionById(mapId, transitionId),
                "DE-TRN-002 reload readback keeps the transition deleted");
        assertEquals(0L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                "DE-TRN-002 reload readback keeps the transition topology ref deleted");
        assertTrue(runtime.mapSurfaceModel().current().surface().map().features().stream().noneMatch(feature ->
                        feature.id() == transitionId && "TRANSITION".equals(feature.kind())),
                "DE-TRN-002 reload snapshot keeps the transition absent");

        long selectedLinkedMapId = createMapThroughControls(controls, runtime, "Transition Delete Selected Linked Map");
        verifyTransitionDeleteRejectedThroughMapView(
                "DE-TRN-002 selected linked rejection",
                "Transition Delete Selected Linked Map",
                database -> database.seedSelectedLinkedTransitionFixture(selectedLinkedMapId),
                controls,
                runtime,
                binding,
                mapView,
                selectedLinkedMapId,
                "Selected linked transition.");
        long reverseLinkedMapId = createMapThroughControls(controls, runtime, "Transition Delete Reverse Linked Map");
        verifyTransitionDeleteRejectedThroughMapView(
                "DE-TRN-002 reverse linked rejection",
                "Transition Delete Reverse Linked Map",
                database -> database.seedReverseLinkedTransitionFixture(reverseLinkedMapId),
                controls,
                runtime,
                binding,
                mapView,
                reverseLinkedMapId,
                "Reverse linked target transition.");
        long destinationReferenceMapId = createMapThroughControls(
                controls,
                runtime,
                "Transition Delete Destination Reference Map");
        verifyTransitionDeleteRejectedThroughMapView(
                "DE-TRN-002 dungeon destination rejection",
                "Transition Delete Destination Reference Map",
                database -> database.seedDestinationReferenceTransitionFixture(destinationReferenceMapId),
                controls,
                runtime,
                binding,
                mapView,
                destinationReferenceMapId,
                "Destination target transition.");

        results.add("DE-TRN-002 Ready: DungeonEditorControlsView Übergang -> DungeonMapView secondary transition delete"
                + "/reject -> SQLite delete/readback/topology -> render absence");
    }


    private static void verifyTransitionDeleteRejectedThroughMapView(
            String scenario,
            String mapName,
            DatabaseFixtureSeeder seeder,
            DungeonEditorControlsView controls,
            HarnessRuntime runtime,
            HarnessBinding binding,
            DungeonMapView mapView,
            long mapId,
            String selectedDescription
    ) {
        seeder.seed(runtime.database());
        createMapThroughControls(controls, runtime, mapName + " Reload Hop");
        selectMap(controls, mapName);
        long transitionId = runtime.database().transitionIdByDescription(mapId, selectedDescription);
        DungeonEditorTopologyElementRef transitionRef = new DungeonEditorTopologyElementRef("TRANSITION", transitionId);
        Point2D transitionCenter = glyphCenterForRef(binding.mapContentModel(), transitionRef);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        DungeonEditorMapSurfaceSnapshot surfaceBefore = runtime.mapSurfaceModel().current();
        assertEquals(1L, runtime.database().countTransitionById(mapId, transitionId),
                scenario + " fixture starts with selected transition row");
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                scenario + " fixture starts with selected topology ref");

        click(button(controls, "Übergang"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        clickMap(
                mapView,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(transitionCenter.getX()),
                viewport.sceneToScreenY(transitionCenter.getY()),
                false);

        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                scenario + " leaves authored DB rows unchanged");
        assertEquals(1L, runtime.database().countTransitionById(mapId, transitionId),
                scenario + " keeps selected transition row");
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                scenario + " keeps selected topology ref");
        assertEquals(surfaceBefore.surface().map(), runtime.mapSurfaceModel().current().surface().map(),
                scenario + " keeps published map stable");
        assertEquals(surfaceBefore.selection(), runtime.mapSurfaceModel().current().selection(),
                scenario + " keeps selection stable");
        assertEquals(surfaceBefore.projectionLevel(), runtime.mapSurfaceModel().current().projectionLevel(),
                scenario + " keeps projection level stable");
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                scenario + " keeps preview empty");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), transitionRef, transitionCenter.getX(), transitionCenter.getY(), false),
                scenario + " keeps rendered transition marker");
    }

}
