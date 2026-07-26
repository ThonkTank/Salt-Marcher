package features.party.adapter.javafx.party;

import features.party.PartyServiceAssembly;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;
import features.party.api.ActivePartyCompositionModel;
import features.party.api.ActivePartyModel;
import features.party.api.AwardPartyXpCommand;
import features.party.api.PartyApi;
import features.party.api.PartyMemberDetails;
import features.party.api.PartySnapshotModel;
import features.party.api.ReadStatus;
import javafx.application.Platform;
import javafx.event.Event;
import javafx.geometry.Bounds;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.robot.Robot;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import javafx.stage.Window;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import platform.persistence.TestFeatureStores;

import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellSlot;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

@org.junit.jupiter.api.Tag("ui")
public final class PartyDropdownTest {

    private static final int AWAIT_SECONDS = 30;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @BeforeAll
    static void startJavaFx() throws Exception {
        startFx();
    }

    @AfterEach
    void hideWindows() throws Exception {
        runOnFxThread(PartyDropdownTest::hideOpenWindows);
    }

    @AfterAll
    static void stopJavaFx() throws Exception {
        shutdownFx();
    }

    @Test
    void PARTY_DROPDOWN_001() throws Exception {
        resetDatabase();
        runOnFxThread(() -> {
            PartyDropdownFixture fixture = setupDropdown();
            assertInitialTrigger(fixture, "PARTY-DROPDOWN-001");
            openDropdown(fixture);
            assertOpenedEmptyDropdown(fixture, "PARTY-DROPDOWN-001");
        });
    }

    @Test
    void PARTY_DROPDOWN_002() throws Exception {
        resetDatabase();
        runOnFxThread(() -> {
            PartyDropdownFixture fixture = setupDropdown();
            assertInitialTrigger(fixture, "setup initial dropdown");
            openDropdown(fixture);
            assertOpenedEmptyDropdown(fixture, "setup initial dropdown");
            PartyMemberDetails aria = createAria(fixture);
            assertEquals("Aria", aria.name(), "created character name");
            assertCreatedActiveParty(fixture, aria, "PARTY-DROPDOWN-002");
        });
    }

    @Test
    void PARTY_DROPDOWN_003() throws Exception {
        resetDatabase();
        runOnFxThread(() -> {
            PartyDropdownFixture fixture = openedDropdown();
            PartyMemberDetails aria = createAria(fixture);
            assertCreatedActiveParty(fixture, aria, "setup created active party");
            moveAriaToReserve(fixture);
            assertRemovedToReserve(fixture, "PARTY-DROPDOWN-003");
        });
    }

    @Test
    void PARTY_DROPDOWN_004() throws Exception {
        resetDatabase();
        runOnFxThread(() -> {
            PartyDropdownFixture fixture = openedDropdown();
            PartyMemberDetails aria = createAria(fixture);
            moveAriaToReserve(fixture);
            assertRemovedToReserve(fixture, "setup removed to reserve");
            restoreAriaToActive(fixture);
            assertRestoredActiveParty(fixture, aria, "PARTY-DROPDOWN-004");
        });
    }

    @Test
    void PARTY_DROPDOWN_005_name_only_creation_adds_roster_character_without_activating_party() throws Exception {
        resetDatabase();
        runOnFxThread(() -> {
            PartyDropdownFixture fixture = openedDropdown();

            button(fixture.popup(), "+ Roster-Charakter").fire();
            layoutOpenWindows();
            setText(fixture.popup(), "Charaktername", "Aria");
            button(fixture.popup(), "Erstellen").fire();
            layoutOpenWindows();

            assertEquals(ReadStatus.SUCCESS, fixture.snapshots().current().status(),
                    "name-only roster creation snapshot status");
            assertEquals(Integer.valueOf(0),
                    Integer.valueOf(fixture.snapshots().current().snapshot().activeMembers().size()),
                    "name-only roster creation does not imply active Party membership");
            assertEquals(Integer.valueOf(1),
                    Integer.valueOf(fixture.snapshots().current().snapshot().reserveMembers().size()),
                    "name-only roster creation persists one roster character");
            PartyMemberDetails aria = onlyReserveMember(fixture.snapshots());
            assertEquals(null, aria.playerName(), "name-only roster creation leaves player unset");
            assertEquals(null, aria.level(), "name-only roster creation leaves level unset");
            assertEquals(null, aria.passivePerception(), "name-only roster creation leaves PP unset");
            assertEquals(null, aria.armorClass(), "name-only roster creation leaves AC unset");
            assertVisibleText(fixture.popup(), "ID " + aria.id(),
                    "roster exposes stable identity independently of duplicate-capable name");
            assertTrue(buttonsByText(fixture.popup(), "+ Neuer Charakter") == 0L,
                    "legacy auto-activation affordance is absent");
            assertActivePublication(fixture.activeParty(), fixture.activeComposition(), List.of(), List.of());
        });
    }

