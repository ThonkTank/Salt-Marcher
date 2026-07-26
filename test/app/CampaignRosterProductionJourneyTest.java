package app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.campaign.api.CampaignId;
import features.party.adapter.javafx.party.PartyEditorTopBarView;
import features.party.adapter.javafx.party.PartyTopBarView;
import features.party.api.MembershipState;
import features.party.api.MutationStatus;
import features.party.api.PartyMemberDetails;
import features.party.api.PartySnapshotResult;
import features.party.api.ReadStatus;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import javafx.application.Platform;
import javafx.event.Event;
import javafx.event.EventTarget;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyCodeCombination;
import javafx.scene.input.KeyCombination;
import javafx.stage.Stage;
import javafx.stage.Window;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.SerialExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.JavaFxUiDispatcher;
import shell.host.AppShell;

/** Production-composed M2a proof for Campaign-owned character Rosters. */
@Tag("ui")
public final class CampaignRosterProductionJourneyTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(60);
    private static final String PARTY_TOOLTIP = "Party-Panel öffnen (Alt+P)";

    @TempDir
    Path temporaryDirectory;

    @AfterAll
    static void shutdownFx() throws Exception {
        runOnFx(() -> {
            for (Window window : List.copyOf(Window.getWindows())) {
                window.hide();
            }
            testsupport.JavaFxRuntime.shutdown();
        });
    }

    @Test
    void productionShellKeepsNullableRostersStableAndCampaignOwnedAcrossRestart()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("campaign-roster-production");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");
        CampaignId alphaId;
        CampaignId betaId;
        RosterTruth alphaTruth;
        RosterTruth betaTruth;

        AppBootstrap firstBootstrap = bootstrapAt(installationPath);
        SaltMarcherApp firstApplication = new SaltMarcherApp(firstBootstrap, campaignRoot);
        Stage firstWindow = startApplication(firstApplication);
        awaitCampaignDeskReady(firstWindow);
        submitCampaignName(firstWindow, "Alpha");
        awaitActiveCampaign(firstBootstrap, "Alpha");
        alphaId = activeCampaignId(firstApplication);

        createNameOnlyCharacter(firstWindow, firstBootstrap, "Aster", 1);
        createNameOnlyCharacter(firstWindow, firstBootstrap, "Echo", 2);
        createNameOnlyCharacter(firstWindow, firstBootstrap, "Echo", 3);
        List<PartyMemberDetails> alphaCreated = reserveMembers(firstBootstrap);
        PartyMemberDetails firstEcho = alphaCreated.stream()
                .filter(member -> "Echo".equals(member.name()))
                .findFirst()
                .orElseThrow();
        PartyMemberDetails secondEcho = alphaCreated.stream()
                .filter(member -> "Echo".equals(member.name()))
                .skip(1)
                .findFirst()
                .orElseThrow();
        assertNotEquals(firstEcho.id(), secondEcho.id(),
                "duplicate names retain distinct stable Roster identities");
        assertVisiblePartyRoster(firstWindow, alphaCreated);
        assertRosterOnly(firstBootstrap, alphaCreated.size(),
                "name-only creation is not Party, travel-token, or Scene attachment");

        editCharacter(firstWindow, firstBootstrap, firstEcho.id(), "Echo",
                "Mira", "7", "15", "17");
        PartyMemberDetails populated = member(firstBootstrap, firstEcho.id());
        assertEquals("Mira", populated.playerName());
        assertEquals(7, populated.level());
        assertEquals(15, populated.passivePerception());
        assertEquals(17, populated.armorClass());
        assertRosterOnly(firstBootstrap, reserveMembers(firstBootstrap).size(),
                "setting optional facts does not imply Party composition");

        editCharacter(firstWindow, firstBootstrap, firstEcho.id(), "Echo",
                "", "", "", "");
        PartyMemberDetails cleared = member(firstBootstrap, firstEcho.id());
        assertNull(cleared.playerName(), "player remains truly absent after clearing");
        assertNull(cleared.level(), "level remains truly absent after clearing");
        assertNull(cleared.passivePerception(), "passive perception remains truly absent after clearing");
        assertNull(cleared.armorClass(), "armor class remains truly absent after clearing");
        assertEquals(firstEcho.id(), cleared.id(),
                "editing and clearing targets stable Roster identity rather than duplicate name");
        assertNull(member(firstBootstrap, secondEcho.id()).playerName(),
                "editing one duplicate cannot alter the other duplicate");
        assertVisibleEditContext(firstWindow, firstEcho.id(), "Echo", "", "", "", "");
        assertVisibleEditContext(firstWindow, secondEcho.id(), "Echo", "", "", "", "");

        editCharacter(firstWindow, firstBootstrap, secondEcho.id(), "Echo",
                "", "", "", "18");
        PartyMemberDetails savedSecondEcho = member(firstBootstrap, secondEcho.id());
        assertNull(member(firstBootstrap, firstEcho.id()).armorClass(),
                "fact-cleared namesake A remains without AC when namesake B is edited");
        assertEquals(18, savedSecondEcho.armorClass(),
                "only namesake B receives the visible saved AC");
        assertVisibleEditContext(firstWindow, secondEcho.id(), "Echo", "", "", "", "18");
        alphaTruth = truth(reserveMembers(firstBootstrap));
        assertVisibleRoster(firstWindow, alphaTruth.members());
        assertRosterOnly(firstBootstrap, alphaTruth.members().size(),
                "Alpha causal control after optional-fact round trip");
        assertRosterOnlyRejectsExplicitActivePartyEnrollment(
                firstWindow, firstBootstrap, firstEcho.id(), alphaTruth);

        assertFailedProductionCreateKeepsRosterTruth(
                firstWindow, firstBootstrap, campaignRoot, alphaId, alphaTruth);
        closePartyPanel();

        openCampaignDeskWithKeyboard(firstWindow, firstApplication.campaignHostForTesting());
        submitCampaignName(firstWindow, "Beta");
        awaitActiveCampaign(firstBootstrap, "Beta");
        betaId = activeCampaignId(firstApplication);
        assertNotEquals(alphaId, betaId);
        assertEquals(List.of(), reserveMembers(firstBootstrap),
                "new Campaign starts with a distinct empty Roster");
        createNameOnlyCharacter(firstWindow, firstBootstrap, "Beta Scout", 1);
        betaTruth = truth(reserveMembers(firstBootstrap));
        assertVisibleRoster(firstWindow, betaTruth.members());
        assertNoVisibleRoster(firstWindow, alphaTruth.members());
        assertRosterOnly(firstBootstrap, betaTruth.members().size(),
                "Beta Roster remains inactive and unattached");
        closePartyPanel();

        for (int iteration = 0; iteration < 3; iteration++) {
            switchCampaign(firstWindow, firstApplication, firstBootstrap, alphaId, "Alpha");
            assertVisibleRoster(firstWindow, alphaTruth.members());
            assertNoVisibleRoster(firstWindow, betaTruth.members());
            assertExactRoster(firstBootstrap, alphaTruth,
                    "Alpha switch " + iteration);
            assertRosterOnly(firstBootstrap, alphaTruth.members().size(),
                    "Alpha switch " + iteration + " nonattachment");
            closePartyPanel();

            switchCampaign(firstWindow, firstApplication, firstBootstrap, betaId, "Beta");
            assertVisibleRoster(firstWindow, betaTruth.members());
            assertNoVisibleRoster(firstWindow, alphaTruth.members());
            assertExactRoster(firstBootstrap, betaTruth,
                    "Beta switch " + iteration);
            assertRosterOnly(firstBootstrap, betaTruth.members().size(),
                    "Beta switch " + iteration + " nonattachment");
            closePartyPanel();
        }
        stopApplication(firstApplication, firstBootstrap, firstWindow);

        AppBootstrap restartedBootstrap = bootstrapAt(installationPath);
        SaltMarcherApp restartedApplication = new SaltMarcherApp(restartedBootstrap, campaignRoot);
        Stage restartedWindow = startApplication(restartedApplication);
        awaitActiveCampaign(restartedBootstrap, "Beta");
        assertEquals(betaId, activeCampaignId(restartedApplication),
                "restart resumes the exact durable active Campaign");
        openPartyPanel(restartedWindow);
        assertVisibleRoster(restartedWindow, betaTruth.members());
        assertNoVisibleRoster(restartedWindow, alphaTruth.members());
        assertExactRoster(restartedBootstrap, betaTruth, "Beta after exact application restart");
        assertRosterOnly(restartedBootstrap, betaTruth.members().size(),
                "Beta restart nonattachment");
        closePartyPanel();

        switchCampaign(restartedWindow, restartedApplication, restartedBootstrap, alphaId, "Alpha");
        assertVisibleRoster(restartedWindow, alphaTruth.members());
        assertNoVisibleRoster(restartedWindow, betaTruth.members());
        assertExactRoster(restartedBootstrap, alphaTruth, "Alpha after exact application restart");
        assertRosterOnly(restartedBootstrap, alphaTruth.members().size(),
                "Alpha restart nonattachment");
        closePartyPanel();

        switchCampaign(restartedWindow, restartedApplication, restartedBootstrap, betaId, "Beta");
        assertVisibleRoster(restartedWindow, betaTruth.members());
        assertExactRoster(restartedBootstrap, betaTruth, "Beta final durable reopen");
        closePartyPanel();
        stopApplication(restartedApplication, restartedBootstrap, restartedWindow);
    }

    private static AppBootstrap bootstrapAt(Path installationPath) {
        return new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                new JavaFxUiDispatcher(),
                new SqliteDatabase(installationPath, NoopDiagnostics.INSTANCE));
    }

    private static Stage startApplication(SaltMarcherApp application) throws Exception {
        AtomicReference<Stage> window = new AtomicReference<>();
        runOnFx(() -> {
            Stage stage = new Stage();
            application.start(stage);
            Platform.setImplicitExit(false);
            window.set(stage);
        });
        return window.get();
    }

    private static void stopApplication(
            SaltMarcherApp application,
            AppBootstrap bootstrap,
            Stage window
    ) throws Exception {
        runOnFx(() -> {
            application.stop();
            window.close();
        });
        await(bootstrap.termination());
    }

    private static void awaitCampaignDeskReady(Stage stage) throws Exception {
        awaitFxCondition(() -> campaignNameField(stage) != null
                && !campaignNameField(stage).isDisabled());
    }

    private static void submitCampaignName(Stage stage, String campaignName) throws Exception {
        runOnFx(() -> {
            TextField name = campaignNameField(stage);
            assertTrue(name != null && !name.isDisabled());
            name.setText(campaignName);
            fireKey(name, KeyCode.ENTER, false);
        });
    }

    private static void awaitActiveCampaign(AppBootstrap bootstrap, String campaignName)
            throws Exception {
        awaitFxCondition(() -> {
            try {
                return bootstrap.campaignRuntimeForTesting().state() == CampaignRuntime.State.ACTIVE;
            } catch (IllegalStateException notPublishedYet) {
                return false;
            }
        });
        awaitFxCondition(() -> {
            try {
                return bootstrap.campaignRuntimeForTesting().components().party()
                                .snapshot().current().status() == ReadStatus.SUCCESS;
            } catch (IllegalStateException notPublishedYet) {
                return false;
            }
        });
        awaitFxCondition(() -> Window.getWindows().stream()
                .filter(Stage.class::isInstance)
                .map(Stage.class::cast)
                .anyMatch(stage -> ("SaltMarcher – " + campaignName).equals(stage.getTitle())
                        && stage.getScene() != null
                        && stage.getScene().getRoot() instanceof AppShell));
        awaitFxCondition(() -> {
            try {
                CampaignRuntime runtime = bootstrap.campaignRuntimeForTesting();
                return runtime.state() == CampaignRuntime.State.ACTIVE
                        && runtime.components().party().snapshot().current().status()
                                == ReadStatus.SUCCESS;
            } catch (IllegalStateException transitionStillInFlight) {
                return false;
            }
        });
    }

    private static CampaignId activeCampaignId(SaltMarcherApp application) {
        return java.util.Objects.requireNonNull(
                application.campaignHostForTesting().retainedCampaignIdForTesting(),
                "active Campaign identity");
    }

    private static void createNameOnlyCharacter(
            Stage stage,
            AppBootstrap bootstrap,
            String name,
            int expectedRosterSize
    ) throws Exception {
        Parent popup = openPartyPanel(stage);
        runOnFx(() -> button(popup, "+ Roster-Charakter").fire());
        awaitFxCondition(() -> textField(popup, "Charaktername") != null);
        runOnFx(() -> {
            textField(popup, "Charaktername").setText(name);
            button(popup, "Erstellen").fire();
        });
        awaitFxCondition(() -> reserveMembers(bootstrap).size() == expectedRosterSize);

        PartyMemberDetails created = reserveMembers(bootstrap).getLast();
        assertNull(created.playerName(), "name-only UI creation must not default player");
        assertNull(created.level(), "name-only UI creation must not default level");
        assertNull(created.passivePerception(), "name-only UI creation must not default PP");
        assertNull(created.armorClass(), "name-only UI creation must not default AC");
        assertRosterOnly(bootstrap, reserveMembers(bootstrap).size(),
                "name-only UI creation causal control");
    }

    private static void assertFailedProductionCreateKeepsRosterTruth(
            Stage stage,
            AppBootstrap bootstrap,
            Path campaignRoot,
            CampaignId campaignId,
            RosterTruth expected
    ) throws Exception {
        Path campaignPath = campaignRoot.resolve(campaignId.value().toString()).resolve("campaign.sqlite");
        CampaignRuntime runtime = bootstrap.campaignRuntimeForTesting();
        PartySnapshotResult publishedBefore = runtime.components().party().snapshot().current();
        long publicationRevisionBefore = runtime.components().party()
                .activePartyFacts().current().facts().revision();
        RosterTruth durableBefore = durableRosterTruth(campaignPath);
        assertEquals(expected, durableBefore, "production SQLite starts from the visible Roster truth");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + campaignPath);
             var statement = connection.createStatement()) {
            statement.execute("CREATE TRIGGER fail_roster_create BEFORE INSERT ON player_characters "
                    + "WHEN NEW.name='Blocked by proof' "
                    + "BEGIN SELECT RAISE(ABORT, 'forced production Roster failure'); END");
        }

        Parent popup = openPartyPanel(stage);
        runOnFx(() -> button(popup, "+ Roster-Charakter").fire());
        awaitFxCondition(() -> textField(popup, "Charaktername") != null);
        runOnFx(() -> {
            textField(popup, "Charaktername").setText("Blocked by proof");
            button(popup, "Erstellen").fire();
        });
        awaitFxCondition(() -> runtime.components().party().mutation().current().status()
                == MutationStatus.STORAGE_ERROR);
        awaitFxCondition(() -> visibleText(popup, "Party-Aktion konnte nicht gespeichert werden."));

        assertEquals(publishedBefore, runtime.components().party().snapshot().current(),
                "failed production create keeps the last coherent visible Roster publication");
        assertEquals(publicationRevisionBefore,
                runtime.components().party().activePartyFacts().current().facts().revision(),
                "failed production create cannot claim a publication revision");
        assertExactRoster(bootstrap, expected, "failed production create visible truth");
        runOnFx(() -> button(popup, "Abbrechen").fire());
        assertVisibleRoster(stage, expected.members());
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + campaignPath);
             var statement = connection.createStatement()) {
            assertEquals(0, scalarInt(statement,
                    "SELECT COUNT(*) FROM player_characters WHERE name='Blocked by proof'"));
            statement.execute("DROP TRIGGER fail_roster_create");
        }
        assertEquals(durableBefore, durableRosterTruth(campaignPath),
                "failed production create leaves every durable Roster fact unchanged");
    }

    private static void assertRosterOnlyRejectsExplicitActivePartyEnrollment(
            Stage stage,
            AppBootstrap bootstrap,
            long rosterId,
            RosterTruth expected
    ) throws Exception {
        Parent popup = openPartyPanel(stage);
        runOnFx(() -> buttonByAccessibleText(popup,
                "Roster-ID " + rosterId + ", zur aktiven Party hinzufuegen: Echo").fire());
        awaitFxCondition(() -> activePartyAndSceneProjectionMatches(bootstrap, List.of(rosterId)));
        assertEquals(List.of(rosterId), activePartyMemberIds(bootstrap),
                "explicit active-Party enrollment publishes the selected Roster ID");
        assertTrue(sceneProjectionMatches(bootstrap, List.of(rosterId)),
                "explicit active-Party enrollment projects the selected Roster ID into Scene");

        try {
            assertThrows(AssertionError.class,
                    () -> assertRosterOnly(bootstrap, expected.members().size(),
                            "explicit active-Party enrollment must fail the reserve-only oracle"));
        } finally {
            runOnFx(() -> buttonByAccessibleText(popup,
                    "Roster-ID " + rosterId + ", aus aktiver Party entfernen: Echo").fire());
            awaitFxCondition(() -> {
                PartySnapshotResult current = bootstrap.campaignRuntimeForTesting().components()
                        .party().snapshot().current();
                return current.snapshot().activeMembers().stream()
                                .noneMatch(member -> member.id() == rosterId)
                        && current.snapshot().reserveMembers().size() == expected.members().size()
                        && sceneProjectionMatches(bootstrap, List.of());
            });
        }
        assertExactRoster(bootstrap, expected,
                "explicit active-Party counterexample restores exact reserve-only Roster truth");
        assertRosterOnly(bootstrap, expected.members().size(),
                "explicit active-Party counterexample restores reserve-only truth");
    }

    private static int scalarInt(java.sql.Statement statement, String sql) throws Exception {
        try (var result = statement.executeQuery(sql)) {
            return result.next() ? result.getInt(1) : 0;
        }
    }

    private static RosterTruth durableRosterTruth(Path campaignPath) throws Exception {
        List<MemberTruth> members = new ArrayList<>();
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + campaignPath);
             var statement = connection.createStatement();
             var result = statement.executeQuery(
                     "SELECT id, name, player_name, level, passive_perception, ac, in_party "
                             + "FROM player_characters ORDER BY id")) {
            while (result.next()) {
                members.add(new MemberTruth(
                        result.getLong("id"),
                        result.getString("name"),
                        result.getString("player_name"),
                        nullableInteger(result, "level"),
                        nullableInteger(result, "passive_perception"),
                        nullableInteger(result, "ac"),
                        result.getInt("in_party") == 1
                                ? MembershipState.ACTIVE
                                : MembershipState.RESERVE));
            }
        }
        return new RosterTruth(members);
    }

    private static Integer nullableInteger(java.sql.ResultSet result, String column) throws Exception {
        int value = result.getInt(column);
        return result.wasNull() ? null : value;
    }

    private static void editCharacter(
            Stage stage,
            AppBootstrap bootstrap,
            long rosterId,
            String name,
            String player,
            String level,
            String passivePerception,
            String armorClass
    ) throws Exception {
        Parent popup = openPartyPanel(stage);
        runOnFx(() -> buttonByAccessibleText(
                popup,
                "Roster-ID " + rosterId + ", Charakter bearbeiten: " + name).fire());
        awaitFxCondition(() -> textField(popup, "Charaktername") != null
                && buttonOrNull(popup, "Speichern") != null);
        runOnFx(() -> {
            textField(popup, "Charaktername").setText(name);
            textField(popup, "Spielername").setText(player);
            textField(popup, "Level").setText(level);
            textField(popup, "Passive Perception").setText(passivePerception);
            textField(popup, "AC").setText(armorClass);
            button(popup, "Speichern").fire();
        });
        awaitFxCondition(() -> {
            PartyMemberDetails current = member(bootstrap, rosterId);
            return java.util.Objects.equals(expected(player), current.playerName())
                    && java.util.Objects.equals(expectedInteger(level), current.level())
                    && java.util.Objects.equals(
                            expectedInteger(passivePerception), current.passivePerception())
                    && java.util.Objects.equals(expectedInteger(armorClass), current.armorClass());
        });
        String feedback = "Roster-ID " + rosterId + " (" + name + ") wurde gespeichert.";
        awaitFxCondition(() -> visibleText(popup, feedback)
                && visibleText(popup, "AC: " + optionalFeedback(armorClass) + "."));
    }

    private static void assertVisibleEditContext(
            Stage stage,
            long rosterId,
            String name,
            String player,
            String level,
            String passivePerception,
            String armorClass
    ) throws Exception {
        Parent popup = openPartyPanel(stage);
        runOnFx(() -> buttonByAccessibleText(
                popup,
                "Roster-ID " + rosterId + ", Charakter bearbeiten: " + name).fire());
        awaitFxCondition(() -> textField(popup, "Charaktername") != null);
        runOnFx(() -> {
            Label editorTitle = editorTitleLabel(popup);
            assertTrue(editorTitle.isVisible(), "editor identity remains visibly rendered");
            assertEquals("Roster-Charakter bearbeiten · Roster-ID " + rosterId, editorTitle.getText(),
                    "editor identifies the exact namesake by its stable Roster ID");
            assertEquals(name, textField(popup, "Charaktername").getText(),
                    "editor reloads the correct namesake name");
            assertEquals(player, textField(popup, "Spielername").getText(),
                    "editor shows whether the saved player fact is absent");
            assertEquals(level, textField(popup, "Level").getText(),
                    "editor shows whether the saved level fact is absent");
            assertEquals(passivePerception, textField(popup, "Passive Perception").getText(),
                    "editor shows whether the saved passive-perception fact is absent");
            assertEquals(armorClass, textField(popup, "AC").getText(),
                    "editor reloads the saved AC for the exact namesake");
            button(popup, "Abbrechen").fire();
        });
        awaitFxCondition(() -> !editorView(popup).isVisible());
    }

    private static PartyEditorTopBarView editorView(Parent parent) {
        return descendants(parent).stream()
                .filter(PartyEditorTopBarView.class::isInstance)
                .map(PartyEditorTopBarView.class::cast)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Rendered editor not found"));
    }

    private static Label editorTitleLabel(Parent parent) {
        return editorView(parent).getChildrenUnmodifiable().stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Rendered editor title not found"));
    }

    private static String expected(String value) {
        return value.isBlank() ? null : value;
    }

    private static Integer expectedInteger(String value) {
        return value.isBlank() ? null : Integer.valueOf(value);
    }

    private static String optionalFeedback(String value) {
        return value.isBlank() ? "—" : value;
    }

    private static void switchCampaign(
            Stage stage,
            SaltMarcherApp application,
            AppBootstrap bootstrap,
            CampaignId targetId,
            String targetName
    ) throws Exception {
        openCampaignDeskWithKeyboard(stage, application.campaignHostForTesting());
        awaitFxCondition(() -> campaignRow(stage, targetName) != null
                && !campaignRow(stage, targetName).isDisabled());
        runOnFx(() -> campaignRow(stage, targetName).fire());
        awaitFxCondition(() -> {
            try {
                return targetId.equals(activeCampaignId(application))
                        && bootstrap.campaignRuntimeForTesting().state()
                                == CampaignRuntime.State.ACTIVE
                        && ("SaltMarcher – " + targetName).equals(stage.getTitle())
                        && stage.getScene().getRoot() instanceof AppShell;
            } catch (IllegalStateException transitionStillInFlight) {
                return false;
            }
        });
        openPartyPanel(stage);
    }

    private static void openCampaignDeskWithKeyboard(
            Stage stage,
            CampaignDeskHost campaignHost
    ) throws Exception {
        runOnFx(() -> {
            assertTrue(stage.getScene().getRoot() instanceof AppShell,
                    "Alt+K starts from the active Campaign shell");
            KeyCodeCombination shortcut = new KeyCodeCombination(
                    KeyCode.K, KeyCombination.ALT_DOWN);
            assertTrue(stage.getScene().getAccelerators().containsKey(shortcut),
                    "active Campaign shell exposes the Campaign selector accelerator");
            stage.requestFocus();
        });
        awaitFxCondition(stage::isFocused);
        runOnFx(() -> fireKey(stage.getScene().getRoot(), KeyCode.K, true));
        awaitFxCondition(campaignHost::deskVisibleForTesting);
        awaitCampaignDeskReady(stage);
    }

    private static Parent openPartyPanel(Stage stage) throws Exception {
        AtomicReference<Parent> popup = new AtomicReference<>();
        runOnFx(() -> {
            Parent existing = partyPopupRootOrNull();
            if (existing == null) {
                Button trigger = partyTrigger(stage);
                assertTrue(trigger != null && !trigger.isDisabled(),
                        "production shell exposes an enabled Party trigger");
                trigger.fire();
            }
        });
        awaitFxCondition(() -> partyPopupRootOrNull() != null);
        runOnFx(() -> {
            Parent root = partyPopupRootOrNull();
            root.applyCss();
            root.layout();
            popup.set(root);
        });
        return popup.get();
    }

    private static void closePartyPanel() throws Exception {
        Parent popup = popupRootSnapshot();
        if (popup == null) {
            return;
        }
        runOnFx(() -> buttonByAccessibleText(popup, "Party-Panel schließen").fire());
        awaitFxCondition(() -> partyPopupRootOrNull() == null);
    }

    private static Parent popupRootSnapshot() throws Exception {
        AtomicReference<Parent> popup = new AtomicReference<>();
        runOnFx(() -> popup.set(partyPopupRootOrNull()));
        return popup.get();
    }

    private static void assertVisibleRoster(Stage stage, List<MemberTruth> members)
            throws Exception {
        Parent popup = openPartyPanel(stage);
        runOnFx(() -> {
            assertVisibleText(popup, "Keine aktiven Party-Mitglieder");
            for (MemberTruth member : members) {
                assertVisibleText(popup, member.name());
                assertVisibleText(popup, "ID " + member.id());
                buttonByAccessibleText(popup,
                        "Roster-ID " + member.id() + ", Charakter bearbeiten: " + member.name());
            }
        });
    }

    private static void assertVisiblePartyRoster(Stage stage, List<PartyMemberDetails> members)
            throws Exception {
        assertVisibleRoster(stage, truth(members).members());
    }

    private static void assertNoVisibleRoster(Stage stage, List<MemberTruth> forbidden)
            throws Exception {
        Parent popup = openPartyPanel(stage);
        runOnFx(() -> {
            for (MemberTruth member : forbidden) {
                assertFalse(visibleText(popup, member.name()),
                        "foreign Campaign Roster identity must not be visible: " + member.id());
            }
        });
    }

    private static void assertRosterOnly(
            AppBootstrap bootstrap,
            int expectedReserveCount,
            String label
    ) throws Exception {
        CampaignRuntime runtime = bootstrap.campaignRuntimeForTesting();
        PartySnapshotResult result = runtime.components().party().snapshot().current();
        assertEquals(ReadStatus.SUCCESS, result.status(), label + " snapshot status");
        assertEquals(List.of(), result.snapshot().activeMembers(), label + " active Party remains empty");
        assertEquals(expectedReserveCount, result.snapshot().reserveMembers().size(),
                label + " reserve count");
        assertTrue(result.snapshot().reserveMembers().stream()
                        .allMatch(member -> member.membership() == MembershipState.RESERVE),
                label + " reserve membership is explicit");
        assertEquals(List.of(), runtime.components().party().activeParty().current().memberIds(),
                label + " active Party publication remains empty");
        assertEquals(List.of(), runtime.components().party().travelPositions().current()
                        .partyTokenCharacterIds(),
                label + " Party travel token remains empty");
        awaitFxCondition(() -> sceneProjectionMatches(bootstrap, List.of()));
        assertEquals(List.of(), runtime.components().scene().model().current().activePartyMembers(),
                label + " Scene chooser has no active Party members");
        assertTrue(runtime.components().scene().model().current().scenes().stream()
                        .allMatch(scene -> scene.partyMembers().isEmpty()),
                label + " no created PC is attached to a Scene");
    }

    private static boolean activePartyAndSceneProjectionMatches(
            AppBootstrap bootstrap,
            List<Long> expectedMemberIds
    ) {
        return activePartyMemberIds(bootstrap).equals(expectedMemberIds)
                && sceneProjectionMatches(bootstrap, expectedMemberIds);
    }

    private static List<Long> activePartyMemberIds(AppBootstrap bootstrap) {
        return bootstrap.campaignRuntimeForTesting().components().party().snapshot().current()
                .snapshot().activeMembers().stream()
                .map(PartyMemberDetails::id)
                .toList();
    }

    private static boolean sceneProjectionMatches(
            AppBootstrap bootstrap,
            List<Long> expectedMemberIds
    ) {
        var scene = bootstrap.campaignRuntimeForTesting().components().scene().model().current();
        return scene.activePartyMembers().stream()
                        .map(member -> member.id())
                        .toList().equals(expectedMemberIds);
    }

    private static void assertExactRoster(
            AppBootstrap bootstrap,
            RosterTruth expected,
            String label
    ) {
        assertEquals(expected, truth(reserveMembers(bootstrap)), label + " exact Roster truth");
    }

    private static RosterTruth truth(List<PartyMemberDetails> members) {
        return new RosterTruth(members.stream().map(MemberTruth::from).toList());
    }

    private static List<PartyMemberDetails> reserveMembers(AppBootstrap bootstrap) {
        PartySnapshotResult current = bootstrap.campaignRuntimeForTesting().components()
                .party().snapshot().current();
        assertEquals(ReadStatus.SUCCESS, current.status(), "Party snapshot status");
        return current.snapshot().reserveMembers();
    }

    private static PartyMemberDetails member(AppBootstrap bootstrap, long id) {
        return reserveMembers(bootstrap).stream()
                .filter(candidate -> candidate.id() == id)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Roster-ID not found: " + id));
    }

    private static TextField campaignNameField(Stage stage) {
        return stage.getScene().lookup(".campaign-desk-name") instanceof TextField field
                ? field
                : null;
    }

    private static Button campaignRow(Stage stage, String campaignName) {
        return stage.getScene().getRoot().lookupAll(".campaign-desk-row").stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> button.getAccessibleText() != null
                        && button.getAccessibleText().contains(campaignName))
                .findFirst()
                .orElse(null);
    }

    private static Button partyTrigger(Stage stage) {
        return descendants(stage.getScene().getRoot()).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> button.getTooltip() != null
                        && PARTY_TOOLTIP.equals(button.getTooltip().getText()))
                .findFirst()
                .orElse(null);
    }

    private static Parent partyPopupRootOrNull() {
        for (Window window : Window.getWindows()) {
            if (!window.isShowing() || window.getScene() == null
                    || window.getScene().getRoot() == null) {
                continue;
            }
            Parent root = window.getScene().getRoot();
            if (descendants(root).stream().anyMatch(PartyTopBarView.class::isInstance)) {
                return root;
            }
        }
        return null;
    }

    private static Button button(Parent parent, String text) {
        Button button = buttonOrNull(parent, text);
        if (button == null) {
            throw new AssertionError("Visible enabled Button not found: " + text);
        }
        return button;
    }

    private static Button buttonOrNull(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .filter(Node::isVisible)
                .filter(button -> !button.isDisabled())
                .findFirst()
                .orElse(null);
    }

    private static Button buttonByAccessibleText(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .filter(Node::isVisible)
                .filter(button -> !button.isDisabled())
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "Visible enabled Button not found: " + accessibleText));
    }

    private static TextField textField(Parent parent, String promptText) {
        return descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> promptText.equals(field.getPromptText()))
                .filter(Node::isVisible)
                .findFirst()
                .orElse(null);
    }

    private static void assertVisibleText(Parent parent, String text) {
        assertTrue(visibleText(parent, text), "Visible text not found: " + text);
    }

    private static boolean visibleText(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Node::isVisible)
                .map(CampaignRosterProductionJourneyTest::textValue)
                .anyMatch(value -> value.contains(text));
    }

    private static String textValue(Node node) {
        if (node instanceof Button button) {
            return button.getText();
        }
        if (node instanceof Label label) {
            return label.getText();
        }
        return "";
    }

    private static List<Node> descendants(Node root) {
        List<Node> result = new ArrayList<>();
        ArrayDeque<Node> pending = new ArrayDeque<>();
        pending.add(root);
        while (!pending.isEmpty()) {
            Node node = pending.removeFirst();
            result.add(node);
            if (node instanceof Parent parent) {
                pending.addAll(parent.getChildrenUnmodifiable());
            }
        }
        return List.copyOf(result);
    }

    private static void fireKey(EventTarget target, KeyCode code, boolean alt) {
        Event.fireEvent(target, new javafx.scene.input.KeyEvent(
                javafx.scene.input.KeyEvent.KEY_PRESSED,
                "", "", code, false, false, alt, false));
        Event.fireEvent(target, new javafx.scene.input.KeyEvent(
                javafx.scene.input.KeyEvent.KEY_RELEASED,
                "", "", code, false, false, alt, false));
    }

    private static <T> T await(CompletionStage<T> stage) throws Exception {
        return stage.toCompletableFuture().get(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
    }

    private static void awaitFxCondition(java.util.function.BooleanSupplier condition)
            throws Exception {
        long deadline = System.nanoTime() + TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            AtomicBoolean satisfied = new AtomicBoolean();
            runOnFx(() -> satisfied.set(condition.getAsBoolean()));
            if (satisfied.get()) {
                return;
            }
            java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(5));
        }
        throw new AssertionError("Timed out waiting for JavaFX condition");
    }

    private static void runOnFx(ThrowingRunnable action) throws Exception {
        if (Platform.isFxApplicationThread()) {
            action.run();
            return;
        }
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        testsupport.JavaFxRuntime.startup(() -> {
            try {
                Platform.setImplicitExit(false);
                action.run();
            } catch (Throwable throwable) {
                failure.set(throwable);
            } finally {
                completed.countDown();
            }
        });
        if (!completed.await(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX work");
        }
        Throwable thrown = failure.get();
        if (thrown instanceof Exception exception) {
            throw exception;
        }
        if (thrown instanceof Error error) {
            throw error;
        }
        if (thrown != null) {
            throw new IllegalStateException("JavaFX work failed", thrown);
        }
    }

    private record RosterTruth(List<MemberTruth> members) {
        private RosterTruth {
            members = List.copyOf(members);
        }
    }

    private record MemberTruth(
            long id,
            String name,
            String playerName,
            Integer level,
            Integer passivePerception,
            Integer armorClass,
            MembershipState membership
    ) {
        private static MemberTruth from(PartyMemberDetails member) {
            return new MemberTruth(
                    member.id(),
                    member.name(),
                    member.playerName(),
                    member.level(),
                    member.passivePerception(),
                    member.armorClass(),
                    member.membership());
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
