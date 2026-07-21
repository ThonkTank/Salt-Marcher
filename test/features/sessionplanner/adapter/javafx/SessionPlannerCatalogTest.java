package features.sessionplanner.adapter.javafx;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import features.encounter.api.EncounterApi;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.encounter.api.SavedEncounterPlanSummary;
import features.encounter.application.EncounterApplicationService;
import features.encounter.application.EncounterApplicationServiceFakes;
import features.party.PartyServiceAssembly;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.party.api.PartyApi;
import features.sessiongeneration.api.GenerationDraft;
import features.sessiongeneration.api.GenerationDraftResponse;
import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationRunResponse;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.sessionplanner.api.SessionPlannerCatalogCommand;
import features.sessionplanner.api.SessionPlannerCatalogSnapshot;
import features.sessionplanner.api.SessionPlannerRestKind;
import features.sessionplanner.api.SessionPlannerSceneTimelineProjection;
import features.sessionplanner.api.SessionPlannerSessionSnapshot;
import features.sessionplanner.api.SessionPreparationSnapshot;
import features.sessionplanner.api.SessionPreparationStatus;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionPlan;
import features.worldplanner.WorldPlannerServiceAssembly;
import features.worldplanner.adapter.sqlite.repository.SqliteWorldPlannerRepository;
import features.worldplanner.api.CreateWorldLocationCommand;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.worldplanner.application.WorldPlannerApplicationService;
import features.worldplanner.domain.world.port.WorldPlannerReferencePort;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonBase;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuButton;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import javafx.stage.Window;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.persistence.TestFeatureStores;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellSlot;
import features.sessionplanner.adapter.sqlite.mapper.SessionPlanMapper;
import features.sessionplanner.adapter.sqlite.model.SessionEncounterRecord;
import features.sessionplanner.adapter.sqlite.model.SessionManualLootNoteRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlanRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlanSnapshotRecord;
import features.encounter.application.EncounterApplicationService;
import features.encounter.application.EncounterApplicationServiceFakes;
import features.encounter.api.EncounterApi;
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
import features.sessionplanner.api.SessionPlannerCatalogCommand;
import features.sessionplanner.api.SessionPlannerCatalogSnapshot;
import features.sessionplanner.api.SessionPlannerParticipantCommand;
import features.sessionplanner.api.SessionPlannerRestKind;
import features.sessionplanner.api.SessionPlannerSceneTimelineProjection;
import features.sessionplanner.api.SessionPlannerSelectedSceneSnapshot;
import features.sessionplanner.api.SessionPlannerSessionSnapshot;
import features.sessionplanner.api.SessionPlannerWorkspaceModel;
import features.sessionplanner.api.SessionPlannerWorkspaceSnapshot;
import features.sessionplanner.api.SessionPreparationSnapshot;
import features.sessionplanner.api.SessionPreparationStatus;
import features.sessiongeneration.api.GenerationDraft;
import features.sessiongeneration.api.GenerationDraftResponse;
import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationRunResponse;
import features.sessiongeneration.api.SessionGenerationApi;
import features.worldplanner.application.WorldPlannerApplicationService;
import features.worldplanner.WorldPlannerServiceAssembly;
import features.worldplanner.domain.world.port.WorldPlannerReferencePort;
import features.worldplanner.api.CreateWorldLocationCommand;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import features.sessionplanner.api.SessionPlannerWorkspaceModel;

@org.junit.jupiter.api.Tag("ui")
public final class SessionPlannerCatalogTest {

    private static final int AWAIT_SECONDS = 60;
    private static final long SAVED_ENCOUNTER_PLAN_ID = 501L;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();
    private static final AtomicLong DATABASE_SEQUENCE = new AtomicLong();

    @TempDir
    static Path temporaryDirectory;

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
    void generationCanBeCancelledWhileDraftIsPending() throws Exception {
        CompletableFuture<GenerationDraftResponse> pending = new CompletableFuture<>();
        SessionGenerationApi delayedGeneration = new SessionGenerationApi() {
            @Override
            public java.util.concurrent.CompletionStage<GenerationDraftResponse> draft(
                    GenerationRequest request
            ) {
                return pending;
            }

            @Override
            public java.util.concurrent.CompletionStage<features.sessiongeneration.api.GenerationRunResponse> commit(
                    features.sessiongeneration.api.CommitGenerationRunCommand command
            ) {
                throw new UnsupportedOperationException();
            }

            @Override
            public java.util.concurrent.CompletionStage<features.sessiongeneration.api.GenerationRunResponse> load(
                    GenerationRunId runId
            ) {
                throw new UnsupportedOperationException();
            }

            @Override
            public java.util.concurrent.CompletionStage<features.sessiongeneration.api.GenerationRewardBatchResponse>
                    loadRewards(features.sessiongeneration.api.GenerationRewardBatchQuery query) {
                throw new UnsupportedOperationException();
            }

        };
        java.util.concurrent.atomic.AtomicReference<PendingPreparationUi> pendingUi =
                new java.util.concurrent.atomic.AtomicReference<>();
        runOnFxThread(() -> pendingUi.set(openPendingDraft(delayedGeneration)));
        runOnFxThread(() -> {
            PendingPreparationUi ui = pendingUi.get();
            layout(ui.controls());
            assertTrue(button(ui.controls(), "Generieren").isDisabled(),
                    "next JavaFX turn keeps duplicate generation disabled");
            assertTrue(isEffectivelyVisible(button(ui.controls(), "Abbrechen")),
                    "next JavaFX turn exposes cancellation while the provider remains pending");
            button(ui.controls(), "Abbrechen").fire();
        });
        runOnFxThread(() -> assertEquals(
                SessionPreparationStatus.CANCELLED,
                pendingUi.get().planner().workspaceModel().current().preparation().status(),
                "cancel intent is visible on the following JavaFX turn"));
    }

    @Test
    void savingControlsReflectPlannerCommitCancellationBoundary() throws Exception {
        runOnFxThread(SessionPlannerCatalogTest::assertSavingCancellationBoundary);
    }

    @Test
    void bindingConsumesExactlyOneWorkspacePublication() throws Exception {
        runOnFxThread(() -> {
            SessionPlannerServiceAssembly planner = services().planner();
            int[] subscriptions = {0};
            SessionPlannerWorkspaceModel counted = new SessionPlannerWorkspaceModel(
                    planner.workspaceModel()::current,
                    listener -> {
                        subscriptions[0]++;
                        return planner.workspaceModel().subscribe(listener);
                    });

            new SessionPlannerContribution(planner.application(), counted, ignored -> { }).bind();

            assertEquals(1, subscriptions[0],
                    "catalog, controls, timeline, summary, and preparation share one workspace subscription");
        });
    }

    @Test
    void selectedSceneAutoOpenPreservesDraftsAndResetsAcrossSessions() throws Exception {
        runOnFxThread(SessionPlannerCatalogTest::assertSelectedSceneReconciliation);
    }

    @Test
    void encounterSearchIsDemandDrivenAndBounded() throws Exception {
        runOnFxThread(SessionPlannerCatalogTest::assertEncounterSearchIsDemandDrivenAndBounded);
    }

    @Test
    void masterDetailUsesOneReusableInspectorAndPreservesEditorState() throws Exception {
        runOnFxThread(SessionPlannerCatalogTest::assertReusableSelectedSceneInspector);
    }

    @Test
    void workspaceFeedbackEncounterDayValidationAndRestAccessibilityUsePublishedWorkspace() throws Exception {
        runOnFxThread(SessionPlannerCatalogTest::assertWorkspaceFeedbackAndEncounterDayValidation);
    }

    private static void assertSavingCancellationBoundary() {
        SessionPlannerControlsView controls = new SessionPlannerControlsView();
        SessionPlannerViewModel viewModel = new SessionPlannerViewModel();
        controls.bind(viewModel);
        SessionPreparationSnapshot preCommitSaving = new SessionPreparationSnapshot(
                SessionPreparationStatus.SAVING,
                "Session wird gespeichert …",
                7L,
                4L,
                true);
        SessionPlannerSessionSnapshot session = new SessionPlannerSessionSnapshot(
                new SessionPlannerSessionSnapshot.SessionState(7L, "Session", BigDecimal.ONE, "1", 0L, false),
                SessionPlannerSessionSnapshot.XpBudgetState.empty(),
                SessionPlannerSessionSnapshot.RestAdviceState.empty(),
                "");
        viewModel.applyWorkspace(new features.sessionplanner.api.SessionPlannerWorkspaceSnapshot(
                1L, 7L, 1L, SessionPlannerCatalogSnapshot.empty(), session,
                features.sessionplanner.api.SessionPlannerParticipantsProjection.empty(),
                SessionPlannerSceneTimelineProjection.empty(),
                SessionPlannerSelectedSceneSnapshot.empty(), preCommitSaving, List.of()));

        Parent content = (Parent) controls.getContent();
        assertTrue(button(content, "Generieren").isDisabled(),
                "generation action is disabled during pre-commit saving");
        assertTrue(isEffectivelyVisible(button(content, "Abbrechen")),
                "pre-commit saving keeps cancellation visible");
        assertTrue(isEffectivelyVisible(descendant(content, ProgressBar.class)),
                "pre-commit saving keeps progress visible");

        SessionPreparationSnapshot finalCommitSaving = new SessionPreparationSnapshot(
                SessionPreparationStatus.SAVING,
                "Vorbereitete Session wird gespeichert …",
                7L,
                4L,
                false);
        viewModel.applyWorkspace(new features.sessionplanner.api.SessionPlannerWorkspaceSnapshot(
                2L, 7L, 1L, SessionPlannerCatalogSnapshot.empty(), session,
                features.sessionplanner.api.SessionPlannerParticipantsProjection.empty(),
                SessionPlannerSceneTimelineProjection.empty(),
                SessionPlannerSelectedSceneSnapshot.empty(), finalCommitSaving, List.of()));

        assertTrue(button(content, "Generieren").isDisabled(),
                "generation action remains disabled during final Planner commit");
        assertTrue(!isEffectivelyVisible(button(content, "Abbrechen")),
                "final Planner commit hides cancellation");
        assertTrue(isEffectivelyVisible(descendant(content, ProgressBar.class)),
                "final Planner commit keeps progress visible");
    }

