package src.view.party.View;

import javafx.geometry.Bounds;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.Separator;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import javafx.stage.Window;
import org.jspecify.annotations.Nullable;
import src.view.party.ViewModel.PartyToolbarSnapshot;
import src.view.party.ViewModel.PartyToolbarViewModel;

import java.util.Objects;

public final class PartyToolbarView {

    private final PartyToolbarViewModel viewModel;
    private final PartyToolbarMemberListRenderer memberListRenderer;
    private final Button triggerButton = new Button();
    private final Popup popup = new Popup();
    private final Label summaryLabel = new Label();
    private final Label daySummaryLabel = new Label();
    private final Label budgetPercentLabel = new Label();
    private final ProgressBar budgetProgressBar = new ProgressBar(0.0);
    private final Label statusLabel = new Label();
    private final Button shortRestButton = new Button("Short Rest");
    private final Button longRestButton = new Button("Long Rest");
    private final HBox budgetRow = new HBox(10, budgetProgressBar, budgetPercentLabel);

    public PartyToolbarView(PartyToolbarViewModel viewModel) {
        this.viewModel = Objects.requireNonNull(viewModel, "viewModel");
        this.memberListRenderer = new PartyToolbarMemberListRenderer(this.viewModel, this::ownerWindow);
        configurePopup();
        this.viewModel.addChangeListener(this::refreshFromViewModel);
        refreshFromViewModel();
    }

    private void configurePopup() {
        triggerButton.setOnAction(event -> togglePopup());

        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        popup.getContent().add(buildPanel());

        summaryLabel.setWrapText(true);
        daySummaryLabel.setWrapText(true);
        daySummaryLabel.getStyleClass().add("text-muted");
        budgetPercentLabel.getStyleClass().add("party-day-progress-label");
        budgetProgressBar.getStyleClass().add("party-day-progress");
        statusLabel.getStyleClass().add("status-label");
        budgetRow.setAlignment(Pos.CENTER_LEFT);
        HBox.setHgrow(budgetProgressBar, Priority.ALWAYS);
    }

    public Node node() {
        return triggerButton;
    }

    private void togglePopup() {
        if (popup.isShowing()) {
            popup.hide();
            return;
        }
        viewModel.onPopupOpened();
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

    private Node buildPanel() {
        VBox panel = new VBox(10);
        panel.setPadding(new Insets(12));
        panel.setPrefWidth(440);
        panel.setMaxWidth(440);
        panel.getStyleClass().add("party-toolbar-panel");

        Label titleLabel = new Label("Party Management");
        titleLabel.getStyleClass().add("party-toolbar-title");
        Button closeButton = new Button("Close");
        closeButton.setOnAction(event -> popup.hide());
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox header = new HBox(8, titleLabel, spacer, closeButton);
        header.setAlignment(Pos.CENTER_LEFT);

        Label activeLabel = new Label("Active Party");
        activeLabel.getStyleClass().add("bold");

        shortRestButton.setOnAction(event -> viewModel.performShortRest());
        longRestButton.setOnAction(event -> viewModel.performLongRest());
        HBox restActions = new HBox(8, shortRestButton, longRestButton);

        Label reserveLabel = new Label("Reserve");
        reserveLabel.getStyleClass().add("bold");
        Button createButton = new Button("New Character");
        createButton.setOnAction(event -> PartyToolbarDialogs.showCreateDialog(viewModel, ownerWindow()));
        Region reserveSpacer = new Region();
        HBox.setHgrow(reserveSpacer, Priority.ALWAYS);
        HBox reserveHeader = new HBox(8, reserveLabel, reserveSpacer, createButton);
        reserveHeader.setAlignment(Pos.CENTER_LEFT);

        panel.getChildren().addAll(
                header,
                budgetRow,
                activeLabel,
                memberListRenderer.activeMembers(),
                restActions,
                new Separator(),
                reserveHeader,
                memberListRenderer.reserveSearch(),
                memberListRenderer.reserveMembers(),
                new Separator(),
                summaryLabel,
                daySummaryLabel,
                statusLabel);
        return panel;
    }

    private @Nullable Window ownerWindow() {
        return triggerButton.getScene() == null ? null : triggerButton.getScene().getWindow();
    }

    private void refreshFromViewModel() {
        PartyToolbarSnapshot snapshot = viewModel.snapshot();
        triggerButton.setText(snapshot.display().triggerText());
        summaryLabel.setText(snapshot.display().summaryText());
        daySummaryLabel.setText(snapshot.display().daySummaryText());
        budgetPercentLabel.setText(snapshot.budget().budgetPercentText());
        budgetProgressBar.setProgress(snapshot.budget().budgetProgress());
        budgetRow.setVisible(snapshot.budget().budgetVisible());
        budgetRow.setManaged(snapshot.budget().budgetVisible());
        shortRestButton.setDisable(snapshot.restControls().shortRestDisabled());
        longRestButton.setDisable(snapshot.restControls().longRestDisabled());
        statusLabel.setText(snapshot.status().text());
        statusLabel.setVisible(snapshot.status().visible());
        statusLabel.setManaged(snapshot.status().visible());
        PartyToolbarStatusStyle.apply(statusLabel, snapshot.status());
        memberListRenderer.refresh();
    }
}
