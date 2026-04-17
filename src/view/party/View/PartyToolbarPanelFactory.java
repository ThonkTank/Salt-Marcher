package src.view.party.View;

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
import src.view.party.Controller.PartyController;
import src.view.party.Model.PartyToolbarModel;

final class PartyToolbarPanelFactory {

    Node build(
            PartyToolbarPanelParts parts,
            PartyToolbarModel model,
            PartyController controller,
            Runnable closePopup,
            Runnable showCreateDialog
    ) {
        VBox panel = new VBox(10);
        panel.setPadding(new Insets(12));
        panel.setPrefWidth(440);
        panel.setMaxWidth(440);
        panel.getStyleClass().add("party-toolbar-panel");
        panel.getChildren().addAll(
                buildHeader(closePopup),
                buildProgressRow(model, parts.budgetProgressBar(), parts.budgetPercentLabel()),
                buildSectionTitle("Active Party"),
                parts.activeMembersBox(),
                buildRestActions(model, controller),
                new Separator(),
                buildReserveHeader(showCreateDialog),
                parts.reserveSearchField(),
                parts.reserveMembersBox(),
                new Separator(),
                parts.summaryLabel(),
                parts.daySummaryLabel(),
                parts.statusLabel()
        );
        return panel;
    }

    private HBox buildHeader(Runnable closePopup) {
        Label titleLabel = new Label("Party Management");
        titleLabel.getStyleClass().add("party-toolbar-title");
        Button closeButton = new Button("Close");
        closeButton.setOnAction(event -> closePopup.run());
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox header = new HBox(8, titleLabel, spacer, closeButton);
        header.setAlignment(Pos.CENTER_LEFT);
        return header;
    }

    private HBox buildProgressRow(PartyToolbarModel model, ProgressBar budgetProgressBar, Label budgetPercentLabel) {
        HBox progressRow = new HBox(10, budgetProgressBar, budgetPercentLabel);
        progressRow.setAlignment(Pos.CENTER_LEFT);
        HBox.setHgrow(budgetProgressBar, Priority.ALWAYS);
        progressRow.visibleProperty().bind(model.budget().budgetVisibleProperty());
        progressRow.managedProperty().bind(model.budget().budgetVisibleProperty());
        return progressRow;
    }

    private Label buildSectionTitle(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("bold");
        return label;
    }

    private HBox buildRestActions(PartyToolbarModel model, PartyController controller) {
        Button shortRestButton = new Button("Short Rest");
        shortRestButton.disableProperty().bind(model.restControls().shortRestDisabledProperty());
        shortRestButton.setOnAction(event -> controller.performShortRest());
        Button longRestButton = new Button("Long Rest");
        longRestButton.disableProperty().bind(model.restControls().longRestDisabledProperty());
        longRestButton.setOnAction(event -> controller.performLongRest());
        return new HBox(8, shortRestButton, longRestButton);
    }

    private HBox buildReserveHeader(Runnable showCreateDialog) {
        Label reserveLabel = buildSectionTitle("Reserve");
        Button createButton = new Button("New Character");
        createButton.setOnAction(event -> showCreateDialog.run());
        Region reserveSpacer = new Region();
        HBox.setHgrow(reserveSpacer, Priority.ALWAYS);
        HBox reserveHeader = new HBox(8, reserveLabel, reserveSpacer, createButton);
        reserveHeader.setAlignment(Pos.CENTER_LEFT);
        return reserveHeader;
    }
}