    @Test
    void PARTY_DROPDOWN_006_duplicate_names_remain_distinguishable_by_stable_roster_identity() throws Exception {
        resetDatabase();
        runOnFxThread(() -> {
            PartyDropdownFixture fixture = openedDropdown();

            createNameOnlyRosterCharacter(fixture, "Aria");
            createNameOnlyRosterCharacter(fixture, "Aria");

            List<PartyMemberDetails> roster = fixture.snapshots().current().snapshot().reserveMembers();
            assertEquals(Integer.valueOf(2), Integer.valueOf(roster.size()),
                    "duplicate character names are accepted as separate roster entries");
            assertTrue(!roster.get(0).id().equals(roster.get(1).id()),
                    "duplicate names receive distinct stable identities");
            for (PartyMemberDetails member : roster) {
                assertVisibleText(fixture.popup(), "ID " + member.id(),
                        "duplicate roster entry exposes stable identity " + member.id());
                buttonByAccessibleText(
                        fixture.popup(),
                        "Roster-ID " + member.id() + ", Charakter bearbeiten: Aria");
            }
            assertActivePublication(fixture.activeParty(), fixture.activeComposition(), List.of(), List.of());
        });
    }

    @Test
    void PARTY_DROPDOWN_008_stable_id_remains_rendered_before_constrained_long_identity() throws Exception {
        resetDatabase();
        runOnFxThread(() -> {
            PartyDropdownFixture fixture = openedDropdown();
            String longName = "Aster mit einem aussergewoehnlich langen vollstaendigen Charakternamen ".repeat(4);
            createNameOnlyRosterCharacter(fixture, longName);
            PartyMemberDetails created = onlyReserveMember(fixture.snapshots());
            layoutOpenWindows();

            Label stableId = labelByStyleClass(fixture.popup(), "party-roster-id");
            Label clippedIdentity = labelByStyleClass(fixture.popup(), "party-roster-identity");
            Bounds popupBounds = fixture.popup().localToScene(fixture.popup().getLayoutBounds());
            Bounds idBounds = stableId.localToScene(stableId.getLayoutBounds());
            Bounds identityBounds = clippedIdentity.localToScene(clippedIdentity.getLayoutBounds());

            assertEquals("ID " + created.id(), stableId.getText(), "stable ID visible text");
            assertTrue(stableId.isVisible() && stableId.getWidth() >= stableId.prefWidth(-1.0) - 1.0,
                    "stable ID receives its complete preferred width");
            assertTrue(idBounds.getMinX() >= popupBounds.getMinX()
                            && idBounds.getMaxX() <= popupBounds.getMaxX(),
                    "stable ID remains inside constrained popup bounds");
            assertTrue(idBounds.getMaxX() <= identityBounds.getMinX(),
                    "stable ID is a separate leading element before clipped identity text");
            assertTrue(fixture.popup().getScene().getWidth() <= PartyTopBarView.POPUP_WIDTH + 1.0,
                    "long identity remains inside the constrained Party popup");
        });
    }

