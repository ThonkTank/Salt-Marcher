package features.sessionplanner.adapter.javafx;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.CompletableFuture;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonBase;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuButton;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import javafx.stage.Window;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellSlot;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.worldplanner.adapter.sqlite.repository.SqliteWorldPlannerRepository;
import features.sessionplanner.adapter.sqlite.mapper.SessionPlanMapper;
import features.sessionplanner.adapter.sqlite.model.SessionEncounterRecord;
import features.sessionplanner.adapter.sqlite.model.SessionLootPlaceholderRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlanRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlanSnapshotRecord;
import features.encounter.application.EncounterApplicationService;
import features.encounter.application.EncounterApplicationServiceFakes;
import features.encounter.api.EncounterPlanBudgetModel;
import features.encounter.api.EncounterPlanBudgetResult;
import features.encounter.api.EncounterPlanBudgetStatus;
import features.encounter.api.EncounterPlanBudgetSummary;
import features.encounter.api.GeneratedEncounterPlanImportResult;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.encounter.api.SavedEncounterPlanSummary;
import features.party.api.PartyApi;
import features.party.PartyServiceAssembly;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.sessionplanner.api.SessionPlannerCatalogModel;
import features.sessionplanner.api.SessionPlannerCatalogCommand;
import features.sessionplanner.api.SessionPlannerCatalogSnapshot;
import features.sessionplanner.api.SessionPlannerCurrentSessionModel;
import features.sessionplanner.api.SessionPlannerParticipantsModel;
import features.sessionplanner.api.SessionPlannerRestKind;
import features.sessionplanner.api.SessionPlannerSceneTimelineProjection;
import features.sessionplanner.api.SessionPlannerSessionSnapshot;
import features.sessionplanner.api.SessionGenerationPreviewModel;
import features.sessionplanner.api.SessionGenerationPreviewSnapshot;
import features.sessionplanner.api.SessionGenerationPreviewStatus;
import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationResponse;
import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.SessionGenerationApi;
import features.worldplanner.application.WorldPlannerApplicationService;
import features.worldplanner.WorldPlannerServiceAssembly;
import features.worldplanner.domain.world.port.WorldPlannerReferencePort;
import features.worldplanner.api.CreateWorldLocationCommand;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldPlannerSnapshotModel;

@org.junit.jupiter.api.Tag("ui")
public final class SessionPlannerCatalogTest {

    private static final int AWAIT_SECONDS = 60;
    private static final long SAVED_ENCOUNTER_PLAN_ID = 501L;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @AfterEach
    void hideWindows() throws Exception {
        runOnFxThread(SessionPlannerCatalogTest::hideOpenWindows);
    }

    @AfterAll
    static void shutdownJavaFx() throws Exception {
        shutdownFx();
    }

    @Test
    void SESSION_PLANNER_CATALOG_001() throws Exception {
        runOnFxThread(SessionPlannerCatalogTest::runTest);
    }

    @Test
    void generationInputsAreDisabledWhileApplyIsInFlight() throws Exception {
        runOnFxThread(SessionPlannerCatalogTest::assertApplyingInputsDisabled);
    }

    private static void assertApplyingInputsDisabled() {
        SessionGenerationPanel panel = new SessionGenerationPanel();
        panel.setSessionActive(true);
        SessionGenerationPreviewSnapshot applying = new SessionGenerationPreviewSnapshot(
                SessionGenerationPreviewStatus.APPLYING,
                "Generierte Session wird angewandt …",
                7L,
                "run-179974",
                179_974L,
                "10e7b8c2f3d43c0868e2ce0c3bf8471b72ed4d5327fc633452e0245d32f416f6",
                SessionGenerationPreviewSnapshot.Summary.empty(),
                List.of(),
                List.of(),
                List.of(),
                4L,
                false);
        panel.bind(new SessionGenerationPreviewModel(() -> applying, listener -> () -> { }));

        assertTrue(textField(panel, "Auto").isDisabled(), "encounter-count input is disabled while applying");
        assertTrue(button(panel, "Session generieren").isDisabled(), "generate action is disabled while applying");
    }

