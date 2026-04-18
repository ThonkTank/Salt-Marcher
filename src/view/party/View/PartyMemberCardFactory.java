package src.view.party.View;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Window;
import src.view.party.ViewModel.PartyToolbarViewModel;
import src.view.party.ViewModel.PartyViewData;

import java.util.function.Supplier;

final class PartyMemberCardFactory {

    Node buildActiveMemberRow(
            PartyViewData.PartyMemberViewData member,
            PartyToolbarViewModel viewModel,
            Supplier<Window> ownerSupplier
    ) {
        Label nameLabel = new Label(member.name());
        nameLabel.getStyleClass().add("bold");
        Node restChip = member.restStatus() == null ? null : buildRestChip(member.restStatus());
        Label detailsLabel = mutedLabel(buildPrimaryDetails(member));
        Label xpLabel = new Label(buildXpDetails(member));
        xpLabel.setWrapText(true);

        Button xpButton = new Button("Award XP");
        xpButton.setOnAction(event -> PartyToolbarDialogs.promptForXp(viewModel, member, ownerSupplier.get()));
        Button editButton = new Button("Edit");
        editButton.setOnAction(event -> PartyToolbarDialogs.showEditDialog(viewModel, member, ownerSupplier.get()));
        Button reserveButton = new Button("Reserve");
        reserveButton.setOnAction(event -> viewModel.moveToReserve(member.id()));
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox headerRow = new HBox(8, nameLabel, spacer);
        headerRow.setAlignment(Pos.CENTER_LEFT);
        if (restChip != null) {
            headerRow.getChildren().add(restChip);
        }
        HBox actionRow = new HBox(8, xpButton, editButton, spacer, reserveButton);
        actionRow.setAlignment(Pos.CENTER_LEFT);
        return wrapCard(new VBox(6, headerRow, detailsLabel, xpLabel, actionRow));
    }

    Node buildReserveMemberRow(
            PartyViewData.PartyMemberViewData member,
            PartyToolbarViewModel viewModel,
            Supplier<Window> ownerSupplier
    ) {
        Label nameLabel = new Label(member.name());
        nameLabel.getStyleClass().add("bold");
        Label detailsLabel = mutedLabel(buildPrimaryDetails(member));

        Button activateButton = new Button("Activate");
        activateButton.setOnAction(event -> viewModel.moveToActive(member.id()));
        Button editButton = new Button("Edit");
        editButton.setOnAction(event -> PartyToolbarDialogs.showEditDialog(viewModel, member, ownerSupplier.get()));
        Button deleteButton = new Button("Delete");
        deleteButton.setOnAction(event -> PartyToolbarDialogs.confirmDelete(viewModel, member, ownerSupplier.get()));
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox actionRow = new HBox(8, activateButton, editButton, spacer, deleteButton);
        actionRow.setAlignment(Pos.CENTER_LEFT);
        return wrapCard(new VBox(6, nameLabel, detailsLabel, actionRow));
    }

    Label mutedLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        label.setWrapText(true);
        return label;
    }

    private Node wrapCard(VBox content) {
        content.setPadding(new Insets(10));
        content.getStyleClass().add("party-member-card");
        return content;
    }

    private Node buildRestChip(PartyViewData.RestStatusViewData restStatus) {
        Label chip = new Label(restStatus.label());
        chip.getStyleClass().add("party-rest-chip");
        chip.getStyleClass().add(switch (restStatus.severity()) {
            case NORMAL -> "party-rest-chip-normal";
            case SOON -> "party-rest-chip-soon";
            case OVERDUE -> "party-rest-chip-overdue";
        });
        Tooltip.install(chip, new Tooltip(restStatus.tooltip()));
        return chip;
    }

    private String buildPrimaryDetails(PartyViewData.PartyMemberViewData member) {
        String player = member.playerName().isBlank() ? "No player" : member.playerName();
        return player
                + " | Lv " + member.level()
                + " | AC " + member.armorClass()
                + " | PP " + member.passivePerception();
    }

    private String buildXpDetails(PartyViewData.PartyMemberViewData member) {
        if (member.readyToLevel()) {
            return "XP " + member.currentXp() + " | Ready to level";
        }
        return "XP " + member.currentXp() + " | " + member.xpToNextLevel() + " XP to next level";
    }
}