    @Test
    void PARTY_DROPDOWN_009_keyboard_editor_focus_returns_after_cancel_create_and_edit() throws Exception {
        resetDatabase();
        AtomicReference<PartyDropdownFixture> fixtureRef = new AtomicReference<>();
        runOnFxThread(() -> fixtureRef.set(openedDropdown()));

        runOnFxThread(() -> {
            PartyDropdownFixture fixture = fixtureRef.get();
            Button createButton = button(fixture.popup(), "+ Roster-Charakter");
            createButton.requestFocus();
            pressKey(createButton, KeyCode.SPACE);
        });
        awaitFxCondition(() -> editorNameFocused(fixtureRef.get()));

        runOnFxThread(() -> {
            PartyDropdownFixture fixture = fixtureRef.get();
            PartyRosterTopBarView rosterView = descendant(fixture.popup(), PartyRosterTopBarView.class);
            TextField nameField = textField(fixture.popup(), "Charaktername");
            assertTrue(nameField.isFocused(), "keyboard create transfers focus into required name field");
            assertTrue(rosterView.isDisabled(), "background Roster is inert while editor is open");

            Button cancelButton = button(fixture.popup(), "Abbrechen");
            cancelButton.requestFocus();
        });

        runOnFxThread(() -> {
            PartyDropdownFixture fixture = fixtureRef.get();
            Button cancelButton = button(fixture.popup(), "Abbrechen");
            assertTrue(cancelButton.isFocused(), "keyboard traversal can focus editor cancel action");
            pressKey(cancelButton, KeyCode.SPACE);
        });
        awaitFxCondition(() -> rosterInvokerFocused(fixtureRef.get(), "+ Roster-Charakter", null));

        runOnFxThread(() -> {
            PartyDropdownFixture fixture = fixtureRef.get();
            PartyRosterTopBarView rosterView = descendant(fixture.popup(), PartyRosterTopBarView.class);
            Button createButton = button(fixture.popup(), "+ Roster-Charakter");
            assertTrue(!rosterView.isDisabled(), "cancel re-enables Roster controls");
            assertTrue(createButton.isFocused(), "cancel restores exact create invoker focus; actual="
                    + fixture.popup().getScene().getFocusOwner());

            pressKey(createButton, KeyCode.SPACE);
        });
        awaitFxCondition(() -> editorNameFocused(fixtureRef.get()));

        runOnFxThread(() -> {
            PartyDropdownFixture fixture = fixtureRef.get();
            PartyRosterTopBarView rosterView = descendant(fixture.popup(), PartyRosterTopBarView.class);
            TextField nameField = textField(fixture.popup(), "Charaktername");
            assertTrue(nameField.isFocused(), "reopened create restores editor focus");
            assertTrue(rosterView.isDisabled(), "reopened editor keeps background inert");
            typeText(nameField, "Aster");
            pressKey(nameField, KeyCode.ENTER);
        });
        awaitFxCondition(() -> rosterInvokerFocused(fixtureRef.get(), "+ Roster-Charakter", null));

        runOnFxThread(() -> {
            PartyDropdownFixture fixture = fixtureRef.get();
            PartyRosterTopBarView rosterView = descendant(fixture.popup(), PartyRosterTopBarView.class);
            Button createButton = button(fixture.popup(), "+ Roster-Charakter");
            PartyMemberDetails created = onlyReserveMember(fixture.snapshots());
            assertTrue(createButton.isFocused(), "successful create restores exact create invoker focus");

            Button editButton = buttonByAccessibleText(
                    fixture.popup(),
                    "Roster-ID " + created.id() + ", Charakter bearbeiten: Aster");
            editButton.requestFocus();
        });

        runOnFxThread(() -> {
            PartyDropdownFixture fixture = fixtureRef.get();
            PartyMemberDetails created = onlyReserveMember(fixture.snapshots());
            Button editButton = buttonByAccessibleText(
                    fixture.popup(),
                    "Roster-ID " + created.id() + ", Charakter bearbeiten: Aster");
            assertTrue(editButton.isFocused(), "keyboard traversal can focus stable-ID edit action");
            pressKey(editButton, KeyCode.SPACE);
        });
        awaitFxCondition(() -> editorNameFocused(fixtureRef.get()));

        runOnFxThread(() -> {
            PartyDropdownFixture fixture = fixtureRef.get();
            TextField nameField = textField(fixture.popup(), "Charaktername");
            assertTrue(nameField.isFocused(), "keyboard edit transfers focus into name field");
            typeText(nameField, "Aster Prime");
            pressKey(nameField, KeyCode.ENTER);
        });
        awaitFxCondition(() -> rosterInvokerFocused(
                fixtureRef.get(), null, "Charakter bearbeiten: Aster Prime"));

        runOnFxThread(() -> {
            PartyDropdownFixture fixture = fixtureRef.get();
            PartyRosterTopBarView rosterView = descendant(fixture.popup(), PartyRosterTopBarView.class);
            PartyMemberDetails updated = onlyReserveMember(fixture.snapshots());
            assertEquals("Aster Prime", updated.name(), "keyboard editor saves replacement name");
            Button rerenderedEditButton = buttonByAccessibleText(
                    fixture.popup(),
                    "Roster-ID " + updated.id() + ", Charakter bearbeiten: Aster Prime");
            assertTrue(rerenderedEditButton.isFocused(),
                    "successful edit restores focus to the rerendered stable-ID invoker");
            assertTrue(!rosterView.isDisabled(), "successful edit re-enables Roster controls");
        });
    }