    private static PendingPreparationUi openPendingDraft(SessionGenerationApi generation) {
        SessionPlannerTestServices services = services(generation);
        seedActiveParty(services);
        SessionPlannerServiceAssembly planner = services.planner();
        ShellBinding binding = new SessionPlannerContribution(
                planner.application(), planner.workspaceModel(), ignored -> { }).bind();
        Parent controls = slot(binding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        Stage stage = new Stage();
        stage.setScene(new Scene(controls, 420.0, 720.0));
        stage.show();
        planner.application().createSession(new SessionPlannerCatalogCommand.CreateSessionCommand("Pending"));
        services.party().application().activeParty().current().memberIds().forEach(characterId ->
                planner.application().addParticipant(SessionPlannerParticipantCommand.add(
                        new features.sessionplanner.api.SessionPlannerAuthoredTarget(
                                planner.workspaceModel().current().sourceSessionId(),
                                planner.workspaceModel().current().sourceSessionRevision()), characterId)));
        layout(controls);

        button(controls, "Generieren").fire();
        assertEquals(SessionPreparationStatus.GENERATING,
                planner.workspaceModel().current().preparation().status(),
                "generation remains pending until provider completion; preparation="
                        + planner.workspaceModel().current().preparation());
        assertTrue(button(controls, "Generieren").isDisabled(),
                "pending generation prevents duplicate submission");

        return new PendingPreparationUi(controls, planner);
    }

    private record PendingPreparationUi(Parent controls, SessionPlannerServiceAssembly planner) {
    }

    private static void assertWorkspaceFeedbackAndEncounterDayValidation() {
        SessionPlannerTestServices services = services();
        SessionPlannerServiceAssembly planner = services.planner();
        ShellBinding binding = new SessionPlannerContribution(
                planner.application(), planner.workspaceModel(), ignored -> { }).bind();
        Parent controls = slot(binding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        Stage stage = new Stage();
        stage.setScene(new Scene(controls, 560.0, 480.0));
        stage.show();
        layout(controls);
        createSession(controls, "Validation");
        TextField days = encounterDaysField(controls);
        long revisionBeforeInvalidInput = planner.workspaceModel().current().sourceSessionRevision();

        days.setText("abc");
        button(controls, "Übernehmen").fire();
        assertEquals(Long.valueOf(revisionBeforeInvalidInput),
                Long.valueOf(planner.workspaceModel().current().sourceSessionRevision()),
                "non-decimal encounter days dispatch no write through the bound contribution");
        assertEncounterDaysError(controls);

        days.setText("0");
        button(controls, "Übernehmen").fire();
        assertEquals(Long.valueOf(revisionBeforeInvalidInput),
                Long.valueOf(planner.workspaceModel().current().sourceSessionRevision()),
                "zero encounter days dispatch no write through the defensive binder");
        assertEncounterDaysError(controls);

        days.setText("1.5");
        button(controls, "Übernehmen").fire();
        layout(controls);
        assertTrue(planner.workspaceModel().current().sourceSessionRevision() > revisionBeforeInvalidInput,
                "valid encounter days dispatch through the binder writes authoritative Session truth");
        assertTrue(!isEffectivelyVisible(labelByStyle(controls, "session-planner-gap-active")),
                "the authoritative workspace publication clears the inline encounter-days error");

        SessionPlannerViewModel viewModel = new SessionPlannerViewModel();
        SessionPlannerControlsView feedbackControls = new SessionPlannerControlsView();
        SessionPlannerStateView feedbackState = new SessionPlannerStateView();
        SessionPlannerTimelineMainView feedbackTimeline = new SessionPlannerTimelineMainView();
        feedbackControls.bind(viewModel);
        feedbackState.bind(viewModel);
        feedbackTimeline.bind(viewModel);

        SessionPlannerWorkspaceSnapshot withFeedback = workspaceFixture(
                20L,
                new SessionPlannerSessionSnapshot.RestAdviceState(
                        false, 0, 0, 0, 0, "Rastempfehlung wird noch ermittelt."),
                List.of(
                        new SessionPlannerWorkspaceSnapshot.Issue(
                                SessionPlannerWorkspaceSnapshot.Owner.ENCOUNTER,
                                SessionPlannerWorkspaceSnapshot.Kind.UNAVAILABLE,
                                "501", "Encounter-Plan 501 ist nicht verfügbar."),
                        new SessionPlannerWorkspaceSnapshot.Issue(
                                SessionPlannerWorkspaceSnapshot.Owner.ENCOUNTER,
                                SessionPlannerWorkspaceSnapshot.Kind.UNAVAILABLE,
                                "501", "Encounter-Plan 501 ist nicht verfügbar."),
                        new SessionPlannerWorkspaceSnapshot.Issue(
                                SessionPlannerWorkspaceSnapshot.Owner.PARTY,
                                SessionPlannerWorkspaceSnapshot.Kind.OWNER_FAILURE,
                                "77", "Gruppendaten konnten nicht geladen werden.")))
                .withPreparation(new SessionPreparationSnapshot(
                        SessionPreparationStatus.FAILED, "Vorbereitung fehlgeschlagen.", 91L, 3L, false));
        viewModel.applyWorkspace(withFeedback);
        Parent feedbackControlsContent = (Parent) feedbackControls.getContent();
        Label workspaceStatus = labelByStyle(feedbackControlsContent, "session-planner-workspace-status");
        assertEquals("Hinweis: Gruppendaten konnten nicht geladen werden. · Encounter-Plan 501 ist nicht verfügbar.",
                workspaceStatus.getText(), "workspace issues are deduplicated and sorted into one compact status");
        assertEquals("Workspace-Status: " + workspaceStatus.getText(), workspaceStatus.getAccessibleText(),
                "workspace issue status is explicitly available to assistive technology");
        assertTrue(!workspaceStatus.getText().contains("Vorbereitung"),
                "workspace feedback remains separate from preparation status");
        assertTrue(hasLabel(feedbackControlsContent, "Vorbereitung fehlgeschlagen."),
                "preparation status remains its own compact toolbar message");
        Parent feedbackStateContent = (Parent) feedbackState.getContent();
        assertTrue(hasLabel(feedbackStateContent, "Rastempfehlung wird noch ermittelt."),
                "unavailable rest advice shows its summary instead of placeholder zero counts");
        assertTrue(!hasLabelContaining(feedbackStateContent, "Empfohlen 0 kurz"),
                "unavailable rest advice renders no numeric rest counts");

        viewModel.applyWorkspace(workspaceFixture(
                21L,
                new SessionPlannerSessionSnapshot.RestAdviceState(
                        true, 1, 2, 1, 0, ""), List.of()));
        assertTrue(hasLabel(feedbackStateContent, "Empfohlen 1 kurz / 2 lang · platziert 1 kurz / 0 lang"),
                "available rest advice keeps the compact numeric summary");

        Parent timelineContent = (Parent) feedbackTimeline.getContent();
        List<javafx.scene.layout.HBox> separators = descendants(timelineContent).stream()
                .filter(javafx.scene.layout.HBox.class::isInstance)
                .map(javafx.scene.layout.HBox.class::cast)
                .filter(node -> node.getStyleClass().contains("session-planner-rest-separator"))
                .toList();
        assertEquals(Integer.valueOf(2), Integer.valueOf(separators.size()),
                "two published rest gaps materialize two separators");
        assertTrue(!separators.get(0).getAccessibleText().equals(separators.get(1).getAccessibleText()),
                "each rest gap has distinct accessible context");
        assertTrue(separators.get(0).getAccessibleText().contains("Alpha")
                        && separators.get(0).getAccessibleText().contains("Beta"),
                "rest accessibility includes both ordered scene titles");
        assertRestButtonsAccessible(separators.get(0), "Alpha", "Beta");
        assertRestButtonsAccessible(separators.get(1), "Beta", "Gamma");

        viewModel.applyWorkspace(reorderedWorkspaceFixture());
        assertTrue(separators.get(0).getAccessibleText().contains("Gamma umbenannt")
                        && separators.get(0).getAccessibleText().contains("Beta umbenannt"),
                "reorder and rename refresh the existing rest separator accessibility text");
        assertRestButtonsAccessible(separators.get(0), "Gamma umbenannt", "Beta umbenannt");
        assertRestButtonsAccessible(separators.get(1), "Beta umbenannt", "Alpha umbenannt");
    }

    private static void assertRestButtonsAccessible(
            javafx.scene.layout.HBox separator,
            String leftSceneTitle,
            String rightSceneTitle
    ) {
        for (String buttonText : List.of("Kurze Rast", "Lange Rast", "Leeren")) {
            String accessibleText = button(separator, buttonText).getAccessibleText();
            assertTrue(!accessibleText.isBlank()
                            && accessibleText.contains(leftSceneTitle)
                            && accessibleText.contains(rightSceneTitle),
                    buttonText + " has scene-pair-specific accessibility text");
        }
    }

    private static void assertEncounterDaysError(Parent controls) {
        Label error = labelByStyle(controls, "session-planner-gap-active");
        assertTrue(isEffectivelyVisible(error), "invalid encounter days show a local inline error");
        assertEquals("Encounter-Tage muss eine positive Dezimalzahl sein.", error.getText(),
                "invalid encounter days use one actionable error message");
        assertEquals(error.getText(), encounterDaysField(controls).getAccessibleHelp(),
                "invalid encounter days expose the same error as field help");
    }

    private static SessionPlannerWorkspaceSnapshot workspaceFixture(
            long publicationRevision,
            SessionPlannerSessionSnapshot.RestAdviceState restAdvice,
            List<SessionPlannerWorkspaceSnapshot.Issue> issues
    ) {
        return new SessionPlannerWorkspaceSnapshot(
                publicationRevision, 91L, publicationRevision,
                SessionPlannerCatalogSnapshot.empty(), new SessionPlannerSessionSnapshot(
                        new SessionPlannerSessionSnapshot.SessionState(91L, "Feedback", BigDecimal.ONE, "1", 0L, false),
                        SessionPlannerSessionSnapshot.XpBudgetState.empty(), restAdvice, ""),
                features.sessionplanner.api.SessionPlannerParticipantsProjection.empty(),
                new SessionPlannerSceneTimelineProjection(
                        List.of(
                                sceneHeader(1L, "Alpha", true),
                                sceneHeader(2L, "Beta", false),
                                sceneHeader(3L, "Gamma", false)),
                        List.of(
                                new SessionPlannerSceneTimelineProjection.RestGap(
                                        0, 1L, 2L, SessionPlannerRestKind.NONE),
                                new SessionPlannerSceneTimelineProjection.RestGap(
                                        1, 2L, 3L, SessionPlannerRestKind.LONG_REST))),
                SessionPlannerSelectedSceneSnapshot.empty(), SessionPreparationSnapshot.idle(), issues);
    }

    private static SessionPlannerWorkspaceSnapshot reorderedWorkspaceFixture() {
        return new SessionPlannerWorkspaceSnapshot(
                22L, 91L, 22L, SessionPlannerCatalogSnapshot.empty(), new SessionPlannerSessionSnapshot(
                        new SessionPlannerSessionSnapshot.SessionState(91L, "Feedback", BigDecimal.ONE, "1", 0L, false),
                        SessionPlannerSessionSnapshot.XpBudgetState.empty(),
                        SessionPlannerSessionSnapshot.RestAdviceState.empty(), ""),
                features.sessionplanner.api.SessionPlannerParticipantsProjection.empty(),
                new SessionPlannerSceneTimelineProjection(
                        List.of(
                                sceneHeader(3L, "Gamma umbenannt", true),
                                sceneHeader(2L, "Beta umbenannt", false),
                                sceneHeader(1L, "Alpha umbenannt", false)),
                        List.of(
                                new SessionPlannerSceneTimelineProjection.RestGap(
                                        0, 3L, 2L, SessionPlannerRestKind.SHORT_REST),
                                new SessionPlannerSceneTimelineProjection.RestGap(
                                        1, 2L, 1L, SessionPlannerRestKind.NONE))),
                SessionPlannerSelectedSceneSnapshot.empty(), SessionPreparationSnapshot.idle(), List.of());
    }

    private static SessionPlannerSceneTimelineProjection.SceneHeader sceneHeader(
            long token,
            String title,
            boolean selected
    ) {
        return new SessionPlannerSceneTimelineProjection.SceneHeader(
                token, title, 0L, false, "", "", 0, 0, "", "", BigDecimal.ZERO, 0,
                selected, "Keine Location", false, false);
    }

    private static void runTest() {
        SessionPlannerTestServices services = services();
        long locationId = seedLocation(services);
        SessionPlannerServiceAssembly planner = services.planner();
        ShellBinding binding = new SessionPlannerContribution(
                planner.application(), planner.workspaceModel(), ignored -> { }).bind();
        Parent controls = slot(binding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        Parent main = slot(binding, ShellSlot.COCKPIT_MAIN, Parent.class);
        Parent state = slot(binding, ShellSlot.COCKPIT_STATE, Parent.class);
        SessionPlannerWorkspaceModel workspace = planner.workspaceModel();

        Stage stage = new Stage();
        HBox root = new HBox(controls, main, state);
        stage.setScene(new Scene(root, 1_260.0, 760.0));
        stage.show();
        layout(root);

        assertSetupLivesInControls(controls);
        Parent stateContent = (Parent) ((javafx.scene.control.ScrollPane) state).getContent();
        assertTrue(hasLabel(stateContent, "Keine Szene ausgewählt."),
                "state slot renders a clear no-selection state instead of empty labels; labels="
                        + descendants(stateContent).stream().filter(Label.class::isInstance)
                                .map(Label.class::cast).map(Label::getText).toList());
        assertSceneLootTargetsSceneCards();
        assertCatalogSize(workspace.current().catalog(), 0, "initial catalog is empty");
        assertTrue(!hasLabel(main, "Session #0"), "initial main does not show default Session #0");
        assertTrue(button(controls, "Übernehmen").isDisabled(), "initial setup disables session mutation");
        encounterDaysField(controls).setText("2");
        button(controls, "Übernehmen").fire();
        assertCatalogSize(workspace.current().catalog(), 0, "session-bound action before create does not seed a session");

        createSession(controls, "Alpha");
        SessionPlannerCatalogSnapshot afterAlpha = workspace.current().catalog();
        assertCatalogSize(afterAlpha, 1, "create adds first session");
        long alphaId = only(afterAlpha).sessionId();
        assertEquals("Alpha", only(afterAlpha).displayName(), "create stores display name");
        assertEquals(alphaId, afterAlpha.selectedSessionId(), "create selects new session");
        assertEquals("Alpha", workspace.current().currentSession().session().displayName(),
                "current session display name after create");

        encounterDaysField(controls).setText("2");
        button(controls, "Übernehmen").fire();
        assertEquals("2", workspace.current().currentSession().session().encounterDaysText(),
                "session content mutation before rename");

        button(main, "Szene hinzufügen").fire();
        layout(main);
        assertEquals(Integer.valueOf(1), Integer.valueOf(workspace.current().sceneTimeline().sceneHeaders().size()),
                "add scene creates one session scene");
        assertEquals(Long.valueOf(0L),
                Long.valueOf(workspace.current().sceneTimeline().sceneHeaders().getFirst().linkedEncounterPlanId()),
                "added scene has no linked encounter plan");
        expandScene(main, 0);
        assertTrue(hasLabel(main, "Keine Begegnung verknüpft."), "expanded blank scene shows no false encounter data");
        button(main, "X").fire();
        layout(main);
        assertEquals(Integer.valueOf(0), Integer.valueOf(workspace.current().sceneTimeline().sceneHeaders().size()),
                "scene X removes only the session scene representation");

        renameSelectedSession(controls, "Alpha Prime");
        SessionPlannerSessionSnapshot renamedCurrent = workspace.current().currentSession();
        assertEquals("Alpha Prime", renamedCurrent.session().displayName(), "rename updates display name");
        assertEquals("2", renamedCurrent.session().encounterDaysText(), "rename preserves session content");

        createSession(controls, "Beta");
        SessionPlannerCatalogSnapshot afterBeta = workspace.current().catalog();
        assertCatalogSize(afterBeta, 2, "second create adds catalog row");
        long betaId = afterBeta.selectedSessionId();
        assertEquals("Beta", workspace.current().currentSession().session().displayName(), "second create selects Beta");

        selectSession(controls, alphaId);
        assertEquals(alphaId, workspace.current().catalog().selectedSessionId(), "select updates catalog selected id");
        assertEquals("Alpha Prime", workspace.current().currentSession().session().displayName(),
                "select loads renamed session");
        assertEquals("2", workspace.current().currentSession().session().encounterDaysText(),
                "select preserves renamed session content");

        deleteSelectedSession(controls);
        SessionPlannerCatalogSnapshot afterDeleteAlpha = workspace.current().catalog();
        assertCatalogSize(afterDeleteAlpha, 1, "delete removes selected session");
        assertEquals(betaId, afterDeleteAlpha.selectedSessionId(), "delete falls back to remaining stable session");
        assertEquals("Beta", workspace.current().currentSession().session().displayName(),
                "delete fallback loads remaining session");

        deleteSelectedSession(controls);
        SessionPlannerCatalogSnapshot afterDeleteLast = workspace.current().catalog();
        assertCatalogSize(afterDeleteLast, 1, "delete last session seeds replacement session");
        assertTrue(afterDeleteLast.selectedSessionId() > 0L, "replacement session uses a stable id");
        assertEquals(afterDeleteLast.selectedSessionId(), workspace.current().currentSession().session().sessionId(),
                "replacement session is current");
        assertTrue(!"Beta".equals(workspace.current().currentSession().session().displayName()),
                "replacement session is seeded");

        createSession(controls, "Gamma");
        SessionPlannerCatalogSnapshot afterCreatePostDelete = workspace.current().catalog();
        assertCatalogSize(afterCreatePostDelete, 2, "create after delete-last adds a new session");
        assertEquals("Gamma", workspace.current().currentSession().session().displayName(),
                "create after delete-last selects Gamma");
        assertTrue(afterCreatePostDelete.sessions().stream().anyMatch(session -> "Gamma".equals(session.displayName())),
                "create after delete-last publishes Gamma");
        assertProductionRouteTimelineInteractions(
                services,
                controls,
                main,
                workspace,
                locationId);
        assertProductionRouteGeneratedSession(controls, main, workspace);
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
        assertTrue(hasLabel(controls, "Encounter-Tage"), "controls expose the compact preparation toolbar");
    }

    private static void expandScene(Parent main, int index) {
        List<Button> toggles = descendants(main).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> button.getStyleClass().contains("session-planner-scene-toggle"))
                .toList();
        if (index >= toggles.size()) {
            throw new AssertionError("Scene toggle not found at index " + index);
        }
        if (toggles.get(index).getText().startsWith("▶")) {
            toggles.get(index).fire();
        }
        layout(main);
    }

    private static void assertSceneLootTargetsSceneCards() {
        SessionPlan plan = SessionPlan.seeded(77L, List.of(), EncounterDays.one())
                .addScene()
                .attachEncounter(1L, 101L)
                .addScene()
                .selectEncounter(2L)
                .attachEncounter(2L, 202L)
                .addManualLootNote(1L, "First")
                .addManualLootNote(2L, "Second")
                .addManualLootNote(1L, "Third");
        assertEquals(Integer.valueOf(3), Integer.valueOf(plan.manualLootNotes().size()),
                "manual notes are stored on the session plan");
        assertEquals(Long.valueOf(1L), Long.valueOf(plan.manualLootNotes().get(0).sceneId()),
                "first manual note stores its scene target");
        assertEquals(Long.valueOf(2L), Long.valueOf(plan.manualLootNotes().get(1).sceneId()),
                "second manual note stores its scene target");

        SessionPlan afterRemoval = plan.removeEncounter(1L);
        assertEquals(Integer.valueOf(1), Integer.valueOf(afterRemoval.manualLootNotes().size()),
                "removing a scene prunes its manual notes");
        assertEquals(Long.valueOf(2L), Long.valueOf(afterRemoval.manualLootNotes().getFirst().sceneId()),
                "remaining manual note keeps the surviving scene target");

        SessionPlannerSceneTimelineProjection projection = new SessionPlannerSceneTimelineProjection(
                List.of(new SessionPlannerSceneTimelineProjection.SceneHeader(
                        1L, "Gate Watch", 101L, true, "Crypt", "", 2, 150,
                        "Medium", "", BigDecimal.valueOf(50L), 200, true,
                        "Old Gate", false, false)),
                List.of());
        SessionPlannerViewModel viewModel = new SessionPlannerViewModel();
        SessionPlannerSessionSnapshot session = new SessionPlannerSessionSnapshot(
                new SessionPlannerSessionSnapshot.SessionState(7L, "Session", BigDecimal.ONE, "1", 1L, true),
                SessionPlannerSessionSnapshot.XpBudgetState.empty(),
                SessionPlannerSessionSnapshot.RestAdviceState.empty(),
                "");
        SessionPlannerSelectedSceneSnapshot selected = new SessionPlannerSelectedSceneSnapshot(
                true, 1L, "Gate Watch", "guards count torches", 7L,
                List.of(new SessionPlannerSelectedSceneSnapshot.LocationChoice(0L, "Keine Location"),
                        new SessionPlannerSelectedSceneSnapshot.LocationChoice(7L, "Old Gate"),
                        new SessionPlannerSelectedSceneSnapshot.LocationChoice(10L, "Moonwell")),
                BigDecimal.valueOf(50L), 200, 101L, true, "Crypt", "", 2, 100, 150, 1.5,
                "Medium", "", List.of(new SessionPlannerSelectedSceneSnapshot.EncounterRosterLine(
                        81L, 2, "Goblin")),
                List.of(new SessionPlannerSelectedSceneSnapshot.ManualLootNote(10L, "Cache")),
                List.of(), features.sessionplanner.api.SessionEncounterPlanSearchSnapshot.idle());
        viewModel.applyWorkspace(new features.sessionplanner.api.SessionPlannerWorkspaceSnapshot(
                1L, 7L, 1L, SessionPlannerCatalogSnapshot.empty(), session,
                features.sessionplanner.api.SessionPlannerParticipantsProjection.empty(), projection,
                selected,
                SessionPreparationSnapshot.idle(), List.of()));
        assertEquals(Integer.valueOf(1), Integer.valueOf(
                        viewModel.timelineProjectionProperty().get().selectedScene().manualLootNotes().size()),
                "timeline model keeps manual notes inside the scene inspector");
        assertEquals("Old Gate", viewModel.timelineProjectionProperty().get().scenes().getFirst().locationLabel(),
                "timeline model resolves scene location labels from World Planner locations");
        assertEquals(Integer.valueOf(2),
                Integer.valueOf(viewModel.timelineProjectionProperty().get().selectedScene().locationChoices().size() - 1),
                "timeline model exposes World Planner locations for scene selection");
        assertEquals("Gate Watch",
                viewModel.timelineProjectionProperty().get().selectedScene().sceneTitle(),
                "timeline model exposes the persisted scene title directly without a draft layer");
    }

    private static void assertProductionRouteTimelineInteractions(
            SessionPlannerTestServices services,
            Parent controls,
            Parent main,
            SessionPlannerWorkspaceModel workspace,
            long locationId
    ) {
        seedActiveParty(services);
        encounterDaysField(controls).setText("1");
        button(controls, "Übernehmen").fire();
        layout(controls);
        comboBoxContaining(controls, "Cora - Level 4");

        button(controls, "Teilnehmer (0)").fire();
        comboBoxByPrompt(controls, "Party-Mitglied").getSelectionModel().selectFirst();
        button(controls, "Hinzufügen").fire();
        layout(controls);
        assertEquals(Integer.valueOf(1), Integer.valueOf(workspace.current().participants().participants().size()),
                "participant add through setup section publishes one participant");
        assertEquals("Cora", workspace.current().participants().participants().getFirst().name(),
                "participant add through setup section resolves active party member");
        assertTrue(hasLabel(controls, "Cora"), "participant add renders selected player in controls");
        button(controls, "Entfernen").fire();
        layout(controls);
        assertEquals(Integer.valueOf(0), Integer.valueOf(workspace.current().participants().participants().size()),
                "participant remove through setup section publishes empty participants");

        button(main, "Szene hinzufügen").fire();
        button(main, "Szene hinzufügen").fire();
        layout(main);
        expandScene(main, 0);
        TextField planSearch = visibleTextField(main, "Encounter suchen");
        planSearch.setText("unbekannte schwierigkeit");
        layout(main);
        assertTrue(hasLabelContaining(main, "Keine gespeicherten Encounter gefunden"),
                "selected-scene search reports a provider-backed no-match state");
        planSearch.setText("Medium");
        layout(main);
        assertTrue(hasLabel(main, "Ash Gate Ambush"),
                "selected-scene search matches snapshot plans by name, difficulty and summary");
        button(main, "Verknüpfen").fire();
        layout(main);
        expandScene(main, 1);
        visibleTextField(main, "Encounter suchen").setText("Medium");
        button(main, "Verknüpfen").fire();
        layout(main);
        SessionPlannerSceneTimelineProjection afterAttach = workspace.current().sceneTimeline();
        assertEquals(Integer.valueOf(2), Integer.valueOf(afterAttach.sceneHeaders().size()),
                "saved encounter attach in the inspectors keeps two authored scene cards");
        assertEquals(Long.valueOf(SAVED_ENCOUNTER_PLAN_ID),
                Long.valueOf(afterAttach.sceneHeaders().getFirst().linkedEncounterPlanId()),
                "saved encounter attach publishes linked plan id");
        expandScene(main, 0);
        assertTrue(hasLabel(main, "Ash Gate Ambush"), "expanded scene card renders linked plan name");
        assertTrue(hasLabel(main, "2 × Ash guard"),
                "selected inspector renders the concrete typed Encounter roster");
        button(main, "Encounter lösen").fire();
        layout(main);
        assertEquals(Integer.valueOf(2), Integer.valueOf(workspace.current().sceneTimeline().sceneHeaders().size()),
                "detach keeps the authored scene in the ordered timeline");
        assertEquals(Long.valueOf(0L), Long.valueOf(workspace.current().sceneTimeline().sceneHeaders().getFirst()
                .linkedEncounterPlanId()), "detach removes only the selected scene reference");
        TextField reattachSearch = visibleTextField(main, "Encounter suchen");
        reattachSearch.clear();
        reattachSearch.setText("Medium");
        button(main, "Verknüpfen").fire();
        layout(main);
        assertEquals(Long.valueOf(SAVED_ENCOUNTER_PLAN_ID),
                Long.valueOf(workspace.current().sceneTimeline().sceneHeaders().getFirst().linkedEncounterPlanId()),
                "the same selected inspector can attach again after detach");

        long firstScene = afterAttach.sceneHeaders().get(0).sceneToken();
        long secondScene = afterAttach.sceneHeaders().get(1).sceneToken();
        textField(main, "Szenentitel").setText("Gate Alarm");
        textArea(main, "Szenennotizen").setText("ring twice");
        selectComboBoxItem(main, "#" + locationId + " | Old Gate");
        button(main, "Szene speichern").fire();
        layout(main);
        SessionPlannerSceneTimelineProjection afterSave = workspace.current().sceneTimeline();
        assertEquals("Gate Alarm", workspace.current().selectedScene().sceneTitle(),
                "scene save through card stores title");
        assertEquals("ring twice", workspace.current().selectedScene().sceneNotes(),
                "scene save through card stores notes");
        assertEquals(Long.valueOf(locationId), Long.valueOf(workspace.current().selectedScene().locationId()),
                "scene save through card stores location id");
        assertTrue(hasLabel(main, "Old Gate"), "scene header renders saved location label");

        expandScene(main, 0);
        visibleTextField(main, "Neue Beutenotiz").setText("Hidden cache beneath the altar");
        buttons(main, "Hinzufügen").getFirst().fire();
        layout(main);
        assertEquals(Integer.valueOf(1),
                Integer.valueOf(workspace.current().selectedScene().manualLootNotes().size()),
                "manual note add through scene card publishes note");
        assertEquals("Hidden cache beneath the altar",
                workspace.current().selectedScene().manualLootNotes().getFirst().authoredText(),
                "manual note renders the exact authored content");
        TextField manualNote = manualNoteField(main);
        manualNote.setText("Edited cache beneath the altar");
        manualNote.requestFocus();
        manualNote.selectRange(2, 8);
        services.planner().application().setEncounterDays(
                new features.sessionplanner.api.SetSessionEncounterDaysCommand(
                        new features.sessionplanner.api.SessionPlannerAuthoredTarget(
                                workspace.current().sourceSessionId(), workspace.current().sourceSessionRevision()),
                        new BigDecimal("1.1")));
        layout(main);
        assertEquals("Edited cache beneath the altar", manualNote.getText(),
                "same-scene publication preserves a keyed dirty manual-note editor");
        assertTrue(manualNote.isFocused() && manualNote.getAnchor() == 2
                        && manualNote.getCaretPosition() == 8,
                "same-scene publication preserves manual-note focus and caret selection");
        button(main, "Speichern").fire();
        layout(main);
        assertEquals("Edited cache beneath the altar",
                workspace.current().selectedScene().manualLootNotes().getFirst().authoredText(),
                "existing authored note update flows through the real inspector contribution");
        button(main, "Entfernen").fire();
        layout(main);
        assertEquals(Integer.valueOf(0),
                Integer.valueOf(workspace.current().selectedScene().manualLootNotes().size()),
                "manual note remove through scene card clears note");

        buttons(main, "+10%").getFirst().fire();
        layout(main);
        assertEquals("60", workspace.current().selectedScene()
                        .budgetPercentage().stripTrailingZeros().toPlainString(),
                "allocation increase through scene card raises first scene");
        buttons(main, "-10%").getFirst().fire();
        layout(main);
        assertEquals("50", workspace.current().selectedScene()
                        .budgetPercentage().stripTrailingZeros().toPlainString(),
                "allocation decrease through scene card restores first scene");

        expandScene(main, 1);
        assertEquals(Long.valueOf(secondScene),
                Long.valueOf(workspace.current().currentSession().session().selectedEncounterId()),
                "expanding a scene card selects it as the current scene");
        assertTrue(workspace.current().sceneTimeline().sceneHeaders().stream()
                        .anyMatch(scene -> scene.sceneToken() == secondScene && scene.selected()),
                "expanding a scene card publishes the selected scene");

        button(main, "Kurze Rast").fire();
        layout(main);
        assertEquals(SessionPlannerRestKind.SHORT_REST,
                workspace.current().sceneTimeline().restGaps().getFirst().restKind(),
                "rest set through gap separator publishes short rest");
        assertTrue(hasLabelContaining(main, "Kurze Rast"), "rest set through gap separator renders short rest");
        button(main, "Leeren").fire();
        layout(main);
        assertEquals(SessionPlannerRestKind.NONE,
                workspace.current().sceneTimeline().restGaps().getFirst().restKind(),
                "rest clear through gap separator publishes no rest");

        expandScene(main, 0);
        enabledButtons(main, "Runter").getFirst().fire();
        layout(main);
        assertEquals(Long.valueOf(secondScene),
                Long.valueOf(workspace.current().sceneTimeline().sceneHeaders().getFirst().sceneToken()),
                "scene move down through card reorders first scene");
        enabledButtons(main, "Hoch").getFirst().fire();
        layout(main);
        assertEquals(Long.valueOf(firstScene),
                Long.valueOf(workspace.current().sceneTimeline().sceneHeaders().getFirst().sceneToken()),
                "scene move up through card restores order");

        buttons(main, "X").getFirst().fire();
        layout(main);
        assertEquals(Integer.valueOf(1),
                Integer.valueOf(workspace.current().sceneTimeline().sceneHeaders().size()),
                "scene remove through linked scene card removes one scene");
    }

    private static void assertProductionRouteGeneratedSession(
            Parent controls,
            Parent main,
            SessionPlannerWorkspaceModel workspace
    ) {
        comboBoxByPrompt(controls, "Party-Mitglied").getSelectionModel().selectFirst();
        button(controls, "Hinzufügen").fire();
        layout(controls);
        assertEquals(Integer.valueOf(1), Integer.valueOf(workspace.current().participants().participants().size()),
                "generation route has one resolved session participant");
        int scenesBeforePreparation = workspace.current().sceneTimeline().sceneHeaders().size();

        button(controls, "Generieren").fire();
        layout(controls);

        assertEquals(Integer.valueOf(scenesBeforePreparation),
                Integer.valueOf(workspace.current().sceneTimeline().sceneHeaders().size()),
                "replacement confirmation performs no Session mutation");
        assertTrue(hasLabelContaining(controls, "Vorhandene Szenen"),
                "generation reveals the inline replacement warning");
        assertTrue(isEffectivelyVisible(button(controls, "Ersetzen und generieren")),
                "replacement requires explicit confirmation");

        button(controls, "Ersetzen und generieren").fire();
        layout(main);

        assertEquals(Integer.valueOf(1), Integer.valueOf(workspace.current().sceneTimeline().sceneHeaders().size()),
                "confirmed generation replaces the timeline");
        assertEquals(Long.valueOf(901L),
                Long.valueOf(workspace.current().sceneTimeline().sceneHeaders().getFirst().linkedEncounterPlanId()),
                "confirmed generation attaches imported Encounter plan");
        assertEquals(SessionPlannerSelectedSceneSnapshot.Availability.AVAILABLE,
                workspace.current().selectedScene().generatedRewards().getFirst().availability(),
                "reopened reward keeps typed generated availability");
        expandScene(main, 0);
        assertTrue(hasLabel(main, "Verfügbar · ENCOUNTER · NORMAL"),
                "available reward renders availability, channel and stock class");
        assertTrue(hasLabel(main, "Thema Vault · Magie none · Ziel 100 cp"),
                "available reward renders theme, magic type and target value");
        assertTrue(hasLabel(main, "Slots 1 nichtmagisch / 0 magisch"),
                "available reward renders both typed slot counts");
        assertTrue(hasLabel(main,
                        "2 × Generated cache · 250 cp · USEFUL / cache · RARE · verflucht"
                                + " · Kapazität 3.5 · Behälter chest, sack"),
                "item row renders quantity, text, value, role, id, rarity, curse, capacity and allowed containers");
        assertTrue(hasLabel(main, "2 × chest · iron-chest · gültig"),
                "packing row renders container type, count, id and validity");
    }

    private static void assertSelectedSceneReconciliation() {
        SessionPlannerTestServices services = services();
        long locationId = seedLocation(services);
        SessionPlannerServiceAssembly planner = services.planner();
        ShellBinding binding = new SessionPlannerContribution(
                planner.application(), planner.workspaceModel(), ignored -> { }).bind();
        Parent controls = slot(binding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        Parent main = slot(binding, ShellSlot.COCKPIT_MAIN, Parent.class);
        Stage stage = new Stage();
        stage.setScene(new Scene(new HBox(controls, main), 1_000.0, 680.0));
        stage.show();

        createSession(controls, "First");
        long firstSessionId = planner.workspaceModel().current().sourceSessionId();
        button(main, "Szene hinzufügen").fire();
        layout(main);
        assertEquals("Szene 1", textField(main, "Szenentitel").getText(),
                "first selected scene auto-opens with its persisted title loaded exactly once");
        textField(main, "Szenentitel").setText("First persisted");
        textArea(main, "Szenennotizen").setText("first notes");
        selectComboBoxItem(main, "#" + locationId + " | Old Gate");
        button(main, "Szene speichern").fire();

        createSession(controls, "Second");
        long secondSessionId = planner.workspaceModel().current().sourceSessionId();
        button(main, "Szene hinzufügen").fire();
        layout(main);
        assertEquals("Szene 1", textField(main, "Szenentitel").getText(),
                "same scene token in a new session starts from the new session model");
        textField(main, "Szenentitel").setText("Second persisted");
        textArea(main, "Szenennotizen").setText("second notes");
        button(main, "Szene speichern").fire();

        selectSession(controls, firstSessionId);
        layout(main);
        assertEquals("First persisted", textField(main, "Szenentitel").getText(),
                "session switch auto-opens and loads the selected scene title");
        assertEquals("first notes", textArea(main, "Szenennotizen").getText(),
                "session switch loads persisted scene notes");
        assertEquals("#" + locationId + " | Old Gate", String.valueOf(locationCombo(main).getValue()),
                "session switch loads the persisted location");

        textField(main, "Szenentitel").setText("UNSAVED OLD TITLE");
        textArea(main, "Szenennotizen").setText("unsaved old notes");
        visibleTextField(main, "Neue Beutenotiz").setText("Keep draft alive");
        button(main, "Hinzufügen").fire();
        layout(main);
        assertEquals("UNSAVED OLD TITLE", textField(main, "Szenentitel").getText(),
                "workspace refresh does not overwrite focused unconfirmed title input");
        assertEquals("unsaved old notes", textArea(main, "Szenennotizen").getText(),
                "workspace refresh does not overwrite focused unconfirmed notes input");

        selectSession(controls, secondSessionId);
        layout(main);
        assertEquals("Second persisted", textField(main, "Szenentitel").getText(),
                "same-token session switch discards the old view draft without copying it");
        assertEquals("second notes", textArea(main, "Szenennotizen").getText(),
                "new session keeps its own persisted notes");
        assertEquals("Second persisted", planner.workspaceModel().current().selectedScene().sceneTitle(),
                "old session draft was not written into the new session");

        selectSession(controls, firstSessionId);
        layout(main);
        assertEquals("UNSAVED OLD TITLE", planner.workspaceModel().current().selectedScene().sceneTitle(),
                "catalog switch atomically commits the old dirty scene before returning to it");
        assertEquals("unsaved old notes", planner.workspaceModel().current().selectedScene().sceneNotes(),
                "the switched-away scene notes remain durable without copying into the target session");
    }

    private static void assertEncounterSearchIsDemandDrivenAndBounded() {
        SessionPlannerTimelineMainView view = new SessionPlannerTimelineMainView();
        SessionPlannerViewModel viewModel = new SessionPlannerViewModel();
        view.bind(viewModel);
        List<String> dispatchedQueries = new java.util.ArrayList<>();
        view.onSearchPlans((sceneToken, query) -> dispatchedQueries.add(sceneToken + ":" + query));
        SessionPlannerSceneTimelineProjection timeline = new SessionPlannerSceneTimelineProjection(
                List.of(
                        searchScene(1L, 999L, true),
                        searchScene(2L, 0L, false)),
                List.of(new SessionPlannerSceneTimelineProjection.RestGap(
                        0, 1L, 2L, SessionPlannerRestKind.NONE)));
        SessionPlannerSessionSnapshot session = new SessionPlannerSessionSnapshot(
                new SessionPlannerSessionSnapshot.SessionState(31L, "Search", BigDecimal.ONE, "1", 1L, true),
                SessionPlannerSessionSnapshot.XpBudgetState.empty(),
                SessionPlannerSessionSnapshot.RestAdviceState.empty(),
                "");
        viewModel.applyWorkspace(new features.sessionplanner.api.SessionPlannerWorkspaceSnapshot(
                1L, 31L, 1L, SessionPlannerCatalogSnapshot.empty(), session,
                features.sessionplanner.api.SessionPlannerParticipantsProjection.empty(), timeline,
                searchSelected(1L, 999L, features.sessionplanner.api.SessionEncounterPlanSearchSnapshot.idle()),
                SessionPreparationSnapshot.idle(), List.of()));
        Parent content = (Parent) view.getContent();

        assertTrue(hasLabelContaining(content, "Ab 2 Zeichen"),
                "empty selected-scene search renders only the search hint");
        assertTrue(!hasLabel(content, "Current saved") && !hasLabel(content, "Plan 01")
                        && buttons(content, "Verknüpfen").isEmpty(),
                "empty search renders neither plan names nor attach actions");
        TextField search = textField(content, "Encounter suchen");
        search.setText("P");
        assertEquals(List.of("1:P"), dispatchedQueries,
                "the selected-scene field dispatches one typed demand intent instead of filtering local facts");
        viewModel.applyWorkspace(new features.sessionplanner.api.SessionPlannerWorkspaceSnapshot(
                2L, 31L, 1L, SessionPlannerCatalogSnapshot.empty(), session,
                features.sessionplanner.api.SessionPlannerParticipantsProjection.empty(), timeline,
                searchSelected(1L, 999L, new features.sessionplanner.api.SessionEncounterPlanSearchSnapshot(
                        1L, 31L, 1L, 1L, "p",
                        features.sessionplanner.api.SessionEncounterPlanSearchSnapshot.Status.TOO_SHORT,
                        List.of(), false, "Mindestens 2 Zeichen eingeben.")),
                SessionPreparationSnapshot.idle(), List.of()));
        assertTrue(!hasLabel(content, "Plan 01"),
                "one-character search still materializes no plan result nodes");
        search.setText("Medium");
        List<features.sessionplanner.api.SessionEncounterPlanSearchSnapshot.Result> results =
                java.util.stream.Stream.concat(
                        java.util.stream.Stream.of(new features.sessionplanner.api.SessionEncounterPlanSearchSnapshot.Result(
                                999L, "Current saved", "Current summary", 100, "MEDIUM", "", true)),
                        java.util.stream.IntStream.rangeClosed(1, 7).mapToObj(index ->
                                new features.sessionplanner.api.SessionEncounterPlanSearchSnapshot.Result(
                                        index, "Plan " + String.format(java.util.Locale.ROOT, "%02d", index),
                                        "Summary " + index, 100 + index, "MEDIUM", "", true)))
                        .toList();
        viewModel.applyWorkspace(new features.sessionplanner.api.SessionPlannerWorkspaceSnapshot(
                3L, 31L, 1L, SessionPlannerCatalogSnapshot.empty(), session,
                features.sessionplanner.api.SessionPlannerParticipantsProjection.empty(), timeline,
                searchSelected(1L, 999L, new features.sessionplanner.api.SessionEncounterPlanSearchSnapshot(
                        2L, 31L, 1L, 1L, "medium",
                        features.sessionplanner.api.SessionEncounterPlanSearchSnapshot.Status.READY,
                        results, true, "")),
                SessionPreparationSnapshot.idle(), List.of()));
        assertEquals(Integer.valueOf(1), Integer.valueOf(buttons(content, "Verknüpft").size()),
                "the already linked plan is visible once as a disabled current relation");
        assertTrue(button(content, "Verknüpft").isDisabled(),
                "the already linked plan cannot dispatch a meaningless replacement");
        assertEquals(Integer.valueOf(7), Integer.valueOf(buttons(content, "Ersetzen").size()),
                "only eight compact results total are materialized for the expanded scene");
        assertTrue(hasLabel(content, "Plan 07") && !hasLabel(content, "Plan 08"),
                "results stop at the fixed compact limit");
        assertTrue(hasLabelContaining(content, "Weitere Treffer vorhanden"),
                "the bounded result list explains that a narrower search can reveal more");
    }

    private static void assertReusableSelectedSceneInspector() {
        SessionPlannerTimelineMainView view = new SessionPlannerTimelineMainView();
        SessionPlannerViewModel viewModel = new SessionPlannerViewModel();
        view.bind(viewModel);
        List<String> events = new java.util.ArrayList<>();
        view.onSaveScene(draft -> events.add("save:" + draft.sceneToken() + ":" + draft.title()));
        view.onSelectScene(token -> events.add("select:" + token));
        Stage stage = new Stage();
        stage.setScene(new Scene(view, 820.0, 500.0));
        stage.show();

        List<SessionPlannerSceneTimelineProjection.SceneHeader> headers = java.util.stream.LongStream
                .rangeClosed(1L, 64L).mapToObj(token -> new SessionPlannerSceneTimelineProjection.SceneHeader(
                        token, "Scene " + token, token, true, "Plan " + token, "", 1, 100,
                        "MEDIUM", "", new BigDecimal("10"), 100, false,
                        "Keine Location", token > 1L, token < 64L)).toList();
        SessionPlannerSceneTimelineProjection timeline = new SessionPlannerSceneTimelineProjection(
                headers, java.util.stream.IntStream.range(0, 63).mapToObj(index ->
                        new SessionPlannerSceneTimelineProjection.RestGap(
                                index, index + 1L, index + 2L, SessionPlannerRestKind.NONE)).toList());
        SessionPlannerSessionSnapshot session = new SessionPlannerSessionSnapshot(
                new SessionPlannerSessionSnapshot.SessionState(41L, "Master detail", BigDecimal.ONE, "1", 0L, false),
                SessionPlannerSessionSnapshot.XpBudgetState.empty(),
                SessionPlannerSessionSnapshot.RestAdviceState.empty(),
                "");
        viewModel.applyWorkspace(new features.sessionplanner.api.SessionPlannerWorkspaceSnapshot(
                1L, 41L, 1L, SessionPlannerCatalogSnapshot.empty(), session,
                features.sessionplanner.api.SessionPlannerParticipantsProjection.empty(), timeline,
                SessionPlannerSelectedSceneSnapshot.empty(), SessionPreparationSnapshot.idle(), List.of()));
        layout(view);

        assertEquals(Integer.valueOf(0), Integer.valueOf((int) descendants(view).stream()
                .filter(node -> node.getStyleClass().contains("session-planner-selected-scene-inspector")).count()),
                "64 collapsed headers with no published selection materialize no inspector");
        assertEquals(Integer.valueOf(0), Integer.valueOf((int) descendants(view).stream()
                .filter(javafx.scene.control.TextArea.class::isInstance).count()),
                "64 collapsed headers materialize no detail editor subtree");
        assertEquals(Integer.valueOf(0), Integer.valueOf((int) descendants(view).stream()
                .filter(TextField.class::isInstance).map(TextField.class::cast)
                .filter(field -> "Encounter suchen".equals(field.getPromptText())).count()),
                "64 collapsed headers materialize no saved-plan search subtree");
        assertEquals(Integer.valueOf(0), Integer.valueOf((int) descendants(view).stream()
                .filter(node -> node.getStyleClass().contains("session-planner-roster-line")
                        || node.getStyleClass().contains("session-planner-generated-reward")).count()),
                "64 collapsed headers materialize no roster or reward subtree");

        List<SessionPlannerSceneTimelineProjection.SceneHeader> selectedHeaders = new java.util.ArrayList<>(headers);
        var firstHeader = selectedHeaders.getFirst();
        selectedHeaders.set(0, new SessionPlannerSceneTimelineProjection.SceneHeader(
                firstHeader.sceneToken(), firstHeader.displayTitle(), firstHeader.linkedEncounterPlanId(),
                firstHeader.linkedEncounterPlan(), firstHeader.linkedEncounterName(),
                firstHeader.linkedEncounterGeneratedLabel(), firstHeader.linkedEncounterCreatureCount(),
                firstHeader.linkedEncounterAdjustedXp(), firstHeader.linkedEncounterDifficultyLabel(),
                firstHeader.linkedEncounterStatus(), firstHeader.budgetPercentage(), firstHeader.targetXp(),
                true, firstHeader.locationLabel(), false, true));
        SessionPlannerSceneTimelineProjection selectedTimeline = new SessionPlannerSceneTimelineProjection(
                selectedHeaders, timeline.restGaps());
        session = new SessionPlannerSessionSnapshot(
                new SessionPlannerSessionSnapshot.SessionState(41L, "Master detail", BigDecimal.ONE, "1", 1L, true),
                session.xpBudget(), session.restAdvice(), "");
        SessionPlannerSelectedSceneSnapshot first = selectedFixture(1L, "First title", 2);
        viewModel.applyWorkspace(new features.sessionplanner.api.SessionPlannerWorkspaceSnapshot(
                2L, 41L, 1L, SessionPlannerCatalogSnapshot.empty(), session,
                features.sessionplanner.api.SessionPlannerParticipantsProjection.empty(), selectedTimeline,
                first, SessionPreparationSnapshot.idle(), List.of()));
        layout(view);

        List<Node> inspectors = descendants(view).stream()
                .filter(node -> node.getStyleClass().contains("session-planner-selected-scene-inspector"))
                .toList();
        assertEquals(Integer.valueOf(1), Integer.valueOf(inspectors.size()),
                "64 headers materialize exactly one selected-scene inspector");
        Node inspector = inspectors.getFirst();
        assertEquals(Integer.valueOf(64), Integer.valueOf((int) descendants(view).stream()
                .filter(node -> node.getStyleClass().contains("session-planner-scene-toggle")).count()),
                "64 scenes allocate header controls only");
        assertEquals(Integer.valueOf(1), Integer.valueOf((int) descendants(view).stream()
                .filter(javafx.scene.control.TextArea.class::isInstance).count()),
                "collapsed headers allocate no notes editors");
        assertEquals(Integer.valueOf(1), Integer.valueOf((int) descendants(view).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast).filter(field -> "Encounter suchen".equals(field.getPromptText())).count()),
                "collapsed headers allocate no search fields");

        TextField title = textField(view, "Szenentitel");
        title.setText("Dirty title");
        title.requestFocus();
        title.selectRange(2, 7);
        SessionPlannerSelectedSceneSnapshot refreshed = selectedFixture(1L, "Server title", 3);
        viewModel.applyWorkspace(new features.sessionplanner.api.SessionPlannerWorkspaceSnapshot(
                3L, 41L, 1L, SessionPlannerCatalogSnapshot.empty(), session,
                features.sessionplanner.api.SessionPlannerParticipantsProjection.empty(), selectedTimeline,
                refreshed, SessionPreparationSnapshot.idle(), List.of()));
        assertEquals("Dirty title", title.getText(),
                "same selected-scene publication preserves dirty editor text");
        assertTrue(title.isFocused() && title.getAnchor() == 2 && title.getCaretPosition() == 7,
                "same selected-scene publication preserves focus and selection");

        Button secondHeader = descendants(view).stream().filter(Button.class::isInstance).map(Button.class::cast)
                .filter(button -> button.getStyleClass().contains("session-planner-scene-toggle"))
                .filter(button -> button.getText().contains("Scene 2")).findFirst().orElseThrow();
        secondHeader.fire();
        assertEquals(List.of("save:1:Dirty title", "select:2"), events,
                "same-session header click commits dirty inspector before dispatching selection");
        assertTrue(descendants(view).contains(inspector),
                "selection intent does not relocate the inspector before coherent publication");

        List<SessionPlannerSceneTimelineProjection.SceneHeader> reordered = new java.util.ArrayList<>(selectedHeaders);
        var second = reordered.remove(1);
        reordered.addFirst(new SessionPlannerSceneTimelineProjection.SceneHeader(
                second.sceneToken(), second.displayTitle(), second.linkedEncounterPlanId(),
                second.linkedEncounterPlan(), second.linkedEncounterName(), second.linkedEncounterGeneratedLabel(),
                second.linkedEncounterCreatureCount(), second.linkedEncounterAdjustedXp(),
                second.linkedEncounterDifficultyLabel(), second.linkedEncounterStatus(), second.budgetPercentage(),
                second.targetXp(), true, second.locationLabel(), false, true));
        reordered.set(1, new SessionPlannerSceneTimelineProjection.SceneHeader(
                1L, "Scene 1", 1L, true, "Plan 1", "", 1, 100, "MEDIUM", "",
                new BigDecimal("10"), 100, false, "Keine Location", true, true));
        SessionPlannerSessionSnapshot secondSessionState = new SessionPlannerSessionSnapshot(
                new SessionPlannerSessionSnapshot.SessionState(41L, "Master detail", BigDecimal.ONE, "1", 2L, true),
                session.xpBudget(), session.restAdvice(), "");
        viewModel.applyWorkspace(new features.sessionplanner.api.SessionPlannerWorkspaceSnapshot(
                4L, 41L, 2L, SessionPlannerCatalogSnapshot.empty(), secondSessionState,
                features.sessionplanner.api.SessionPlannerParticipantsProjection.empty(),
                new SessionPlannerSceneTimelineProjection(reordered, timeline.restGaps()),
                selectedFixture(2L, "Second title", 1), SessionPreparationSnapshot.idle(), List.of()));
        assertTrue(descendants(view).contains(inspector),
                "selection and reorder keep the physical inspector identity");
        assertTrue(!inspector.getAccessibleText().isBlank()
                        && !textField(view, "Encounter suchen").getAccessibleText().isBlank(),
                "selected inspector and search expose explicit accessibility text");
    }

    private static SessionPlannerSelectedSceneSnapshot selectedFixture(
            long token,
            String title,
            int rosterCount
    ) {
        return new SessionPlannerSelectedSceneSnapshot(
                true, token, title, "notes", 0L,
                List.of(new SessionPlannerSelectedSceneSnapshot.LocationChoice(0L, "Keine Location")),
                new BigDecimal("10"), 100, token, true, "Plan " + token, "", rosterCount,
                100, 100, 1.0, "MEDIUM", "",
                java.util.stream.IntStream.rangeClosed(1, rosterCount).mapToObj(index ->
                        new SessionPlannerSelectedSceneSnapshot.EncounterRosterLine(index, 1, "Creature " + index))
                        .toList(),
                List.of(), List.of(), features.sessionplanner.api.SessionEncounterPlanSearchSnapshot.idle());
    }

    private static SessionPlannerSceneTimelineProjection.SceneHeader searchScene(
            long sceneToken,
            long linkedPlanId,
            boolean selected
    ) {
        return new SessionPlannerSceneTimelineProjection.SceneHeader(
                sceneToken, "Scene " + sceneToken, linkedPlanId, linkedPlanId > 0L,
                linkedPlanId > 0L ? "Current encounter" : "", "", linkedPlanId > 0L ? 1 : 0,
                linkedPlanId > 0L ? 100 : 0, linkedPlanId > 0L ? "MEDIUM" : "", "",
                new BigDecimal("50"), 100, selected, "Keine Location", sceneToken > 1L, sceneToken < 2L);
    }

    private static SessionPlannerSelectedSceneSnapshot searchSelected(
            long sceneToken,
            long linkedPlanId,
            features.sessionplanner.api.SessionEncounterPlanSearchSnapshot search
    ) {
        return new SessionPlannerSelectedSceneSnapshot(
                true, sceneToken, "Scene " + sceneToken, "", 0L,
                List.of(new SessionPlannerSelectedSceneSnapshot.LocationChoice(0L, "Keine Location")),
                new BigDecimal("50"), 100, linkedPlanId, linkedPlanId > 0L,
                linkedPlanId > 0L ? "Current encounter" : "", "", linkedPlanId > 0L ? 1 : 0,
                linkedPlanId > 0L ? 100 : 0, linkedPlanId > 0L ? 100 : 0, 1.0,
                linkedPlanId > 0L ? "MEDIUM" : "", "", List.of(), List.of(), List.of(), search);
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

    private static TextField visibleTextField(Parent parent, String promptText) {
        return descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> promptText.equals(field.getPromptText()))
                .filter(SessionPlannerCatalogTest::isEffectivelyVisible)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Visible text field not found: " + promptText));
    }

    private static TextField manualNoteField(Parent parent) {
        return descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> field.getAccessibleText() != null
                        && field.getAccessibleText().startsWith("Text der manuellen Beutenotiz "))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Manual note editor not found."));
    }

    private static ComboBox<?> locationCombo(Parent parent) {
        return descendants(parent).stream()
                .filter(ComboBox.class::isInstance)
                .map(ComboBox.class::cast)
                .filter(comboBox -> "Location".equals(comboBox.getPromptText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Location ComboBox not found."));
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
        SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("session-planner-" + DATABASE_SEQUENCE.incrementAndGet() + ".sqlite"),
                NoopDiagnostics.INSTANCE);
        var stores = TestFeatureStores.stores(
                database,
                SqlitePartyRosterRepository.storeDefinition(),
                SqliteWorldPlannerRepository.storeDefinition(),
                SqliteSessionPlanRepository.storeDefinition());
        SqliteSessionPlanRepository sessionRepository = new SqliteSessionPlanRepository(
                stores.get("session-planner"));
        PartyServiceAssembly.Component party =
                PartyServiceAssembly.create(new SqlitePartyRosterRepository(
                                stores.get("party")));
        WorldPlannerServiceAssembly world = new WorldPlannerServiceAssembly(
                new SqliteWorldPlannerRepository(
                                stores.get("world-planner")), new PositiveReferencePort());
        WorldPlannerApplicationService worldApplication = world.createApplicationService();
        SavedEncounterPlanListModel savedPlans = new SavedEncounterPlanListModel(
                SessionPlannerCatalogTest::savedEncounterPlans,
                listener -> {
                    listener.accept(savedEncounterPlans());
                    return () -> {
                    };
                },
                listener -> {
                    listener.accept(savedEncounterPlans());
                    return () -> {
                    };
                });
        SessionPlannerServiceAssembly planner = new SessionPlannerServiceAssembly(
                sessionRepository, sessionRepository, sessionRepository, party.application(),
                generatedEncounterApi(), savedPlans, world.snapshotModel(), generation,
                platform.execution.DirectExecutionLane.INSTANCE,
                platform.execution.DirectExecutionLane.INSTANCE,
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

    private static EncounterApi generatedEncounterApi() {
        EncounterApplicationService delegate = EncounterApplicationServiceFakes.noOp();
        return new EncounterApi() {
            @Override
            public java.util.concurrent.CompletionStage<features.encounter.api.PreparedGeneratedEncounterBatchResult>
                    prepareGeneratedBatch(features.encounter.api.PrepareGeneratedEncounterBatchCommand command) {
                var rosters = command.intents().stream().map(intent -> {
                    int quantity = intent.blocks().stream()
                            .mapToInt(features.encounter.api.GeneratedEncounterBlock::quantity).sum();
                    var creature = new features.encounter.api.PreparedEncounterCreature(
                            101L, quantity, "Generated creature");
                    var summary = new features.encounter.api.GeneratedEncounterPlanSummary(
                            0L, intent.displayLabel(), List.of(creature), quantity, 100L, 100L,
                            features.encounter.api.GeneratedEncounterDifficulty.MEDIUM,
                            quantity + "x Generated creature");
                    return new features.encounter.api.PreparedEncounterRoster(
                            intent.encounterNumber(), intent.displayLabel(), "intent", "roster",
                            List.of(creature), summary);
                }).toList();
                return CompletableFuture.completedFuture(
                        features.encounter.api.PreparedGeneratedEncounterBatchResult.success(
                                new features.encounter.api.PreparedEncounterBatch(
                                        command.source(), "batch", rosters)));
            }

            @Override
            public java.util.concurrent.CompletionStage<features.encounter.api.CommittedGeneratedEncounterBatchResult>
                    commitGeneratedBatch(features.encounter.api.CommitGeneratedEncounterBatchCommand command) {
                var mappings = command.batch().rosters().stream().map(roster -> {
                    long planId = 900L + roster.encounterNumber();
                    var source = roster.summary();
                    var summary = new features.encounter.api.GeneratedEncounterPlanSummary(
                            planId, source.label(), source.roster(), source.creatureCount(), source.baseXp(),
                            source.adjustedXp(), source.difficulty(), source.displaySummary());
                    return new features.encounter.api.CommittedGeneratedEncounterMapping(
                            roster.encounterNumber(), planId, summary);
                }).toList();
                return CompletableFuture.completedFuture(
                        features.encounter.api.CommittedGeneratedEncounterBatchResult.success(mappings));
            }

            @Override
            public java.util.concurrent.CompletionStage<features.encounter.api.GeneratedEncounterPlanSummaryBatchResult>
                    loadGeneratedPlanSummaries(
                            features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery query) {
                var entries = query.planIds().stream().map(planId -> {
                    boolean saved = planId == SAVED_ENCOUNTER_PLAN_ID;
                    var creature = new features.encounter.api.PreparedEncounterCreature(
                            saved ? 77L : 101L, saved ? 2 : 1,
                            saved ? "Ash guard" : "Generated creature");
                    var summary = new features.encounter.api.GeneratedEncounterPlanSummary(
                            planId,
                            saved ? "Ash Gate Ambush" : "Generated 1",
                            List.of(creature),
                            saved ? 2 : 1,
                            100L,
                            saved ? 150L : 100L,
                            features.encounter.api.GeneratedEncounterDifficulty.MEDIUM,
                            saved ? "2x Ash guard" : "1x Generated creature");
                    return new features.encounter.api.GeneratedEncounterPlanSummaryEntry(
                            planId,
                            features.encounter.api.GeneratedEncounterPlanSummaryEntry.Status.FOUND,
                            java.util.Optional.of(summary));
                }).toList();
                return CompletableFuture.completedFuture(
                        features.encounter.api.GeneratedEncounterPlanSummaryBatchResult.success(entries));
            }

            @Override
            public java.util.concurrent.CompletionStage<features.encounter.api.SearchSavedEncounterPlansResult>
                    searchSavedPlans(features.encounter.api.SearchSavedEncounterPlansQuery query) {
                if (!query.normalizedQuery().contains("medium")
                        && !query.normalizedQuery().contains("ash")
                        && !query.normalizedQuery().contains("gate")) {
                    return CompletableFuture.completedFuture(
                            features.encounter.api.SearchSavedEncounterPlansResult.success(List.of(), false));
                }
                return CompletableFuture.completedFuture(
                        features.encounter.api.SearchSavedEncounterPlansResult.success(
                                List.of(new features.encounter.api.SavedEncounterPlanSearchHit(
                                        SAVED_ENCOUNTER_PLAN_ID,
                                        "Ash Gate Ambush",
                                        "2 Kreaturen · Medium")),
                                false));
            }

            @Override
            public void applyState(features.encounter.api.ApplyEncounterStateCommand command) {
                delegate.applyState(command);
            }

            @Override
            public void updatePoolFilters(features.encounter.api.UpdateEncounterPoolFiltersCommand command) {
                delegate.updatePoolFilters(command);
            }

            @Override
            public void updateTuning(features.encounter.api.UpdateEncounterTuningCommand command) {
                delegate.updateTuning(command);
            }

            @Override
            public void updateBuilderInputs(features.encounter.api.UpdateEncounterBuilderInputsCommand command) {
                delegate.updateBuilderInputs(command);
            }

            @Override
            public void refreshPlanBudget(features.encounter.api.RefreshEncounterPlanBudgetCommand command) {
                delegate.refreshPlanBudget(command);
            }
        };
    }

    private static SessionGenerationApi generationService() {
        GenerationResult result = new GenerationResult(
                new GenerationRunId("ui-generation"),
                "saltmarcher-v1",
                "catalog-2026-07-16",
                "10e7b8c2f3d43c0868e2ce0c3bf8471b72ed4d5327fc633452e0245d32f416f6",
                179_974L,
                List.of(new GenerationResult.PartyLevel(4, 1)),
                new GenerationResult.SessionSummary(
                        1, BigDecimal.ONE, 1, 1_000L, 100L, BigDecimal.valueOf(4L),
                        100L, 20L, 1, 0, 0, 1),
                List.of(new GenerationResult.EncounterTarget(1, 100L)),
                List.of(new GenerationResult.Encounter(
                        1, 100L, 100L, GenerationResult.Difficulty.MEDIUM,
                        "candidate", "Generated creature", 1, BigDecimal.ONE,
                        1, BigDecimal.ZERO,
                        List.of(new GenerationResult.EncounterBlock(
                                "block-1",
                                GenerationResult.EncounterRole.STANDARD, 1, "1/2", 100L, 1)))),
                List.of(new GenerationResult.Treasure(
                        1, GenerationResult.StockClass.NORMAL, GenerationResult.RewardChannel.ENCOUNTER,
                        1, "Vault", "none", 100L, 1, 0)),
                List.of(new GenerationResult.LootItem(
                        1, 1, GenerationResult.LootRole.USEFUL, "cache", "Generated cache",
                        2L, 125L, 250L, new BigDecimal("3.5"), "chest, sack", "RARE", true)),
                List.of(new GenerationResult.Packing(1, 1, "chest", 2, "iron-chest", true)),
                new GenerationResult.RewardSummary(100L, 0L, 0),
                "Generated output",
                List.of(new GenerationResult.Audit(
                        "final-output", GenerationResult.AuditStatus.PASS, "ok")));
        return new SessionGenerationApi() {
            @Override
            public java.util.concurrent.CompletionStage<features.sessiongeneration.api.GenerationDraftResponse> draft(
                    GenerationRequest request
            ) {
                return CompletableFuture.completedFuture(GenerationDraftResponse.success(
                        new GenerationDraft(result, "v1:" + "2".repeat(64))));
            }

            @Override
            public java.util.concurrent.CompletionStage<features.sessiongeneration.api.GenerationRunResponse> commit(
                    features.sessiongeneration.api.CommitGenerationRunCommand command
            ) {
                return CompletableFuture.completedFuture(GenerationRunResponse.committed(
                        command.draft().result(), GenerationRunResponse.CommitOutcome.INSERTED));
            }

            @Override
            public java.util.concurrent.CompletionStage<features.sessiongeneration.api.GenerationRunResponse> load(
                    GenerationRunId runId
            ) {
                return CompletableFuture.completedFuture(GenerationRunResponse.success(result));
            }

            @Override
            public java.util.concurrent.CompletionStage<features.sessiongeneration.api.GenerationRewardBatchResponse>
                    loadRewards(features.sessiongeneration.api.GenerationRewardBatchQuery query) {
                return CompletableFuture.completedFuture(
                        features.sessiongeneration.api.GenerationRewardBatchResponse.success(
                                query.references().stream().map(reference ->
                                        new features.sessiongeneration.api.GenerationRewardBatchResponse.ResolvedReward(
                                                reference,
                                                result.treasures().getFirst(),
                                                result.lootItems(),
                                                result.packing())).toList(),
                                List.of()));
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

    private static Label labelByStyle(Parent parent, String styleClass) {
        return descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .filter(label -> label.getStyleClass().contains(styleClass))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Label not found with style: " + styleClass));
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
