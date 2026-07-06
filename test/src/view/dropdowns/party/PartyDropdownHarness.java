package src.view.dropdowns.party;

import java.util.List;
import shell.api.ServiceRegistry;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.ReadStatus;
import src.view.slotcontent.topbar.dropdown.DropdownPopupContentModel;

public final class PartyDropdownHarness {

    private PartyDropdownHarness() {
    }

    public static void main(String[] args) {
        try {
            runHarness();
            System.out.println("Party dropdown harness passed.");
        } catch (Throwable throwable) {
            throwable.printStackTrace(System.err);
            System.exit(1);
        }
    }

    private static void runHarness() {
        ServiceRegistry services = services();
        PartyTopBarContributionModel presentationModel = new PartyTopBarContributionModel();
        PartyTopBarIntentHandler intentHandler = new PartyTopBarIntentHandler(
                presentationModel,
                new DropdownPopupContentModel(),
                services.require(PartyApplicationService.class));
        PartySnapshotModel snapshots = services.require(PartySnapshotModel.class);
        AdventuringDaySummaryModel daySummaries = services.require(AdventuringDaySummaryModel.class);
        PartyMutationModel mutations = services.require(PartyMutationModel.class);
        ActivePartyModel activeParty = services.require(ActivePartyModel.class);
        ActivePartyCompositionModel activeComposition = services.require(ActivePartyCompositionModel.class);

        applyLoad(presentationModel, snapshots, daySummaries);
        assertRosterCounts(presentationModel, 0, 0, "initial empty roster");

        intentHandler.consume(createEditorEvent());
        intentHandler.consume(submitEvent("Aria", "Mira", "3", "14", "16"));
        applyMutation(presentationModel, snapshots, daySummaries, mutations);

        PartyMemberDetails aria = onlyActiveMember(snapshots);
        assertEquals("Aria", aria.name(), "created character name");
        assertRosterCounts(presentationModel, 1, 0, "created character is active");
        assertActivePublication(activeParty, activeComposition, List.of(aria.id()), List.of(3));

        intentHandler.consume(removeEvent(aria.id()));
        applyMutation(presentationModel, snapshots, daySummaries, mutations);
        assertRosterCounts(presentationModel, 0, 1, "remove moves character to reserve");
        assertActivePublication(activeParty, activeComposition, List.of(), List.of());

        intentHandler.consume(addExistingEvent(aria.id()));
        applyMutation(presentationModel, snapshots, daySummaries, mutations);
        assertRosterCounts(presentationModel, 1, 0, "add existing restores active party selection");
        assertActivePublication(activeParty, activeComposition, List.of(aria.id()), List.of(3));
        assertEquals("1 Charaktere, Ø Lv 3 ▼",
                presentationModel.topBarContentModel().triggerTextProperty().get(),
                "top-bar trigger reflects active published party");
    }

    private static ServiceRegistry services() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        new src.data.party.PartyServiceContribution().register(builder);
        new src.domain.party.PartyServiceContribution().register(builder);
        return builder.build();
    }

    private static void applyLoad(
            PartyTopBarContributionModel presentationModel,
            PartySnapshotModel snapshots,
            AdventuringDaySummaryModel daySummaries
    ) {
        presentationModel.applyLoadResult(new PartyTopBarContributionModel.PanelData(
                snapshots.current(),
                daySummaries.current()));
    }

    private static void applyMutation(
            PartyTopBarContributionModel presentationModel,
            PartySnapshotModel snapshots,
            AdventuringDaySummaryModel daySummaries,
            PartyMutationModel mutations
    ) {
        presentationModel.applyMutationResult(new PartyTopBarContributionModel.MutationAndLoadResult(
                mutations.current(),
                new PartyTopBarContributionModel.PanelData(snapshots.current(), daySummaries.current())));
    }

    private static PartyRosterTopBarViewInputEvent createEditorEvent() {
        return new PartyRosterTopBarViewInputEvent(
                true, false, false, 0L, 0, false, false, false, false, "");
    }

    private static PartyRosterTopBarViewInputEvent removeEvent(long memberId) {
        return new PartyRosterTopBarViewInputEvent(
                false, false, false, memberId, 0, true, false, false, false, "");
    }

    private static PartyRosterTopBarViewInputEvent addExistingEvent(long memberId) {
        return new PartyRosterTopBarViewInputEvent(
                false, false, true, memberId, 0, false, false, false, false, "");
    }

    private static PartyEditorTopBarViewInputEvent submitEvent(
            String name,
            String playerName,
            String level,
            String passivePerception,
            String armorClass
    ) {
        return new PartyEditorTopBarViewInputEvent(
                false,
                true,
                false,
                false,
                false,
                new PartyEditorTopBarViewInputEvent.EditorDraft(
                        name,
                        playerName,
                        level,
                        passivePerception,
                        armorClass));
    }

    private static PartyMemberDetails onlyActiveMember(PartySnapshotModel snapshots) {
        assertEquals(ReadStatus.SUCCESS, snapshots.current().status(), "party snapshot status");
        List<PartyMemberDetails> activeMembers = snapshots.current().snapshot().activeMembers();
        assertEquals(Integer.valueOf(1), Integer.valueOf(activeMembers.size()), "active member count");
        return activeMembers.getFirst();
    }

    private static void assertRosterCounts(
            PartyTopBarContributionModel presentationModel,
            int activeCount,
            int reserveCount,
            String label
    ) {
        PartyRosterTopBarContentModel.PanelContent panel =
                presentationModel.rosterContentModel().panelContentProperty().get();
        assertEquals(Integer.valueOf(activeCount), Integer.valueOf(panel.activeMembers().size()),
                label + " active count");
        assertEquals(Integer.valueOf(reserveCount), Integer.valueOf(panel.reserveMembers().size()),
                label + " reserve count");
        assertTrue(!panel.loading(), label + " is not loading");
        assertTrue(!panel.storageError(), label + " has no storage error");
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
}