    @Test
    void PARTY_DROPDOWN_007_optional_character_facts_can_be_cleared() throws Exception {
        resetDatabase();
        runOnFxThread(() -> {
            PartyDropdownFixture fixture = openedDropdown();
            button(fixture.popup(), "+ Roster-Charakter").fire();
            layoutOpenWindows();
            setText(fixture.popup(), "Charaktername", "Aria");
            setText(fixture.popup(), "Spielername", "Mira");
            setText(fixture.popup(), "Level", "3");
            setText(fixture.popup(), "Passive Perception", "14");
            setText(fixture.popup(), "AC", "16");
            button(fixture.popup(), "Erstellen").fire();
            layoutOpenWindows();

            PartyMemberDetails aria = onlyReserveMember(fixture.snapshots());
            buttonByAccessibleText(
                    fixture.popup(),
                    "Roster-ID " + aria.id() + ", Charakter bearbeiten: Aria").fire();
            layoutOpenWindows();
            setText(fixture.popup(), "Spielername", "");
            setText(fixture.popup(), "Level", "");
            setText(fixture.popup(), "Passive Perception", "");
            setText(fixture.popup(), "AC", "");
            button(fixture.popup(), "Speichern").fire();
            layoutOpenWindows();

            PartyMemberDetails cleared = onlyReserveMember(fixture.snapshots());
            assertEquals(null, cleared.playerName(), "optional player can be cleared");
            assertEquals(null, cleared.level(), "optional level can be cleared");
            assertEquals(null, cleared.passivePerception(), "optional PP can be cleared");
            assertEquals(null, cleared.armorClass(), "optional AC can be cleared");
            assertActivePublication(fixture.activeParty(), fixture.activeComposition(), List.of(), List.of());
        });
    }

    @Test
    void PARTY_DROPDOWN_010_editing_other_fields_preserves_ready_to_level_xp() throws Exception {
        resetDatabase();
        runOnFxThread(() -> {
            PartyDropdownFixture fixture = openedDropdown();
            button(fixture.popup(), "+ Roster-Charakter").fire();
            layoutOpenWindows();
            setText(fixture.popup(), "Charaktername", "Aria");
            setText(fixture.popup(), "Spielername", "Mira");
            setText(fixture.popup(), "Level", "3");
            button(fixture.popup(), "Erstellen").fire();
            layoutOpenWindows();

            PartyMemberDetails created = onlyReserveMember(fixture.snapshots());
            fixture.application().awardXp(new AwardPartyXpCommand(List.of(created.id()), 1_800));
            layoutOpenWindows();
            PartyMemberDetails ready = onlyReserveMember(fixture.snapshots());
            assertEquals(2_700, ready.currentXp(), "XP award reaches the next-level threshold");
            assertEquals(Boolean.TRUE, ready.readyToLevel(), "character is visibly ready to level");

            buttonByAccessibleText(
                    fixture.popup(),
                    "Roster-ID " + ready.id() + ", Charakter bearbeiten: Aria").fire();
            layoutOpenWindows();
            setText(fixture.popup(), "Spielername", "Mira Neu");
            button(fixture.popup(), "Speichern").fire();
            layoutOpenWindows();

            PartyMemberDetails edited = onlyReserveMember(fixture.snapshots());
            assertEquals("Mira Neu", edited.playerName(), "ordinary Roster edit is applied");
            assertEquals(Integer.valueOf(3), edited.level(), "unchanged authored level is preserved");
            assertEquals(2_700, edited.currentXp(), "ordinary Roster edit cannot discard earned XP");
            assertEquals(1_800, edited.xpSinceLongRest(), "long-rest progress remains exact");
            assertEquals(1_800, edited.xpSinceShortRest(), "short-rest progress remains exact");
            assertEquals(Boolean.TRUE, edited.readyToLevel(), "ready-to-level state remains exact");
        });
    }

