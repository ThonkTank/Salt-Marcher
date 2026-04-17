package src.view.party.View;

import javafx.beans.InvalidationListener;
import javafx.geometry.Bounds;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonType;
import javafx.scene.control.Label;
import javafx.scene.control.Separator;
import javafx.scene.control.TextField;
import javafx.scene.control.TextInputDialog;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import javafx.stage.Window;
import src.view.party.Controller.PartyController;
import src.view.party.Model.PartyToolbarModel;
import src.view.party.interactor.PartyInteractor;

import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

public final class PartyToolbarView {

    private final PartyToolbarModel model;
    private final PartyController controller;
    private final Button triggerButton = new Button();
    private final Popup popup = new Popup();
    private final VBox activeMembersBox = new VBox(8);
    private final VBox reserveMembersBox = new VBox(8);
    private final TextField reserveSearchField = new TextField();
    private final Label summaryLabel = new Label();
    private final Label daySummaryLabel = new Label();
    private final Label statusLabel = new Label();

    public PartyToolbarView(PartyToolbarModel model, PartyController controller) {
        this.model = Objects.requireNonNull(model, "model");
        this.controller = Objects.requireNonNull(controller, "controller");

        triggerButton.textProperty().bind(model.triggerTextProperty());
        triggerButton.setOnAction(event -> togglePopup());

        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        popup.getContent().add(buildPanel());

        summaryLabel.textProperty().bind(model.summaryTextProperty());
        summaryLabel.setWrapText(true);
        daySummaryLabel.textProperty().bind(model.daySummaryTextProperty());
        daySummaryLabel.setWrapText(true);
        daySummaryLabel.getStyleClass().add("text-muted");
        statusLabel.textProperty().bind(model.statusTextProperty());
        statusLabel.visibleProperty().bind(model.statusVisibleProperty());
        statusLabel.managedProperty().bind(model.statusVisibleProperty());
        model.statusErrorProperty().addListener((obs, oldValue, newValue) -> updateStatusStyle());
        updateStatusStyle();

        reserveSearchField.setPromptText("Filter reserve...");
        reserveSearchField.textProperty().addListener((obs, oldValue, newValue) -> rebuildReserveMembers());

        InvalidationListener activeListener = observable -> rebuildActiveMembers();
        InvalidationListener reserveListener = observable -> rebuildReserveMembers();
        model.activeMembers().addListener(activeListener);
        model.reserveMembers().addListener(reserveListener);
        rebuildActiveMembers();
        rebuildReserveMembers();
    }

    public Node node() {
        return triggerButton;
    }

    private Node buildPanel() {
        VBox panel = new VBox(10);
        panel.setPadding(new Insets(12));
        panel.setPrefWidth(440);
        panel.setMaxWidth(440);
        panel.setStyle("-fx-background-color: -fx-base; -fx-border-color: -fx-box-border; -fx-border-radius: 6; -fx-background-radius: 6;");

        Label titleLabel = new Label("Party Management");
        titleLabel.setStyle("-fx-font-size: 15px; -fx-font-weight: bold;");
        Button closeButton = new Button("Close");
        closeButton.setOnAction(event -> popup.hide());
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox header = new HBox(8, titleLabel, spacer, closeButton);
        header.setAlignment(Pos.CENTER_LEFT);

        Label activeLabel = new Label("Active Party");
        activeLabel.setStyle("-fx-font-weight: bold;");

        Button shortRestButton = new Button("Short Rest");
        shortRestButton.disableProperty().bind(model.shortRestDisabledProperty());
        shortRestButton.setOnAction(event -> controller.performShortRest());
        Button longRestButton = new Button("Long Rest");
        longRestButton.disableProperty().bind(model.longRestDisabledProperty());
        longRestButton.setOnAction(event -> controller.performLongRest());
        HBox restActions = new HBox(8, shortRestButton, longRestButton);

        Label reserveLabel = new Label("Reserve");
        reserveLabel.setStyle("-fx-font-weight: bold;");
        Button createButton = new Button("New Character");
        createButton.setOnAction(event -> showCreateDialog());
        Region reserveSpacer = new Region();
        HBox.setHgrow(reserveSpacer, Priority.ALWAYS);
        HBox reserveHeader = new HBox(8, reserveLabel, reserveSpacer, createButton);
        reserveHeader.setAlignment(Pos.CENTER_LEFT);

        panel.getChildren().addAll(
                header,
                activeLabel,
                activeMembersBox,
                restActions,
                new Separator(),
                reserveHeader,
                reserveSearchField,
                reserveMembersBox,
                new Separator(),
                summaryLabel,
                daySummaryLabel,
                statusLabel
        );
        return panel;
    }

