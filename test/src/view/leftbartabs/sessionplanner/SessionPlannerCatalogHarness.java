package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
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
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.data.sessionplanner.mapper.SessionPlanMapper;
import src.data.sessionplanner.model.SessionEncounterRecord;
import src.data.sessionplanner.model.SessionLootPlaceholderRecord;
import src.data.sessionplanner.model.SessionPlanRecord;
import src.data.sessionplanner.model.SessionPlanSnapshotRecord;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.EncounterApplicationServiceFakes;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterPlanBudgetSummary;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.MembershipState;
import src.domain.sessionplanner.model.session.EncounterDays;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCatalogSnapshot;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineProjection;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.worldplanner.WorldPlannerApplicationService;
import src.domain.worldplanner.published.CreateWorldLocationCommand;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

public final class SessionPlannerCatalogHarness {

    private static final int AWAIT_SECONDS = 60;
    private static final long SAVED_ENCOUNTER_PLAN_ID = 501L;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    private SessionPlannerCatalogHarness() {
    }

    public static void main(String[] args) throws Exception {
        try {
            runOnFxThread(SessionPlannerCatalogHarness::runHarness);
            shutdownFx();
            System.out.println("Session Planner catalog harness passed.");
        } catch (Throwable throwable) {
            throwable.printStackTrace(System.err);
            shutdownFx();
            System.exit(1);
        }
    }