    private static PartyDropdownFixture openedDropdown() {
        PartyDropdownFixture fixture = setupDropdown();
        openDropdown(fixture);
        return fixture;
    }

    private static PartyDropdownFixture setupDropdown() {
        PartyServiceAssembly.Component services = services();
        PartySnapshotModel snapshots = services.snapshot();
        ActivePartyModel activeParty = services.activeParty();
        ActivePartyCompositionModel activeComposition = services.activeComposition();
        ShellBinding binding = new PartyTopBarContribution(
                services.application(),
                services.snapshot(),
                services.adventuringDaySummary(),
                services.mutation()).bind();
        Parent topBar = slot(binding, ShellSlot.TOP_BAR, Parent.class);
        HBox root = new HBox(topBar);
        Stage stage = new Stage();
        stage.setScene(new Scene(root, 520.0, 420.0));
        stage.show();
        layout(root);

        Button trigger = descendant(topBar, Button.class);
        return new PartyDropdownFixture(
                services.application(), snapshots, activeParty, activeComposition, trigger, null);
    }

    private static void openDropdown(PartyDropdownFixture fixture) {
        fixture.trigger().fire();
        layoutOpenWindows();
        fixture.popup(partyPopupRoot());
    }

    private static void assertInitialTrigger(PartyDropdownFixture fixture, String label) {
        assertEquals("Keine _Party ▼", fixture.trigger().getText(), label + " initial trigger readback");
    }

    private static void assertOpenedEmptyDropdown(PartyDropdownFixture fixture, String label) {
        assertEquals(PartyTopBarView.OPEN_ACCESSIBLE_TEXT, fixture.trigger().getAccessibleText(),
                label + " trigger exposes open popup state");
        assertRosterCounts(fixture.popup(), 0, 0, label + " initial empty roster");
    }

    private static PartyMemberDetails createAria(PartyDropdownFixture fixture) {
        button(fixture.popup(), "+ Roster-Charakter").fire();
        layoutOpenWindows();
        setText(fixture.popup(), "Charaktername", "Aria");
        setText(fixture.popup(), "Spielername", "Mira");
        setText(fixture.popup(), "Level", "3");
        setText(fixture.popup(), "Passive Perception", "14");
        setText(fixture.popup(), "AC", "16");
        button(fixture.popup(), "Erstellen").fire();
        layoutOpenWindows();
        PartyMemberDetails aria = onlyReserveMember(fixture.snapshots());
        buttonByAccessibleText(
                fixture.popup(),
                "Roster-ID " + aria.id() + ", zur aktiven Party hinzufuegen: Aria").fire();
        layoutOpenWindows();
        return onlyActiveMember(fixture.snapshots());
    }

    private static void createNameOnlyRosterCharacter(PartyDropdownFixture fixture, String name) {
        button(fixture.popup(), "+ Roster-Charakter").fire();
        layoutOpenWindows();
        setText(fixture.popup(), "Charaktername", name);
        button(fixture.popup(), "Erstellen").fire();
        layoutOpenWindows();
    }

