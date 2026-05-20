package src.view.dropdowns.party;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartySnapshotModel;
import src.view.slotcontent.topbar.dropdown.DropdownPopupContentModel;
import src.view.slotcontent.topbar.dropdown.DropdownPopupView;

final class PartyTopBarBinder {

    private final ShellRuntimeContext runtimeContext;

    PartyTopBarBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        PartyTopBarContributionModel presentationModel = new PartyTopBarContributionModel();
        DropdownPopupContentModel popupContentModel = new DropdownPopupContentModel();
        PartyApplicationService partyService = runtimeContext.services().require(PartyApplicationService.class);
        EncounterApplicationService encounterService = runtimeContext.services().require(EncounterApplicationService.class);
        PartyTopBarIntentHandler intentHandler = new PartyTopBarIntentHandler(
                presentationModel,
                popupContentModel,
                partyService,
                () -> refreshEncounterSession(encounterService));
        PartyRosterTopBarView rosterView = new PartyRosterTopBarView();
        PartyEditorTopBarView editorView = new PartyEditorTopBarView();
        PartyTopBarView panelView = new PartyTopBarView(rosterView, editorView);
        DropdownPopupView topBarView = new DropdownPopupView(panelView);
        topBarView.bind(popupContentModel);
        panelView.bind(presentationModel.topBarContentModel());
        rosterView.bind(presentationModel.rosterContentModel());
        editorView.bind(presentationModel.editorContentModel());
        PartySnapshotModel snapshotModel = runtimeContext.services().require(PartySnapshotModel.class);
        AdventuringDaySummaryModel summaryModel = runtimeContext.services().require(AdventuringDaySummaryModel.class);
        PartyMutationModel mutationModel = runtimeContext.services().require(PartyMutationModel.class);
        applyPopupPresentation(popupContentModel, presentationModel.topBarContentModel().triggerTextProperty().get());
        presentationModel.topBarContentModel().triggerTextProperty().addListener((ignored, before, after) ->
                applyPopupPresentation(popupContentModel, after));
        panelView.onViewInputEvent(intentHandler::consume);
        topBarView.onViewInputEvent(intentHandler::consume);
        rosterView.onViewInputEvent(intentHandler::consume);
        editorView.onViewInputEvent(intentHandler::consume);
        snapshotModel.subscribe(snapshot ->
                presentationModel.applyLoadResult(new PartyTopBarContributionModel.PanelData(
                        snapshot,
                        summaryModel.current())));
        summaryModel.subscribe(summary ->
                presentationModel.applyLoadResult(new PartyTopBarContributionModel.PanelData(
                        snapshotModel.current(),
                        summary)));
        mutationModel.subscribe(result ->
                presentationModel.applyMutationResult(new PartyTopBarContributionModel.MutationAndLoadResult(
                        result,
                        new PartyTopBarContributionModel.PanelData(
                                snapshotModel.current(),
                                summaryModel.current()))));
        presentationModel.applyLoadResult(new PartyTopBarContributionModel.PanelData(
                snapshotModel.current(),
                summaryModel.current()));
        return new Binding(topBarView);
    }

    private static void applyPopupPresentation(
            DropdownPopupContentModel popupContentModel,
            String triggerText
    ) {
        String safeTriggerText = triggerText == null ? "" : triggerText;
        popupContentModel.showPresentation(new DropdownPopupContentModel.PopupPresentation(
                safeTriggerText,
                safeTriggerText.replace("_", ""),
                PartyTopBarView.OPEN_ACCESSIBLE_TEXT,
                PartyTopBarView.TOOLTIP_TEXT,
                true,
                PartyTopBarView.POPUP_WIDTH));
    }

    private static void refreshEncounterSession(EncounterApplicationService encounterService) {
        encounterService.applyState(new ApplyEncounterStateCommand(
                ApplyEncounterStateCommand.Action.REFRESH,
                0L,
                0L,
                0,
                0L,
                java.util.List.of(),
                "",
                0,
                0L,
                0,
                false));
    }

    private record Binding(Node topBar) implements ShellBinding {

        @Override
        public String title() {
            return "Party";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(ShellSlot.TOP_BAR, topBar);
        }
    }
}