    private static void runHarness() {
        ServiceRegistry services = services();
        long locationId = seedLocation(services);
        ShellRuntimeContext context = new ShellRuntimeContext(EmptyInspectorSink.INSTANCE, services);
        ShellBinding binding = new SessionPlannerContribution().bind(context);
        Parent controls = slot(binding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        Parent main = slot(binding, ShellSlot.COCKPIT_MAIN, Parent.class);
        Parent state = slot(binding, ShellSlot.COCKPIT_STATE, Parent.class);
        SessionPlannerCatalogModel catalog = services.require(SessionPlannerCatalogModel.class);
        SessionPlannerCurrentSessionModel current = services.require(SessionPlannerCurrentSessionModel.class);
        src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel sceneTimeline =
                services.require(src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel.class);
        SessionPlannerParticipantsModel participants = services.require(SessionPlannerParticipantsModel.class);

        Stage stage = new Stage();
        HBox root = new HBox(controls, main, state);
        stage.setScene(new Scene(root, 1_260.0, 760.0));
        stage.show();
        layout(root);

        assertMainUsesCompactSceneSetup(main);
        assertSceneLootTargetsSceneCards();
        assertCatalogSize(catalog.current(), 0, "initial catalog is empty");
        assertTrue(!hasLabel(main, "Session #0"), "initial main does not show default Session #0");
        assertTrue(button(main, "Setzen").isDisabled(), "initial main disables session mutation");
        encounterDaysField(main).setText("2");
        button(main, "Setzen").fire();
        assertCatalogSize(catalog.current(), 0, "session-bound action before create does not seed a session");

        createSession(controls, "Alpha");
        SessionPlannerCatalogSnapshot afterAlpha = catalog.current();
        assertCatalogSize(afterAlpha, 1, "create adds first session");
        long alphaId = only(afterAlpha).sessionId();
        assertEquals("Alpha", only(afterAlpha).displayName(), "create stores display name");
        assertEquals(alphaId, afterAlpha.selectedSessionId(), "create selects new session");
        assertEquals("Alpha", current.current().session().displayName(), "current session display name after create");

        encounterDaysField(main).setText("2");
        button(main, "Setzen").fire();
        assertEquals("2", current.current().session().encounterDaysText(), "session content mutation before rename");
        assertTrue(hasLabel(main, "0 / ca. 16 Szenen"), "main setup shows encounter-day scene target");

        button(main, "Szene hinzufuegen").fire();
        layout(main);
        assertEquals(Integer.valueOf(1), Integer.valueOf(sceneTimeline.current().sessionScenes().size()),
                "add scene creates one session scene");
        assertEquals(Long.valueOf(0L),
                Long.valueOf(sceneTimeline.current().sessionScenes().getFirst().linkedEncounterPlanId()),
                "added scene has no linked encounter plan");
        assertTrue(hasLabel(main, "Keine Begegnung verknuepft."), "blank scene shows no false encounter data");
        button(main, "X").fire();
        layout(main);
        assertEquals(Integer.valueOf(0), Integer.valueOf(sceneTimeline.current().sessionScenes().size()),
                "scene X removes only the session scene representation");

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

    private static void assertMainUsesCompactSceneSetup(Parent main) {
        long selectorCount = descendants(main).stream()
                .filter(ComboBox.class::isInstance)
                .count();
        assertTrue(selectorCount >= 1L, "main exposes compact party selector");
        assertTrue(button(main, "Hinzufuegen").isDisabled(), "compact party add button starts disabled");
        assertTrue(hasLabel(main, "0 / ca. 0 Szenen"), "main exposes compact scene target");
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
        viewModel.updateSceneDraft(1L, "Bridge Alarm", "ring the bell", 9L);
        viewModel.applySceneTimeline(projection);
        assertEquals("Bridge Alarm", viewModel.timelineProjectionProperty().get().scenes().getFirst().sceneTitle(),
                "timeline model keeps unsaved scene title draft across readback");
        assertEquals("ring the bell", viewModel.timelineProjectionProperty().get().scenes().getFirst().sceneNotes(),
                "timeline model keeps unsaved scene notes draft across readback");
        assertEquals(Long.valueOf(9L),
                Long.valueOf(viewModel.timelineProjectionProperty().get().scenes().getFirst().locationId()),
                "timeline model keeps unsaved scene location draft across readback");
        assertSceneDraftsAreSessionScoped(projection);

        SessionPlannerTimelineMainView view = new SessionPlannerTimelineMainView();
        List<SessionPlannerViewModel.TimelineInput> events = new ArrayList<>();
        view.onTimelineInput(events::add);
        view.bind(viewModel);
        Stage stage = new Stage();
        stage.setScene(new Scene(view, 520.0, 420.0));
        stage.show();
        layout(view);
        assertTrue(hasLabel(view, "Cache"), "timeline view renders encounter loot");
        assertTrue(hasLabel(view, "Location #9"), "timeline view renders scene location draft");
        textField(view, "Szenentitel").setText("Bridge Alarm Final");
        textArea(view, "Szenennotizen").setText("ring twice");
        selectComboBoxItem(view, "#10 | Moonwell");
        assertTrue(events.stream().anyMatch(event -> event.widgetToken() > 0L && event.sceneToken() == 1L),
                "scene draft edits publish a technical widget token");
        events.clear();
        button(view, "Szene speichern").fire();
        List<SessionPlannerViewModel.TimelineInput> saveEvents = events.stream()
                .filter(event -> event.widgetToken() > 0L && event.sceneToken() == 1L)
                .toList();
        assertEquals(Integer.valueOf(1), Integer.valueOf(saveEvents.size()), "scene save publishes one save event");
        assertEquals(Long.valueOf(1L), Long.valueOf(saveEvents.getFirst().sceneToken()),
                "scene save targets the scene card");
        assertEquals("Bridge Alarm Final", saveEvents.getFirst().sceneTitleText(), "scene save carries title");
        assertEquals("ring twice", saveEvents.getFirst().sceneNotesText(), "scene save carries notes");
        assertEquals(Long.valueOf(10L), Long.valueOf(saveEvents.getFirst().locationId()),
                "scene save carries location id");
        events.clear();
        button(view, "Loot-Platzhalter").fire();
        assertEquals(Integer.valueOf(1), Integer.valueOf(events.size()), "loot add button publishes one event");
        assertTrue(events.getFirst().widgetToken() > 0L, "loot add event carries a technical widget token");
        assertEquals(Long.valueOf(1L), Long.valueOf(events.getFirst().sceneToken()),
                "loot add event targets the scene card");
        stage.hide();
    }

    private static void assertSceneDraftsAreSessionScoped(SessionPlannerSceneTimelineProjection projection) {
        SessionPlannerViewModel viewModel = new SessionPlannerViewModel();
        viewModel.applySetup(SessionPlannerViewModel.SetupState.from(
                sessionSnapshot(11L, "Alpha"),
                SessionPlannerParticipantsProjection.empty()));
        viewModel.updateSceneDraft(1L, "Alpha Draft", "alpha notes", 10L);
        viewModel.applySceneTimeline(projection);
        assertEquals("Alpha Draft", viewModel.timelineProjectionProperty().get().scenes().getFirst().sceneTitle(),
                "timeline model applies scene drafts inside the active session");
        viewModel.applySetup(SessionPlannerViewModel.SetupState.from(
                sessionSnapshot(12L, "Beta"),
                SessionPlannerParticipantsProjection.empty()));
        viewModel.applySceneTimeline(projection);
        assertEquals("Gate Watch", viewModel.timelineProjectionProperty().get().scenes().getFirst().sceneTitle(),
                "timeline model does not leak scene drafts across sessions with the same scene token");
        assertEquals("guards count torches", viewModel.timelineProjectionProperty().get().scenes().getFirst().sceneNotes(),
                "timeline model restores persisted scene notes after session switch");
        assertEquals(Long.valueOf(7L),
                Long.valueOf(viewModel.timelineProjectionProperty().get().scenes().getFirst().locationId()),
                "timeline model restores persisted scene location after session switch");
    }

    private static void assertLegacyLootLoadsIntoFirstEncounter() {
        SessionPlan loaded = SessionPlanMapper.toDomain(new SessionPlanSnapshotRecord(
                new SessionPlanRecord(88L, "Legacy", "1.0", 1L, "", 3L, 2L),
                List.of(),
                List.of(new SessionEncounterRecord(1L, 101L, "100", "", "", 0L, 0)),
                List.of(),
                List.of(new SessionLootPlaceholderRecord(1L, 0L, "Legacy Cache", 0))));
        assertEquals(Long.valueOf(1L), Long.valueOf(loaded.lootPlaceholders().getFirst().encounterId()),
                "legacy loot without encounter id loads into the first encounter");
    }

    private static void assertProductionRouteTimelineInteractions(
            ServiceRegistry services,
            Parent controls,
            Parent main,
            SessionPlannerCurrentSessionModel current,
            SessionPlannerParticipantsModel participants,
            src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel sceneTimeline,
            long locationId
    ) {
        seedActiveParty(services);
        encounterDaysField(main).setText("1");
        button(main, "Setzen").fire();
        layout(main);
        comboBoxContaining(main, "Cora - Level 4");

        comboBoxByPrompt(main, "Spieler").getSelectionModel().selectFirst();
        button(main, "Hinzufuegen").fire();
        layout(main);
        assertEquals(Integer.valueOf(1), Integer.valueOf(participants.current().participants().size()),
                "participant add through setup strip publishes one participant");
        assertEquals("Cora", participants.current().participants().getFirst().name(),
                "participant add through setup strip resolves active party member");
        assertTrue(hasLabel(main, "Cora"), "participant add renders selected player");
        button(main, "X").fire();
        layout(main);
        assertEquals(Integer.valueOf(0), Integer.valueOf(participants.current().participants().size()),
                "participant remove through setup strip publishes empty participants");

        button(controls, "An Session anhaengen").fire();
        layout(main);
        button(controls, "An Session anhaengen").fire();
        layout(main);
        SessionPlannerSceneTimelineProjection afterAttach = sceneTimeline.current();
        assertEquals(Integer.valueOf(2), Integer.valueOf(afterAttach.sessionScenes().size()),
                "saved encounter attach through controls creates two scene cards");
        assertEquals(Long.valueOf(SAVED_ENCOUNTER_PLAN_ID),
                Long.valueOf(afterAttach.sessionScenes().getFirst().linkedEncounterPlanId()),
                "saved encounter attach publishes linked plan id");
        assertTrue(hasLabel(main, "Ash Gate Ambush"), "saved encounter attach renders linked plan name");

        long firstScene = afterAttach.sessionScenes().get(0).sceneToken();
        long secondScene = afterAttach.sessionScenes().get(1).sceneToken();
        textField(main, "Szenentitel").setText("Gate Alarm");
        textArea(main, "Szenennotizen").setText("ring twice");
        selectComboBoxItem(main, "#" + locationId + " | Old Gate");
        button(main, "Szene speichern").fire();
        layout(main);
        SessionPlannerSceneTimelineProjection afterSave = sceneTimeline.current();
        assertEquals("Gate Alarm", afterSave.sessionScenes().getFirst().sceneTitle(),
                "scene save through card stores title");
        assertEquals("ring twice", afterSave.sessionScenes().getFirst().sceneNotes(),
                "scene save through card stores notes");
        assertEquals(Long.valueOf(locationId), Long.valueOf(afterSave.sessionScenes().getFirst().locationId()),
                "scene save through card stores location id");
        assertTrue(hasLabel(main, "Old Gate"), "scene save renders saved location label");

        buttons(main, "Loot-Platzhalter").getFirst().fire();
        layout(main);
        assertEquals(Integer.valueOf(1),
                Integer.valueOf(sceneTimeline.current().sessionScenes().getFirst().lootPlaceholders().size()),
                "loot add through scene card publishes placeholder");
        assertTrue(hasLabel(main, "Loot-Platzhalter 1"), "loot add renders placeholder label");
        button(main, "Entfernen").fire();
        layout(main);
        assertEquals(Integer.valueOf(0),
                Integer.valueOf(sceneTimeline.current().sessionScenes().getFirst().lootPlaceholders().size()),
                "loot remove through scene card clears placeholder");

        buttons(main, "+10%").getFirst().fire();
        layout(main);
        assertEquals("60", sceneTimeline.current().sessionScenes().getFirst()
                        .budgetPercentage().stripTrailingZeros().toPlainString(),
                "allocation increase through scene card raises first scene");
        buttons(main, "-10%").getFirst().fire();
        layout(main);
        assertEquals("50", sceneTimeline.current().sessionScenes().getFirst()
                        .budgetPercentage().stripTrailingZeros().toPlainString(),
                "allocation decrease through scene card restores first scene");

        button(main, "Auswaehlen").fire();
        layout(main);
        assertEquals(Long.valueOf(secondScene), Long.valueOf(current.current().session().selectedEncounterId()),
                "scene select through card updates current selected scene");
        assertTrue(sceneTimeline.current().sessionScenes().stream()
                        .anyMatch(scene -> scene.sceneToken() == secondScene && scene.selected()),
                "scene select through card publishes selected scene");

        button(main, "Kurze Rast").fire();
        layout(main);
        assertEquals(SessionPlannerRestKind.SHORT_REST, sceneTimeline.current().restGaps().getFirst().restKind(),
                "rest set through gap card publishes short rest");
        assertTrue(hasLabel(main, "Kurze Rast"), "rest set through gap card renders short rest");
        button(main, "Leeren").fire();
        layout(main);
        assertEquals(SessionPlannerRestKind.NONE, sceneTimeline.current().restGaps().getFirst().restKind(),
                "rest clear through gap card publishes no rest");

        enabledButtons(main, "Runter").getFirst().fire();
        layout(main);
        assertEquals(Long.valueOf(secondScene),
                Long.valueOf(sceneTimeline.current().sessionScenes().getFirst().sceneToken()),
                "scene move down through card reorders first scene");
        enabledButtons(main, "Hoch").getFirst().fire();
        layout(main);
        assertEquals(Long.valueOf(firstScene),
                Long.valueOf(sceneTimeline.current().sessionScenes().getFirst().sceneToken()),
                "scene move up through card restores order");

        buttons(main, "X").getFirst().fire();
        layout(main);
        assertEquals(Integer.valueOf(1), Integer.valueOf(sceneTimeline.current().sessionScenes().size()),
                "scene remove through linked scene card removes one scene");
    }

    private static void seedActiveParty(ServiceRegistry services) {
        PartyApplicationService party = services.require(PartyApplicationService.class);
        party.createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Cora", "Mira", 4, 13, 15),
                MembershipState.ACTIVE));
        party.createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Dain", "Jules", 5, 12, 16),
                MembershipState.ACTIVE));
    }

    private static long seedLocation(ServiceRegistry services) {
        WorldPlannerApplicationService worldPlanner = services.require(WorldPlannerApplicationService.class);
        WorldPlannerSnapshotModel snapshots = services.require(WorldPlannerSnapshotModel.class);
        worldPlanner.createLocation(new CreateWorldLocationCommand("Old Gate", ""));
        return snapshots.current().locations().stream()
                .filter(location -> "Old Gate".equals(location.displayName()))
                .findFirst()
                .map(WorldLocationSummary::locationId)
                .orElseThrow(() -> new AssertionError("World Planner location fixture not published."));
    }

    private static SessionPlannerSessionSnapshot sessionSnapshot(long sessionId, String displayName) {
        return new SessionPlannerSessionSnapshot(
                new SessionPlannerSessionSnapshot.SessionState(
                        sessionId,
                        displayName,
                        BigDecimal.ONE,
                        "1",
                        0L,
                        false),
                SessionPlannerSessionSnapshot.XpBudgetState.empty(),
                SessionPlannerSessionSnapshot.RestAdviceState.empty(),
                SessionPlannerSessionSnapshot.GoldBudgetState.placeholder(0),
                List.of(),
                List.of(),
                "");
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

    private static ServiceRegistry services() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        new src.data.creatures.CreaturesServiceContribution().register(builder);
        new src.data.encountertable.EncounterTableServiceContribution().register(builder);
        new src.data.party.PartyServiceContribution().register(builder);
        new src.data.sessionplanner.SessionPlannerServiceContribution().register(builder);
        new src.data.worldplanner.WorldPlannerServiceContribution().register(builder);
        new src.domain.creatures.CreaturesServiceContribution().register(builder);
        new src.domain.encountertable.EncounterTableServiceContribution().register(builder);
        registerEncounterFixture(builder);
        new src.domain.party.PartyServiceContribution().register(builder);
        new src.domain.worldplanner.WorldPlannerServiceContribution().register(builder);
        new src.domain.sessionplanner.SessionPlannerServiceContribution().register(builder);
        return builder.build();
    }

    private static void registerEncounterFixture(ServiceRegistry.Builder builder) {
        builder.register(SavedEncounterPlanListModel.class, new SavedEncounterPlanListModel(
                SessionPlannerCatalogHarness::savedEncounterPlans,
                listener -> {
                    listener.accept(savedEncounterPlans());
                    return () -> {
                    };
                }));
        builder.register(EncounterPlanBudgetModel.class, new EncounterPlanBudgetModel(
                SessionPlannerCatalogHarness::encounterPlanBudget,
                listener -> {
                    listener.accept(encounterPlanBudget());
                    return () -> {
                    };
                }));
        builder.register(EncounterApplicationService.class, noopEncounterApplicationService());
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
                action.run();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        };
        if (FX_STARTED.compareAndSet(false, true)) {
            Platform.startup(wrappedAction);
        } else {
            Platform.runLater(wrappedAction);
        }
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX Session Planner harness.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Session Planner catalog harness failed.", failure[0]);
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