    private void togglePopup() {
        if (popup.isShowing()) {
            popup.hide();
            return;
        }
        controller.onPopupOpened();
        showPopup();
    }

    private void showPopup() {
        if (triggerButton.getScene() == null || triggerButton.getScene().getWindow() == null) {
            return;
        }
        triggerButton.applyCss();
        triggerButton.layout();
        Bounds bounds = triggerButton.localToScreen(triggerButton.getBoundsInLocal());
        if (bounds == null) {
            return;
        }
        double popupWidth = 440;
        double anchorX = Math.max(24.0, bounds.getMaxX() - popupWidth);
        popup.show(triggerButton.getScene().getWindow(), anchorX, bounds.getMaxY() + 2.0);
    }

    private void rebuildActiveMembers() {
        activeMembersBox.getChildren().clear();
        if (model.activeMembers().isEmpty()) {
            activeMembersBox.getChildren().add(mutedLabel("No active party members."));
            return;
        }
        for (PartyInteractor.PartyMemberViewData member : model.activeMembers()) {
            activeMembersBox.getChildren().add(buildActiveMemberRow(member));
        }
    }

    private void rebuildReserveMembers() {
        reserveMembersBox.getChildren().clear();
        String filter = reserveSearchField.getText() == null ? "" : reserveSearchField.getText().trim().toLowerCase(Locale.ROOT);
        var filteredMembers = model.reserveMembers().stream()
                .filter(member -> filter.isEmpty()
                        || member.name().toLowerCase(Locale.ROOT).contains(filter)
                        || member.playerName().toLowerCase(Locale.ROOT).contains(filter))
                .toList();
        if (filteredMembers.isEmpty()) {
            reserveMembersBox.getChildren().add(mutedLabel(
                    model.reserveMembers().isEmpty() ? "No reserve characters." : "No reserve characters match the filter."));
            return;
        }
        for (PartyInteractor.PartyMemberViewData member : filteredMembers) {
            reserveMembersBox.getChildren().add(buildReserveMemberRow(member));
        }
    }

    private Node buildActiveMemberRow(PartyInteractor.PartyMemberViewData member) {
        Label nameLabel = new Label(member.name());
        nameLabel.setStyle("-fx-font-weight: bold;");
        Label detailsLabel = new Label(buildPrimaryDetails(member));
        detailsLabel.setWrapText(true);
        detailsLabel.getStyleClass().add("text-muted");
        Label xpLabel = new Label(buildXpDetails(member));
        xpLabel.setWrapText(true);

        Button xpButton = new Button("Award XP");
        xpButton.setOnAction(event -> promptForXp(member));
        Button editButton = new Button("Edit");
        editButton.setOnAction(event -> showEditDialog(member));
        Button reserveButton = new Button("Reserve");
        reserveButton.setOnAction(event -> controller.moveToReserve(member.id()));
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox actionRow = new HBox(8, xpButton, editButton, spacer, reserveButton);
        actionRow.setAlignment(Pos.CENTER_LEFT);

        VBox card = new VBox(6, nameLabel, detailsLabel, xpLabel, actionRow);
        return wrapCard(card);
    }

