package src.view.party.View;

import org.jspecify.annotations.Nullable;
import javafx.beans.InvalidationListener;
import javafx.geometry.Bounds;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import javafx.stage.Window;
import src.view.party.Controller.PartyController;
import src.view.party.Model.PartyToolbarModel;
import src.view.party.interactor.PartyInteractor;

import java.util.Locale;
import java.util.Objects;

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
    private final Label budgetPercentLabel = new Label();
    private final ProgressBar budgetProgressBar = new ProgressBar(0.0);
    private final Label statusLabel = new Label();
    private final PartyToolbarPanelFactory panelFactory = new PartyToolbarPanelFactory();
    private final PartyMemberCardFactory cardFactory = new PartyMemberCardFactory();

    public PartyToolbarView(PartyToolbarModel model, PartyController controller) {
        this.model = Objects.requireNonNull(model, "model");
        this.controller = Objects.requireNonNull(controller, "controller");
        configurePopup();
        bindModelState();
        configureMemberLists();
    }

    private void configurePopup() {
        triggerButton.textProperty().bind(model.display().triggerTextProperty());
        triggerButton.setOnAction(event -> togglePopup());

        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        popup.getContent().add(panelFactory.build(
                new PartyToolbarPanelParts(
                        activeMembersBox,
                        reserveMembersBox,
                        reserveSearchField,
                        summaryLabel,
                        daySummaryLabel,
                        statusLabel,
                        budgetProgressBar,
                        budgetPercentLabel),
                model,
                controller,
                popup::hide,
                () -> PartyToolbarDialogs.showCreateDialog(controller, ownerWindow())));
    }

    private void bindModelState() {
        summaryLabel.textProperty().bind(model.display().summaryTextProperty());
        summaryLabel.setWrapText(true);
        daySummaryLabel.textProperty().bind(model.display().daySummaryTextProperty());
        daySummaryLabel.setWrapText(true);
        daySummaryLabel.getStyleClass().add("text-muted");
        budgetPercentLabel.textProperty().bind(model.budget().budgetPercentTextProperty());
        budgetPercentLabel.getStyleClass().add("party-day-progress-label");
        budgetProgressBar.progressProperty().bind(model.budget().budgetProgressProperty());
        budgetProgressBar.getStyleClass().add("party-day-progress");
        statusLabel.textProperty().bind(model.status().statusTextProperty());
        statusLabel.getStyleClass().add("status-label");
        statusLabel.visibleProperty().bind(model.status().statusVisibleProperty());
        statusLabel.managedProperty().bind(model.status().statusVisibleProperty());
        model.status().statusErrorProperty().addListener((obs, oldValue, newValue) -> updateStatusStyle());
        updateStatusStyle();
    }

    private void configureMemberLists() {
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
            activeMembersBox.getChildren().add(cardFactory.mutedLabel("No active party members."));
            return;
        }
        for (PartyInteractor.PartyMemberViewData member : model.activeMembers()) {
            activeMembersBox.getChildren().add(cardFactory.buildActiveMemberRow(member, controller));
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
            reserveMembersBox.getChildren().add(cardFactory.mutedLabel(
                    model.reserveMembers().isEmpty() ? "No reserve characters." : "No reserve characters match the filter."));
            return;
        }
        for (PartyInteractor.PartyMemberViewData member : filteredMembers) {
            reserveMembersBox.getChildren().add(cardFactory.buildReserveMemberRow(member, controller));
        }
    }

    private @Nullable Window ownerWindow() {
        return triggerButton.getScene() == null ? null : triggerButton.getScene().getWindow();
    }

    private void updateStatusStyle() {
        statusLabel.getStyleClass().removeAll("status-label-error", "status-label-success");
        statusLabel.getStyleClass().add(model.status().statusErrorProperty().get()
                ? "status-label-error"
                : "status-label-success");
    }
}