    private static void assertCreatedActiveParty(PartyDropdownFixture fixture, PartyMemberDetails aria, String label) {
        assertRosterCounts(fixture.popup(), 1, 0, label + " created character is active");
        assertActivePublication(fixture.activeParty(), fixture.activeComposition(), List.of(aria.id()), List.of(3));
        assertEquals("1 Charaktere, Ø Lv 3 ▼", fixture.trigger().getText(),
                label + " top-bar trigger reflects active published party");
    }

    private static void moveAriaToReserve(PartyDropdownFixture fixture) {
        buttonByAccessibleText(fixture.popup(), "Entfernen, aus aktiver Party entfernen: Aria").fire();
        layoutOpenWindows();
    }

    private static void assertRemovedToReserve(PartyDropdownFixture fixture, String label) {
        assertRosterCounts(fixture.popup(), 0, 1, label + " remove moves character to reserve");
        assertActivePublication(fixture.activeParty(), fixture.activeComposition(), List.of(), List.of());
    }

    private static void restoreAriaToActive(PartyDropdownFixture fixture) {
        PartyMemberDetails aria = onlyReserveMember(fixture.snapshots());
        buttonByAccessibleText(
                fixture.popup(),
                "Roster-ID " + aria.id() + ", zur aktiven Party hinzufuegen: Aria").fire();
        layoutOpenWindows();
    }

    private static void assertRestoredActiveParty(PartyDropdownFixture fixture, PartyMemberDetails aria, String label) {
        assertRosterCounts(fixture.popup(), 1, 0, label + " add existing restores active party selection");
        assertActivePublication(fixture.activeParty(), fixture.activeComposition(), List.of(aria.id()), List.of(3));
        assertEquals("1 Charaktere, Ø Lv 3 ▼", fixture.trigger().getText(),
                label + " top-bar trigger reflects restored active party");
    }

    private static PartyServiceAssembly.Component services() {
        return PartyServiceAssembly.create(new SqlitePartyRosterRepository(
                        TestFeatureStores.current().store(
                                SqlitePartyRosterRepository.storeDefinition())));
    }

    private static PartyMemberDetails onlyActiveMember(PartySnapshotModel snapshots) {
        assertEquals(ReadStatus.SUCCESS, snapshots.current().status(), "party snapshot status");
        List<PartyMemberDetails> activeMembers = snapshots.current().snapshot().activeMembers();
        assertEquals(Integer.valueOf(1), Integer.valueOf(activeMembers.size()), "active member count");
        return activeMembers.getFirst();
    }

    private static PartyMemberDetails onlyReserveMember(PartySnapshotModel snapshots) {
        assertEquals(ReadStatus.SUCCESS, snapshots.current().status(), "party snapshot status");
        List<PartyMemberDetails> reserveMembers = snapshots.current().snapshot().reserveMembers();
        assertEquals(Integer.valueOf(1), Integer.valueOf(reserveMembers.size()), "roster-only member count");
        return reserveMembers.getFirst();
    }

    private static void assertRosterCounts(
            Parent popup,
            int activeCount,
            int reserveCount,
            String label
    ) {
        assertEquals(Long.valueOf(activeCount), Long.valueOf(buttonsByText(popup, "Entfernen")),
                label + " active count");
        assertEquals(Long.valueOf(reserveCount), Long.valueOf(buttonsContaining(popup, "zur aktiven Party")),
                label + " reserve count");
        assertVisibleText(popup, activeCount == 0 ? "Keine aktiven Party-Mitglieder" : "Aria",
                label + " visible active roster");
        assertNoVisibleText(popup, "Party konnte nicht geladen werden.", label + " has no storage error");
    }