    private Node buildReserveMemberRow(PartyInteractor.PartyMemberViewData member) {
        Label nameLabel = new Label(member.name());
        nameLabel.setStyle("-fx-font-weight: bold;");
        Label detailsLabel = new Label(buildPrimaryDetails(member));
        detailsLabel.setWrapText(true);
        detailsLabel.getStyleClass().add("text-muted");

        Button activateButton = new Button("Activate");
        activateButton.setOnAction(event -> controller.moveToActive(member.id()));
        Button editButton = new Button("Edit");
        editButton.setOnAction(event -> showEditDialog(member));
        Button deleteButton = new Button("Delete");
        deleteButton.setOnAction(event -> confirmDelete(member));
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox actionRow = new HBox(8, activateButton, editButton, spacer, deleteButton);
        actionRow.setAlignment(Pos.CENTER_LEFT);

        VBox card = new VBox(6, nameLabel, detailsLabel, actionRow);
        return wrapCard(card);
    }

    private Node wrapCard(VBox content) {
        content.setPadding(new Insets(10));
        content.setStyle("-fx-background-color: derive(-fx-base, 8%); -fx-border-color: -fx-box-border; -fx-border-radius: 4; -fx-background-radius: 4;");
        return content;
    }

    private Label mutedLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        label.setWrapText(true);
        return label;
    }

    private String buildPrimaryDetails(PartyInteractor.PartyMemberViewData member) {
        String player = member.playerName().isBlank() ? "No player" : member.playerName();
        return player
                + " | Lv " + member.level()
                + " | AC " + member.armorClass()
                + " | PP " + member.passivePerception();
    }

    private String buildXpDetails(PartyInteractor.PartyMemberViewData member) {
        if (member.readyToLevel()) {
            return "XP " + member.currentXp() + " | Ready to level";
        }
        return "XP " + member.currentXp() + " | " + member.xpToNextLevel() + " XP to next level";
    }

    private void showCreateDialog() {
        Optional<PartyCharacterEditorDialog.CreateRequest> request =
                PartyCharacterEditorDialog.showCreate(ownerWindow());
        request.ifPresent(value -> controller.createCharacter(value.draft(), value.membership()));
    }

    private void showEditDialog(PartyInteractor.PartyMemberViewData member) {
        Optional<PartyInteractor.CharacterDraftInput> draft = PartyCharacterEditorDialog.showEdit(ownerWindow(), member);
        draft.ifPresent(value -> controller.updateCharacter(member.id(), value));
    }

    private void confirmDelete(PartyInteractor.PartyMemberViewData member) {
        Alert alert = new Alert(Alert.AlertType.CONFIRMATION,
                "Delete \"" + member.name() + "\"?",
                ButtonType.OK,
                ButtonType.CANCEL);
        if (ownerWindow() != null) {
            alert.initOwner(ownerWindow());
        }
        alert.setHeaderText("Delete character");
        if (alert.showAndWait().orElse(ButtonType.CANCEL) == ButtonType.OK) {
            controller.deleteCharacter(member.id());
        }
    }

    private void promptForXp(PartyInteractor.PartyMemberViewData member) {
        TextInputDialog dialog = new TextInputDialog();
        dialog.setTitle("Award XP");
        dialog.setHeaderText("Award XP to " + member.name());
        dialog.setContentText("XP amount:");
        if (ownerWindow() != null) {
            dialog.initOwner(ownerWindow());
        }
        Optional<String> rawValue = dialog.showAndWait();
        if (rawValue.isEmpty()) {
            return;
        }
        try {
            int xpAmount = Integer.parseInt(rawValue.get().trim());
            controller.awardXp(member.id(), xpAmount);
        } catch (NumberFormatException exception) {
            model.showStatus("XP must be a number.", true);
        }
    }

    private Window ownerWindow() {
        return triggerButton.getScene() == null ? null : triggerButton.getScene().getWindow();
    }

    private void updateStatusStyle() {
        statusLabel.setStyle(model.statusErrorProperty().get()
                ? "-fx-text-fill: #9a1b1b;"
                : "-fx-text-fill: #205d20;");
    }
}