    private static void runTest() {
        SessionPlannerTestServices services = services();
        long locationId = seedLocation(services);
        SessionPlannerServiceAssembly planner = services.planner();
        ShellBinding binding = new SessionPlannerContribution(
                planner.application(), planner.currentSessionModel(), planner.catalogModel(),
                planner.participantsModel(), planner.sceneTimelineModel(), planner.statePanelModel(),
                planner.generationPreviewModel()).bind();
        Parent controls = slot(binding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        Parent main = slot(binding, ShellSlot.COCKPIT_MAIN, Parent.class);
        Parent state = slot(binding, ShellSlot.COCKPIT_STATE, Parent.class);
        SessionPlannerCatalogModel catalog = planner.catalogModel();
        SessionPlannerCurrentSessionModel current = planner.currentSessionModel();
        features.sessionplanner.api.SessionPlannerSceneTimelineModel sceneTimeline =
                planner.sceneTimelineModel();
        SessionPlannerParticipantsModel participants = planner.participantsModel();

        Stage stage = new Stage();
        HBox root = new HBox(controls, main, state);
        stage.setScene(new Scene(root, 1_260.0, 760.0));
        stage.show();
        layout(root);

        assertSetupLivesInControls(controls);
        assertSceneLootTargetsSceneCards();
        assertCatalogSize(catalog.current(), 0, "initial catalog is empty");
        assertTrue(!hasLabel(main, "Session #0"), "initial main does not show default Session #0");
        assertTrue(button(controls, "Setzen").isDisabled(), "initial setup disables session mutation");
        encounterDaysField(controls).setText("2");
        button(controls, "Setzen").fire();
        assertCatalogSize(catalog.current(), 0, "session-bound action before create does not seed a session");

        createSession(controls, "Alpha");
        SessionPlannerCatalogSnapshot afterAlpha = catalog.current();
        assertCatalogSize(afterAlpha, 1, "create adds first session");
        long alphaId = only(afterAlpha).sessionId();
        assertEquals("Alpha", only(afterAlpha).displayName(), "create stores display name");
        assertEquals(alphaId, afterAlpha.selectedSessionId(), "create selects new session");
        assertEquals("Alpha", current.current().session().displayName(), "current session display name after create");

        encounterDaysField(controls).setText("2");
        button(controls, "Setzen").fire();
        assertEquals("2", current.current().session().encounterDaysText(), "session content mutation before rename");

        button(main, "+ Szene").fire();
        layout(main);
        assertEquals(Integer.valueOf(1), Integer.valueOf(sceneTimeline.current().sessionScenes().size()),
                "add scene creates one session scene");
        assertEquals(Long.valueOf(0L),
                Long.valueOf(sceneTimeline.current().sessionScenes().getFirst().linkedEncounterPlanId()),
                "added scene has no linked encounter plan");
        selectScene(main, 0);
        assertTrue(hasLabel(main, "Keine Begegnung verknüpft."), "selected blank scene shows no false encounter data");
        buttonByAccessibleText(main, "Szene entfernen").fire();
        layout(main);
        assertEquals(Integer.valueOf(0), Integer.valueOf(sceneTimeline.current().sessionScenes().size()),
                "scene remove clears the session scene representation");

        renameSelectedSession(controls, "Alpha Prime");
        SessionPlannerSessionSnapshot renamedCurrent = current.current();
        assertEquals("Alpha Prime", renamedCurrent.session().displayName(), "rename updates display name");
        assertEquals("2", renamedCurrent.session().encounterDaysText(), "rename preserves session content");

        createSession(controls, "Beta");
        SessionPlannerCatalogSnapshot afterBeta = catalog.current();
        assertCatalogSize(afterBeta, 2, "second create adds catalog row");
        long betaId = afterBeta.selectedSessionId();
        assertEquals("Beta", current.current().session().displayName(), "second create selects Beta");

        selectSession(controls, alphaId);
        assertEquals(alphaId, catalog.current().selectedSessionId(), "select updates catalog selected id");
        assertEquals("Alpha Prime", current.current().session().displayName(), "select loads renamed session");
        assertEquals("2", current.current().session().encounterDaysText(), "select preserves renamed session content");

        deleteSelectedSession(controls);
        SessionPlannerCatalogSnapshot afterDeleteAlpha = catalog.current();
        assertCatalogSize(afterDeleteAlpha, 1, "delete removes selected session");
        assertEquals(betaId, afterDeleteAlpha.selectedSessionId(), "delete falls back to remaining stable session");
        assertEquals("Beta", current.current().session().displayName(), "delete fallback loads remaining session");

        deleteSelectedSession(controls);
        SessionPlannerCatalogSnapshot afterDeleteLast = catalog.current();
        assertCatalogSize(afterDeleteLast, 1, "delete last session seeds replacement session");
        assertTrue(afterDeleteLast.selectedSessionId() > 0L, "replacement session uses a stable id");
        assertEquals(afterDeleteLast.selectedSessionId(), current.current().session().sessionId(),
                "replacement session is current");
        assertTrue(!"Beta".equals(current.current().session().displayName()), "replacement session is seeded");

        createSession(controls, "Gamma");
        SessionPlannerCatalogSnapshot afterCreatePostDelete = catalog.current();
        assertCatalogSize(afterCreatePostDelete, 2, "create after delete-last adds a new session");
        assertEquals("Gamma", current.current().session().displayName(), "create after delete-last selects Gamma");
        assertTrue(afterCreatePostDelete.sessions().stream().anyMatch(session -> "Gamma".equals(session.displayName())),
                "create after delete-last publishes Gamma");
        assertProductionRouteTimelineInteractions(
                services,
                controls,
                main,
                current,
                participants,
                sceneTimeline,
                locationId);
        assertProductionRouteGeneratedSession(controls, main, participants, sceneTimeline);
    }

    private static void createSession(Parent controls, String name) {
        firePrimaryAction(controls);
        popupTextField(controls, "Dungeon-Name").setText(name);
        popupButton(controls, "Erstellen").fire();
        layout(controls);
    }

    private static void renameSelectedSession(Parent controls, String name) {
        actionMenuItem(controls, "Umbenennen").fire();
        TextField draft = popupTextField(controls, "Dungeon-Name");
        assertTrue(!draft.getText().isBlank(), "rename preloads selected session name");
        draft.setText(name);
        popupButton(controls, "Speichern").fire();
        layout(controls);
    }

    private static void selectSession(Parent controls, long sessionId) {
        @SuppressWarnings("unchecked")
        ComboBox<String> selector = (ComboBox<String>) descendant(controls, ComboBox.class);
        selector.getSelectionModel().select(Long.toString(sessionId));
        layout(controls);
        button(controls, "Öffnen").fire();
        layout(controls);
    }

    private static void deleteSelectedSession(Parent controls) {
        actionMenuItem(controls, "Löschen").fire();
        popupButtonByAccessibleText(controls, "Löschen bestätigen").fire();
        layout(controls);
    }

    private static void assertSetupLivesInControls(Parent controls) {
        long selectorCount = descendants(controls).stream()
                .filter(ComboBox.class::isInstance)
                .count();
        assertTrue(selectorCount >= 1L, "controls expose the party selector alongside the catalog selector");
        assertTrue(button(controls, "Hinzufügen").isDisabled(), "party add button starts disabled");
        assertTrue(hasLabel(controls, "Session-Setup"), "controls expose the session setup section");
    }

    private static void selectScene(Parent main, int index) {
        List<Node> rows = descendants(main).stream()
                .filter(node -> node.getStyleClass().contains("session-planner-scene-row"))
                .toList();
        if (index >= rows.size()) {
            throw new AssertionError("Scene row not found at index " + index);
        }
        clickNode(rows.get(index));
        layout(main);
    }

    private static void clickNode(Node node) {
        javafx.event.Event.fireEvent(node, new javafx.scene.input.MouseEvent(
                javafx.scene.input.MouseEvent.MOUSE_CLICKED,
                0.0, 0.0, 0.0, 0.0, javafx.scene.input.MouseButton.PRIMARY, 1,
                false, false, false, false,
                false, false, false, false, false, false, null));
    }

    private static Button buttonByAccessibleText(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found by accessible text: " + accessibleText));
    }

    private static void assertSceneLootTargetsSceneCards() {
        SessionPlan plan = SessionPlan.seeded(77L, List.of(), EncounterDays.one())
                .addScene()
                .attachEncounter(101L)
                .attachEncounter(202L)
                .addLootPlaceholder(1L)
                .addLootPlaceholder(2L)
                .addLootPlaceholder(1L);
        assertEquals(Integer.valueOf(3), Integer.valueOf(plan.lootPlaceholders().size()),
                "loot placeholders are stored on the session plan");
        assertEquals(Long.valueOf(1L), Long.valueOf(plan.lootPlaceholders().get(0).encounterId()),
                "first loot placeholder stores its encounter target");
        assertEquals(Long.valueOf(2L), Long.valueOf(plan.lootPlaceholders().get(1).encounterId()),
                "second loot placeholder stores its encounter target");

        SessionPlan afterRemoval = plan.removeEncounter(1L);
        assertEquals(Integer.valueOf(1), Integer.valueOf(afterRemoval.lootPlaceholders().size()),
                "removing an encounter prunes its loot placeholders");
        assertEquals(Long.valueOf(2L), Long.valueOf(afterRemoval.lootPlaceholders().getFirst().encounterId()),
                "remaining loot placeholder keeps the surviving encounter target");
        assertLegacyLootLoadsIntoFirstEncounter();

        SessionPlannerSceneTimelineProjection projection = new SessionPlannerSceneTimelineProjection(
                List.of(new SessionPlannerSceneTimelineProjection.SessionScene(
                        1L,
                        101L,
                        true,
                        "Crypt",
                        "",
                        2,
                        100,
                        150,
                        1.5,
                        "Medium",
                        BigDecimal.valueOf(50L),
                        200,
                        false,
                        "Gate Watch",
                        "guards count torches",
                        7L,
                        List.of(new SessionPlannerSceneTimelineProjection.LootPlaceholder(10L, "Cache")))),
                List.of());
        SessionPlannerViewModel viewModel = new SessionPlannerViewModel();
        viewModel.applyLocationReferences(List.of(
                new SessionPlannerSessionSnapshot.LocationReference(7L, "Old Gate"),
                new SessionPlannerSessionSnapshot.LocationReference(10L, "Moonwell")));
        viewModel.applySceneTimeline(projection);
        assertEquals(Integer.valueOf(1), Integer.valueOf(
                        viewModel.timelineProjectionProperty().get().scenes().getFirst().lootPlaceholders().size()),
                "timeline model keeps loot inside the scene card");
        assertEquals("Old Gate", viewModel.timelineProjectionProperty().get().scenes().getFirst().locationLabel(),
                "timeline model resolves scene location labels from World Planner locations");
        assertEquals(Integer.valueOf(2),
                Integer.valueOf(viewModel.timelineProjectionProperty().get().locationOptions().size()),
                "timeline model exposes World Planner locations for scene selection");
        assertEquals("Gate Watch",
                viewModel.timelineProjectionProperty().get().scenes().getFirst().sceneTitle(),
                "timeline model exposes the persisted scene title directly without a draft layer");
    }

    private static void assertLegacyLootLoadsIntoFirstEncounter() {
        SessionPlan loaded = SessionPlanMapper.toDomain(new SessionPlanSnapshotRecord(
                new SessionPlanRecord(88L, "Legacy", "1.0", 1L, "", 3L, 2L),
                List.of(),
                List.of(new SessionEncounterRecord(1L, 101L, "100", "", "", 0L, 0)),
                List.of(),
                List.of(new SessionLootPlaceholderRecord(1L, 0L, "Legacy Cache", 0)),
                List.of()));
        assertEquals(Long.valueOf(1L), Long.valueOf(loaded.lootPlaceholders().getFirst().encounterId()),
                "legacy loot without encounter id loads into the first encounter");
    }

    private static void assertProductionRouteTimelineInteractions(
            SessionPlannerTestServices services,
            Parent controls,
            Parent main,
            SessionPlannerCurrentSessionModel current,
            SessionPlannerParticipantsModel participants,
            features.sessionplanner.api.SessionPlannerSceneTimelineModel sceneTimeline,
            long locationId
    ) {
        seedActiveParty(services);
        encounterDaysField(controls).setText("1");
        button(controls, "Setzen").fire();
        layout(controls);
        comboBoxContaining(controls, "Cora - Level 4");

        comboBoxByPrompt(controls, "Spieler").getSelectionModel().selectFirst();
        button(controls, "Hinzufügen").fire();
        layout(controls);
        assertEquals(Integer.valueOf(1), Integer.valueOf(participants.current().participants().size()),
                "participant add through setup section publishes one participant");
        assertEquals("Cora", participants.current().participants().getFirst().name(),
                "participant add through setup section resolves active party member");
        assertTrue(hasLabel(controls, "Cora"), "participant add renders selected player in controls");
        buttonByAccessibleText(controls, "Teilnehmer entfernen").fire();
        layout(controls);
        assertEquals(Integer.valueOf(0), Integer.valueOf(participants.current().participants().size()),
                "participant remove through setup section publishes empty participants");

        button(controls, "An Session anhängen").fire();
        layout(main);
        button(controls, "An Session anhängen").fire();
        layout(main);
        SessionPlannerSceneTimelineProjection afterAttach = sceneTimeline.current();
        assertEquals(Integer.valueOf(2), Integer.valueOf(afterAttach.sessionScenes().size()),
                "saved encounter attach through controls creates two scene rows");
        assertEquals(Long.valueOf(SAVED_ENCOUNTER_PLAN_ID),
                Long.valueOf(afterAttach.sessionScenes().getFirst().linkedEncounterPlanId()),
                "saved encounter attach publishes linked plan id");
        selectScene(main, 0);
        assertTrue(hasLabel(main, "Ash Gate Ambush"), "selected scene inspector renders linked plan name");

        long secondScene = afterAttach.sessionScenes().get(1).sceneToken();
        textField(main, "Szenentitel").setText("Gate Alarm");
        textArea(main, "Szenennotizen").setText("ring twice");
        selectComboBoxItem(main, "#" + locationId + " | Old Gate");
        layout(main);
        SessionPlannerSceneTimelineProjection afterSave = sceneTimeline.current();
        assertEquals("Gate Alarm", afterSave.sessionScenes().getFirst().sceneTitle(),
                "scene edit auto-commits title");
        assertEquals("ring twice", afterSave.sessionScenes().getFirst().sceneNotes(),
                "scene edit auto-commits notes");
        assertEquals(Long.valueOf(locationId), Long.valueOf(afterSave.sessionScenes().getFirst().locationId()),
                "scene edit auto-commits location id");
        assertTrue(hasLabel(main, "Old Gate"), "scene row renders saved location label");

        button(main, "+ Loot-Platzhalter").fire();
        layout(main);
        assertEquals(Integer.valueOf(1),
                Integer.valueOf(sceneTimeline.current().sessionScenes().getFirst().lootPlaceholders().size()),
                "loot add through inspector publishes placeholder");
        assertTrue(hasLabel(main, "Loot-Platzhalter 1"), "loot add renders placeholder label");
        buttonByAccessibleText(main, "Entfernen").fire();
        layout(main);
        assertEquals(Integer.valueOf(0),
                Integer.valueOf(sceneTimeline.current().sessionScenes().getFirst().lootPlaceholders().size()),
                "loot remove through inspector clears placeholder");

        buttons(main, "+10").getFirst().fire();
        layout(main);
        assertEquals("60", sceneTimeline.current().sessionScenes().getFirst()
                        .budgetPercentage().stripTrailingZeros().toPlainString(),
                "allocation increase through inspector raises first scene");
        buttons(main, "-10").getFirst().fire();
        layout(main);
        assertEquals("50", sceneTimeline.current().sessionScenes().getFirst()
                        .budgetPercentage().stripTrailingZeros().toPlainString(),
                "allocation decrease through inspector restores first scene");

        selectScene(main, 1);
        assertEquals(Long.valueOf(secondScene), Long.valueOf(current.current().session().selectedEncounterId()),
                "selecting a scene row selects it as the current scene");
        assertTrue(sceneTimeline.current().sessionScenes().stream()
                        .anyMatch(scene -> scene.sceneToken() == secondScene && scene.selected()),
                "selecting a scene row publishes the selected scene");

        button(main, "Kurze Rast").fire();
        layout(main);
        assertEquals(SessionPlannerRestKind.SHORT_REST, sceneTimeline.current().restGaps().getFirst().restKind(),
                "rest set through gap separator publishes short rest");
        assertTrue(hasLabelContaining(main, "Kurze Rast"), "rest set through gap separator renders short rest");
        button(main, "Leeren").fire();
        layout(main);
        assertEquals(SessionPlannerRestKind.NONE, sceneTimeline.current().restGaps().getFirst().restKind(),
                "rest clear through gap separator publishes no rest");

        selectScene(main, 0);
        buttonByAccessibleText(main, "Szene entfernen").fire();
        layout(main);
        assertEquals(Integer.valueOf(1), Integer.valueOf(sceneTimeline.current().sessionScenes().size()),
                "scene remove through inspector removes one scene");
    }

    private static void assertProductionRouteGeneratedSession(
            Parent controls,
            Parent main,
            SessionPlannerParticipantsModel participants,
            features.sessionplanner.api.SessionPlannerSceneTimelineModel sceneTimeline
    ) {
        comboBoxByPrompt(controls, "Spieler").getSelectionModel().selectFirst();
        button(controls, "Hinzufügen").fire();
        layout(controls);
        assertEquals(Integer.valueOf(1), Integer.valueOf(participants.current().participants().size()),
                "generation route has one resolved session participant");
        assertTrue(sceneTimeline.current().sessionScenes().size() >= 1,
                "session carries existing scenes before generation");

        button(controls, "Session generieren").fire();
        layout(controls);
        Button replace = button(controls, "Ersetzen");
        assertTrue(isEffectivelyVisible(replace),
                "one-click generation on a session with content reveals the replace confirmation");
        assertTrue(!hasLabelContaining(controls, "saltmarcher-v1"), "generation exposes no ruleset label");

        replace.fire();
        layout(main);

        assertEquals(Integer.valueOf(1), Integer.valueOf(sceneTimeline.current().sessionScenes().size()),
                "confirmed generation replaces the timeline");
        assertEquals(Long.valueOf(901L),
                Long.valueOf(sceneTimeline.current().sessionScenes().getFirst().linkedEncounterPlanId()),
                "confirmed generation attaches imported Encounter plan");
    }

    private static void seedActiveParty(SessionPlannerTestServices services) {
        PartyApi party = services.party().application();
        party.createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Cora", "Mira", 4, 13, 15),
                MembershipState.ACTIVE));
        party.createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Dain", "Jules", 5, 12, 16),
                MembershipState.ACTIVE));
    }

    private static long seedLocation(SessionPlannerTestServices services) {
        WorldPlannerApplicationService worldPlanner = services.worldApplication();
        WorldPlannerSnapshotModel snapshots = services.world().snapshotModel();
        worldPlanner.createLocation(new CreateWorldLocationCommand("Old Gate", ""));
        return snapshots.current().locations().stream()
                .filter(location -> "Old Gate".equals(location.displayName()))
                .findFirst()
                .map(WorldLocationSummary::locationId)
                .orElseThrow(() -> new AssertionError("World Planner location fixture not published."));
    }

    private static TextField encounterDaysField(Parent controls) {
        return descendants(controls).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> "Tage".equals(field.getPromptText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Encounter days field not found."));
    }

    @SuppressWarnings("unchecked")
    private static ComboBox<String> comboBoxByPrompt(Parent parent, String promptText) {
        return descendants(parent).stream()
                .filter(ComboBox.class::isInstance)
                .map(ComboBox.class::cast)
                .filter(comboBox -> promptText.equals(comboBox.getPromptText()))
                .map(comboBox -> (ComboBox<String>) comboBox)
                .findFirst()
                .orElseThrow(() -> new AssertionError("ComboBox not found: " + promptText));
    }

    private static TextField textField(Parent parent, String promptText) {
        return descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> promptText.equals(field.getPromptText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Text field not found: " + promptText));
    }

    private static javafx.scene.control.TextArea textArea(Parent parent, String promptText) {
        return descendants(parent).stream()
                .filter(javafx.scene.control.TextArea.class::isInstance)
                .map(javafx.scene.control.TextArea.class::cast)
                .filter(area -> promptText.equals(area.getPromptText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Text area not found: " + promptText));
    }

    @SuppressWarnings("unchecked")
    private static ComboBox<Object> comboBoxContaining(Parent parent, String itemText) {
        return descendants(parent).stream()
                .filter(ComboBox.class::isInstance)
                .map(ComboBox.class::cast)
                .filter(comboBox -> comboBox.getItems().stream()
                        .anyMatch(item -> itemText.equals(String.valueOf(item))))
                .map(comboBox -> (ComboBox<Object>) comboBox)
                .findFirst()
                .orElseThrow(() -> new AssertionError("ComboBox item not found: " + itemText));
    }

    private static void selectComboBoxItem(Parent parent, String itemText) {
        ComboBox<Object> comboBox = comboBoxContaining(parent, itemText);
        comboBox.getItems().stream()
                .filter(item -> itemText.equals(String.valueOf(item)))
                .findFirst()
                .ifPresent(comboBox.getSelectionModel()::select);
    }

    private static SessionPlannerCatalogSnapshot.SessionSummary only(SessionPlannerCatalogSnapshot snapshot) {
        if (snapshot.sessions().size() != 1) {
            throw new AssertionError("Expected one session, got " + snapshot.sessions().size());
        }
        return snapshot.sessions().getFirst();
    }

    private static void assertCatalogSize(SessionPlannerCatalogSnapshot snapshot, int expected, String message) {
        assertEquals(Integer.valueOf(expected), Integer.valueOf(snapshot.sessions().size()), message);
    }

    private static SessionPlannerTestServices services() {
        return services(generationService());
    }

    private static SessionPlannerTestServices services(SessionGenerationApi generation) {
        PartyServiceAssembly.Component party =
                PartyServiceAssembly.create(new SqlitePartyRosterRepository());
        WorldPlannerServiceAssembly world = new WorldPlannerServiceAssembly(
                new SqliteWorldPlannerRepository(), new PositiveReferencePort());
        WorldPlannerApplicationService worldApplication = world.createApplicationService();
        SavedEncounterPlanListModel savedPlans = new SavedEncounterPlanListModel(
                SessionPlannerCatalogTest::savedEncounterPlans,
                listener -> {
                    listener.accept(savedEncounterPlans());
                    return () -> {
                    };
                });
        EncounterPlanBudgetModel planBudget = new EncounterPlanBudgetModel(
                SessionPlannerCatalogTest::encounterPlanBudget,
                listener -> {
                    listener.accept(encounterPlanBudget());
                    return () -> {
                    };
                });
        SessionPlannerServiceAssembly planner = new SessionPlannerServiceAssembly(
                new SqliteSessionPlanRepository(), party.application(), party.activeParty(),
                party.adventuringDayCalculation(), noopEncounterApplicationService(), savedPlans,
                planBudget, world.snapshotModel(), generation,
                command -> CompletableFuture.completedFuture(GeneratedEncounterPlanImportResult.success(
                        List.of(new GeneratedEncounterPlanImportResult.ImportedPlan(1, 901L)))),
                platform.execution.DirectExecutionLane.INSTANCE,
                platform.ui.DirectUiDispatcher.INSTANCE,
                platform.diagnostics.NoopDiagnostics.INSTANCE);
        return new SessionPlannerTestServices(party, world, worldApplication, planner);
    }

    private record SessionPlannerTestServices(
            PartyServiceAssembly.Component party,
            WorldPlannerServiceAssembly world,
            WorldPlannerApplicationService worldApplication,
            SessionPlannerServiceAssembly planner
    ) {
    }

    private static final class PositiveReferencePort implements WorldPlannerReferencePort {
        @Override
        public boolean creatureStatblockExists(long id) {
            return id > 0L;
        }

        @Override
        public boolean encounterTableExists(long id) {
            return id > 0L;
        }
    }

    private static SavedEncounterPlanListResult savedEncounterPlans() {
        return new SavedEncounterPlanListResult(
                SavedEncounterPlanStatus.SUCCESS,
                List.of(new SavedEncounterPlanSummary(
                        SAVED_ENCOUNTER_PLAN_ID,
                        "Ash Gate Ambush",
                        "2 Kreaturen · Medium")),
                "");
    }

    private static EncounterPlanBudgetResult encounterPlanBudget() {
        return new EncounterPlanBudgetResult(
                EncounterPlanBudgetStatus.SUCCESS,
                new EncounterPlanBudgetSummary(
                        SAVED_ENCOUNTER_PLAN_ID,
                        "Ash Gate Ambush",
                        "generated",
                        2,
                        100,
                        150,
                        1.5,
                        "Medium"),
                "");
    }

    private static EncounterApplicationService noopEncounterApplicationService() {
        return EncounterApplicationServiceFakes.noOp();
    }

    private static SessionGenerationApi generationService() {
        GenerationResult result = new GenerationResult(
                new GenerationRunId("ui-generation"),
                "saltmarcher-v1",
                "catalog-2026-07-16",
                "10e7b8c2f3d43c0868e2ce0c3bf8471b72ed4d5327fc633452e0245d32f416f6",
                179_974L,
                new GenerationResult.SessionSummary(
                        1, BigDecimal.ONE, 1, 1_000L, 100L, BigDecimal.valueOf(4L),
                        100L, 20L, 1, 0, 0, 1),
                List.of(new GenerationResult.EncounterTarget(1, 100L)),
                List.of(new GenerationResult.Encounter(
                        1, 100L, 100L, GenerationResult.Difficulty.MEDIUM,
                        "candidate", "Generated creature", 1, BigDecimal.ONE,
                        List.of(new GenerationResult.EncounterBlock(
                                GenerationResult.EncounterRole.STANDARD, 1, "1/2", 100L, 1)))),
                List.of(new GenerationResult.Treasure(
                        1, GenerationResult.StockClass.NORMAL, GenerationResult.RewardChannel.ENCOUNTER,
                        1, "Vault", "none", 100L, 1, 0)),
                List.of(new GenerationResult.LootItem(
                        1, 1, GenerationResult.LootRole.USEFUL, "cache", "Generated cache",
                        1L, 100L, 100L, BigDecimal.ONE, "chest", "", false)),
                List.of(),
                new GenerationResult.RewardSummary(100L, 0L, 0),
                "Generated output",
                List.of(new GenerationResult.Audit(
                        "final-output", GenerationResult.AuditStatus.PASS, "ok")));
        return new SessionGenerationApi() {
            @Override
            public java.util.concurrent.CompletionStage<GenerationResponse> generate(GenerationRequest request) {
                return CompletableFuture.completedFuture(GenerationResponse.success(result));
            }

            @Override
            public java.util.concurrent.CompletionStage<GenerationResponse> load(GenerationRunId runId) {
                return CompletableFuture.completedFuture(GenerationResponse.success(result));
            }
        };
    }

    private static <T extends Node> T slot(ShellBinding binding, ShellSlot slot, Class<T> type) {
        Node node = binding.slotContent().get(slot);
        if (!type.isInstance(node)) {
            throw new AssertionError("Unexpected " + slot + " slot content: " + node);
        }
        return type.cast(node);
    }

    private static Button button(Parent parent, String text) {
        return buttons(parent, text).stream()
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + text));
    }

    private static List<Button> buttons(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .toList();
    }

    private static List<Button> enabledButtons(Parent parent, String text) {
        return buttons(parent, text).stream()
                .filter(button -> !button.isDisabled())
                .toList();
    }

    private static boolean isEffectivelyVisible(Node node) {
        Node current = node;
        while (current != null) {
            if (!current.isVisible()) {
                return false;
            }
            current = current.getParent();
        }
        return true;
    }

    private static void firePrimaryAction(Parent parent) {
        button(parent, "Neu").fire();
    }

    private static MenuButton actionButton(Parent parent) {
        return descendants(parent).stream()
                .filter(MenuButton.class::isInstance)
                .map(MenuButton.class::cast)
                .filter(button -> "Mehr".equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("MenuButton not found: Mehr"));
    }

    private static javafx.scene.control.MenuItem actionMenuItem(Parent parent, String text) {
        return actionButton(parent).getItems().stream()
                .filter(item -> text.equals(item.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("MenuItem not found: " + text));
    }

    private static ButtonBase popupButton(Parent parent, String text) {
        return descendants(operationPopupContent(parent)).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Catalog popup button not found: " + text));
    }

    private static TextField popupTextField(Parent parent, String accessibleText) {
        return descendants(operationPopupContent(parent)).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> accessibleText.equals(field.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Catalog popup TextField not found: " + accessibleText));
    }

    private static ButtonBase popupButtonByAccessibleText(Parent parent, String accessibleText) {
        return descendants(operationPopupContent(parent)).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Catalog popup button not found: " + accessibleText));
    }

    private static Parent operationPopupContent(Parent parent) {
        Object content = parent.getProperties().get("catalogCrudOperationContent");
        if (content instanceof Parent popupContent) {
            return popupContent;
        }
        for (Node node : descendants(parent)) {
            Object nestedContent = node.getProperties().get("catalogCrudOperationContent");
            if (nestedContent instanceof Parent popupContent) {
                return popupContent;
            }
        }
        throw new AssertionError("Catalog popup content not found.");
    }

    private static boolean hasLabel(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .anyMatch(label -> text.equals(label.getText()));
    }

    private static boolean hasLabelContaining(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .anyMatch(label -> label.getText() != null && label.getText().contains(text));
    }

    private static <T extends Node> T descendant(Parent parent, Class<T> type) {
        return descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Descendant not found: " + type.getSimpleName()));
    }

    private static List<Node> descendants(Node node) {
        java.util.ArrayList<Node> result = new java.util.ArrayList<>();
        collect(node, result);
        return List.copyOf(result);
    }

    private static void collect(Node node, List<Node> result) {
        result.add(node);
        if (node instanceof Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                collect(child, result);
            }
        }
    }

    private static void layout(Parent parent) {
        parent.applyCss();
        parent.layout();
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!expected.equals(actual)) {
            throw new AssertionError(message + ": expected=" + expected + ", actual=" + actual);
        }
    }

    private static void assertTrue(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrappedAction = () -> {
            try {
                Platform.setImplicitExit(false);
                action.run();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        };
        if (FX_STARTED.compareAndSet(false, true)) {
            testsupport.JavaFxRuntime.startup(wrappedAction);
        } else {
            Platform.runLater(wrappedAction);
        }
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX Session Planner test.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Session Planner catalog test failed.", failure[0]);
        }
    }

    private static void shutdownFx() throws Exception {
        if (!FX_STARTED.get()) {
            return;
        }
        runOnFxThread(() -> {
            hideOpenWindows();
            testsupport.JavaFxRuntime.shutdown();
        });
    }

    private static void hideOpenWindows() {
        Platform.setImplicitExit(false);
        for (Window window : List.copyOf(Window.getWindows())) {
            window.hide();
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }

    private enum EmptyInspectorSink implements InspectorSink {
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
}
