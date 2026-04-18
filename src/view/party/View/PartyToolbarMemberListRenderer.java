package src.view.party.View;

import javafx.scene.Node;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;
import javafx.stage.Window;
import src.view.party.ViewModel.PartyToolbarViewModel;
import src.view.party.ViewModel.PartyViewData;

import java.util.Locale;
import java.util.Objects;
import java.util.function.Supplier;

final class PartyToolbarMemberListRenderer {

    private final PartyToolbarViewModel viewModel;
    private final Supplier<Window> ownerSupplier;
    private final PartyMemberCardFactory cardFactory = new PartyMemberCardFactory();
    private final VBox activeMembersBox = new VBox(8);
    private final VBox reserveMembersBox = new VBox(8);
    private final TextField reserveSearchField = new TextField();

    PartyToolbarMemberListRenderer(PartyToolbarViewModel viewModel, Supplier<Window> ownerSupplier) {
        this.viewModel = Objects.requireNonNull(viewModel, "viewModel");
        this.ownerSupplier = Objects.requireNonNull(ownerSupplier, "ownerSupplier");
        reserveSearchField.setPromptText("Filter reserve...");
        reserveSearchField.textProperty().addListener((obs, oldValue, newValue) -> refreshReserveMembers());
    }

    Node activeMembers() {
        return activeMembersBox;
    }

    Node reserveSearch() {
        return reserveSearchField;
    }

    Node reserveMembers() {
        return reserveMembersBox;
    }

    void refresh() {
        refreshActiveMembers();
        refreshReserveMembers();
    }

    private void refreshActiveMembers() {
        activeMembersBox.getChildren().clear();
        if (viewModel.snapshot().activeMembers().isEmpty()) {
            activeMembersBox.getChildren().add(cardFactory.mutedLabel("No active party members."));
            return;
        }
        for (PartyViewData.PartyMemberViewData member : viewModel.snapshot().activeMembers()) {
            activeMembersBox.getChildren().add(cardFactory.buildActiveMemberRow(member, viewModel, ownerSupplier));
        }
    }

    private void refreshReserveMembers() {
        reserveMembersBox.getChildren().clear();
        var filteredMembers = viewModel.snapshot().reserveMembers().stream()
                .filter(this::matchesReserveFilter)
                .toList();
        if (filteredMembers.isEmpty()) {
            reserveMembersBox.getChildren().add(cardFactory.mutedLabel(
                    viewModel.snapshot().reserveMembers().isEmpty()
                            ? "No reserve characters."
                            : "No reserve characters match the filter."));
            return;
        }
        for (PartyViewData.PartyMemberViewData member : filteredMembers) {
            reserveMembersBox.getChildren().add(cardFactory.buildReserveMemberRow(member, viewModel, ownerSupplier));
        }
    }

    private boolean matchesReserveFilter(PartyViewData.PartyMemberViewData member) {
        String filter = reserveSearchField.getText() == null
                ? ""
                : reserveSearchField.getText().trim().toLowerCase(Locale.ROOT);
        return filter.isEmpty()
                || member.name().toLowerCase(Locale.ROOT).contains(filter)
                || member.playerName().toLowerCase(Locale.ROOT).contains(filter);
    }
}