    private static void assertActivePublication(
            ActivePartyModel activeParty,
            ActivePartyCompositionModel activeComposition,
            List<Long> memberIds,
            List<Integer> levels
    ) {
        assertEquals(ReadStatus.SUCCESS, activeParty.current().status(), "active party status");
        assertEquals(memberIds, activeParty.current().memberIds(), "active party ids");
        assertEquals(ReadStatus.SUCCESS, activeComposition.current().status(), "active composition status");
        assertEquals(levels, activeComposition.current().composition().activePartyLevels(),
                "active composition levels");
    }

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new AssertionError(label + ": expected <" + expected + "> but was <" + actual + ">.");
        }
    }

    private static void assertTrue(boolean condition, String label) {
        if (!condition) {
            throw new AssertionError(label);
        }
    }

    private static void assertVisibleText(Parent parent, String text, String label) {
        assertTrue(descendants(parent).stream().anyMatch(node -> textValue(node).contains(text) && node.isVisible()), label);
    }

    private static void assertNoVisibleText(Parent parent, String text, String label) {
        assertTrue(descendants(parent).stream().noneMatch(node -> text.equals(textValue(node)) && node.isVisible()), label);
    }

    private static long buttonsByText(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .filter(PartyDropdownTest::isTreeVisible)
                .count();
    }

    private static long buttonsContaining(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> button.getAccessibleText() != null && button.getAccessibleText().contains(text))
                .filter(PartyDropdownTest::isTreeVisible)
                .count();
    }

    private static Button button(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .filter(PartyDropdownTest::isTreeVisible)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + text));
    }

    private static Button buttonByAccessibleText(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .filter(PartyDropdownTest::isTreeVisible)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + accessibleText));
    }

    private static void setText(Parent parent, String promptText, String value) {
        descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> promptText.equals(field.getPromptText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("TextField not found: " + promptText))
                .setText(value);
    }

    private static TextField textField(Parent parent, String promptText) {
        return descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> promptText.equals(field.getPromptText()))
                .filter(PartyDropdownTest::isTreeVisible)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Visible TextField not found: " + promptText));
    }

    private static Label labelByStyleClass(Parent parent, String styleClass) {
        return descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .filter(label -> label.getStyleClass().contains(styleClass))
                .filter(PartyDropdownTest::isTreeVisible)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Visible Label style not found: " + styleClass));
    }

    private static void pressKey(Node target, KeyCode code) {
        if (!target.isFocused()) {
            throw new AssertionError("Keyboard target is not focused: " + target);
        }
        Robot robot = new Robot();
        robot.keyPress(code);
        robot.keyRelease(code);
    }

    private static boolean isTreeVisible(Node node) {
        Node current = node;
        while (current != null) {
            if (!current.isVisible()) {
                return false;
            }
            current = current.getParent();
        }
        return true;
    }

    private static boolean editorNameFocused(PartyDropdownFixture fixture) {
        TextField name = visibleTextField(fixture.popup(), "Charaktername");
        PartyRosterTopBarView roster = descendant(fixture.popup(), PartyRosterTopBarView.class);
        return name != null && name.isFocused() && roster.isDisabled();
    }

    private static boolean rosterInvokerFocused(
            PartyDropdownFixture fixture,
            String buttonText,
            String accessibleTextSuffix
    ) {
        PartyRosterTopBarView roster = descendant(fixture.popup(), PartyRosterTopBarView.class);
        boolean editorClosed = visibleTextField(fixture.popup(), "Charaktername") == null;
        boolean invokerFocused = descendants(fixture.popup()).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(PartyDropdownTest::isTreeVisible)
                .filter(button -> buttonText == null || buttonText.equals(button.getText()))
                .filter(button -> accessibleTextSuffix == null
                        || button.getAccessibleText() != null
                        && button.getAccessibleText().endsWith(accessibleTextSuffix))
                .anyMatch(Button::isFocused);
        return editorClosed && !roster.isDisabled() && invokerFocused;
    }

    private static TextField visibleTextField(Parent parent, String promptText) {
        return descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> promptText.equals(field.getPromptText()))
                .filter(PartyDropdownTest::isTreeVisible)
                .findFirst()
                .orElse(null);
    }

    private static void awaitFxCondition(java.util.function.BooleanSupplier condition)
            throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(AWAIT_SECONDS);
        while (System.nanoTime() < deadline) {
            AtomicBoolean satisfied = new AtomicBoolean();
            runOnFxThread(() -> satisfied.set(condition.getAsBoolean()));
            if (satisfied.get()) {
                return;
            }
            java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(5));
        }
        throw new AssertionError("Timed out waiting for JavaFX editor state");
    }

    private static void typeText(TextField target, String text) {
        for (int index = 0; index < text.length(); index++) {
            String character = text.substring(index, index + 1);
            Event.fireEvent(target, new KeyEvent(
                    KeyEvent.KEY_TYPED,
                    character,
                    character,
                    KeyCode.UNDEFINED,
                    false,
                    false,
                    false,
                    false));
        }
    }

    private static String textValue(Node node) {
        if (node instanceof Button button) {
            return button.getText();
        }
        if (node instanceof javafx.scene.control.Label label) {
            return label.getText();
        }
        return "";
    }

    private static Parent partyPopupRoot() {
        for (Window window : Window.getWindows()) {
            Scene scene = window.getScene();
            if (scene == null || scene.getRoot() == null) {
                continue;
            }
            Parent root = scene.getRoot();
            boolean containsPartyPanel = descendants(root).stream().anyMatch(PartyTopBarView.class::isInstance);
            if (containsPartyPanel) {
                return root;
            }
        }
        throw new AssertionError("Party popup root not found.");
    }

    private static <T extends Node> T descendant(Parent parent, Class<T> type) {
        return descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Descendant not found: " + type.getSimpleName()));
    }

    private static <T extends Node> T slot(ShellBinding binding, ShellSlot slot, Class<T> type) {
        Map<ShellSlot, Node> content = binding.slotContent();
        Node node = content.get(slot);
        if (type.isInstance(node)) {
            return type.cast(node);
        }
        throw new AssertionError("Shell slot not found: " + slot);
    }

    private static List<Node> descendants(Node node) {
        ArrayList<Node> result = new ArrayList<>();
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

    private static void layoutOpenWindows() {
        for (Window window : Window.getWindows()) {
            Scene scene = window.getScene();
            if (scene != null && scene.getRoot() != null) {
                layout(scene.getRoot());
            }
        }
    }

    private static void resetDatabase() throws Exception {
        Path database = databasePath();
        Files.createDirectories(database.getParent());
        Files.deleteIfExists(database);
    }

    private static Path databasePath() {
        return TestFeatureStores.testDatabasePath();
    }

    private static void startFx() throws Exception {
        if (FX_STARTED.compareAndSet(false, true)) {
            CountDownLatch started = new CountDownLatch(1);
            testsupport.JavaFxRuntime.startup(started::countDown);
            await(started, "JavaFX startup");
            Platform.setImplicitExit(false);
        }
    }

    private static void hideOpenWindows() {
        for (Window window : List.copyOf(Window.getWindows())) {
            window.hide();
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
            testsupport.JavaFxRuntime.startup(wrappedAction);
        } else {
            Platform.runLater(wrappedAction);
        }
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX Party dropdown test.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Party dropdown test failed.", failure[0]);
        }
    }

    private static void await(CountDownLatch latch, String operation) throws InterruptedException {
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for " + operation + ".");
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
            testsupport.JavaFxRuntime.shutdown();
        });
    }

    private static final class PartyDropdownFixture {

        private final PartyApi application;
        private final PartySnapshotModel snapshots;
        private final ActivePartyModel activeParty;
        private final ActivePartyCompositionModel activeComposition;
        private final Button trigger;
        private Parent popup;

        private PartyDropdownFixture(
                PartyApi application,
                PartySnapshotModel snapshots,
                ActivePartyModel activeParty,
                ActivePartyCompositionModel activeComposition,
                Button trigger,
                Parent popup
        ) {
            this.application = application;
            this.snapshots = snapshots;
            this.activeParty = activeParty;
            this.activeComposition = activeComposition;
            this.trigger = trigger;
            this.popup = popup;
        }

        private PartyApi application() {
            return application;
        }

        private PartySnapshotModel snapshots() {
            return snapshots;
        }

        private ActivePartyModel activeParty() {
            return activeParty;
        }

        private ActivePartyCompositionModel activeComposition() {
            return activeComposition;
        }

        private Button trigger() {
            return trigger;
        }

        private Parent popup() {
            return popup;
        }

        private void popup(Parent popup) {
            this.popup = popup;
        }
    }

    @FunctionalInterface
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
}
