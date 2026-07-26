package features.campaign.adapter.javafx;

import features.campaign.api.CampaignSnapshot;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import javafx.application.Platform;
import javafx.geometry.Pos;
import javafx.scene.AccessibleAttribute;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

/** Passive Campaign chooser and name-only creation surface. */
public final class CampaignDeskView extends StackPane {

    public interface Actions {
        void create(String name);

        void select(CampaignSnapshot campaign);

        void recover();

        void reload();
    }

    private final Actions actions;
    private final TextField name = new TextField();
    private final Button create = new Button("Kampagne erstellen");
    private final Label nameValidation = new Label(
            "Der Name braucht mindestens ein sichtbares Zeichen.");
    private final VBox currentCampaign = new VBox();
    private final VBox otherCampaigns = new VBox();
    private final Label currentEmpty = new Label("Keine aktuelle Kampagne ausgewählt.");
    private final Label empty = new Label(
            "Noch keine Kampagne. Ein Name genügt, um spielbereit zu beginnen.");
    private final Label status = new Label();
    private final Button recover = new Button("Aktuelle Kampagne erneut öffnen");
    private final Button reload = new Button("Kampagnen neu laden");
    private List<CampaignSnapshot> campaigns = List.of();
    private Optional<CampaignSnapshot> active = Optional.empty();
    private Optional<CampaignSnapshot> damaged = Optional.empty();
    private boolean busy;
    private boolean recoveryMode;
    private boolean containedTransitionMode;
    private int nameHelpNotifications;

    public CampaignDeskView(Actions actions) {
        this.actions = Objects.requireNonNull(actions, "actions");
        getStyleClass().addAll("startup-root", "campaign-desk-root");

        VBox card = new VBox();
        card.getStyleClass().addAll("startup-card", "campaign-desk-card");

        Label eyebrow = new Label("SALTMARCHER / KAMPAGNEN");
        eyebrow.getStyleClass().add("campaign-desk-eyebrow");
        Label title = new Label("Welche Spielmappe liegt heute auf dem Tisch?");
        title.getStyleClass().add("startup-title");
        title.setWrapText(true);
        Label subtitle = new Label(
                "Öffne eine Kampagne sofort oder lege mit nur einem Namen eine neue an.");
        subtitle.getStyleClass().add("startup-subtitle");
        subtitle.setWrapText(true);
        VBox header = new VBox(eyebrow, title, subtitle);
        header.getStyleClass().add("campaign-desk-header");

        Label createHeading = new Label("Neue Kampagne");
        createHeading.getStyleClass().add("campaign-desk-section-title");
        name.setPromptText("Name der Kampagne");
        name.setAccessibleText("Name der neuen Kampagne");
        name.getStyleClass().add("campaign-desk-name");
        create.getStyleClass().add("accent");
        create.setAccessibleText("Kampagne mit dem eingegebenen Namen erstellen");
        nameValidation.getStyleClass().addAll(
                "text-warning", "campaign-desk-name-validation");
        nameValidation.setWrapText(true);
        nameValidation.setAccessibleRoleDescription("Hinweis zum Kampagnennamen");
        nameValidation.setLabelFor(name);
        name.textProperty().addListener((ignored, before, after) -> updateCreationState());
        name.setOnAction(ignored -> submitName());
        create.setOnAction(ignored -> submitName());
        HBox createRow = new HBox(name, create);
        createRow.getStyleClass().add("campaign-desk-create-row");
        HBox.setHgrow(name, Priority.ALWAYS);
        VBox creation = new VBox(createHeading, createRow, nameValidation);
        creation.getStyleClass().add("campaign-desk-creation");

        Label currentHeading = new Label("Aktuelle Kampagne");
        currentHeading.getStyleClass().add("campaign-desk-section-title");
        currentCampaign.getStyleClass().add("campaign-desk-list");
        currentEmpty.getStyleClass().addAll("text-muted", "campaign-desk-empty");
        VBox currentSection = new VBox(currentHeading, currentCampaign, currentEmpty);
        currentSection.getStyleClass().add("campaign-desk-section");

        Label othersHeading = new Label("Weitere Kampagnen");
        othersHeading.getStyleClass().add("campaign-desk-section-title");
        otherCampaigns.getStyleClass().add("campaign-desk-list");
        empty.getStyleClass().addAll("text-muted", "campaign-desk-empty");
        empty.setWrapText(true);
        VBox othersSection = new VBox(othersHeading, otherCampaigns, empty);
        othersSection.getStyleClass().add("campaign-desk-section");

        VBox campaignSections = new VBox(currentSection, othersSection);
        campaignSections.getStyleClass().add("campaign-desk-sections");
        ScrollPane campaignScroll = new ScrollPane(campaignSections);
        campaignScroll.getStyleClass().add("campaign-desk-list-scroll");
        campaignScroll.setFitToWidth(true);
        campaignScroll.setPannable(true);
        campaignScroll.setFocusTraversable(true);
        campaignScroll.setAccessibleText("Aktuelle und weitere Kampagnen");
        VBox.setVgrow(campaignScroll, Priority.ALWAYS);

        status.getStyleClass().addAll("text-secondary", "campaign-desk-status");
        status.setWrapText(true);
        status.setAccessibleRoleDescription("Status der Kampagnenauswahl");
        recover.setOnAction(ignored -> actions.recover());
        reload.setOnAction(ignored -> actions.reload());
        FlowPane statusActions = new FlowPane(recover, reload);
        statusActions.getStyleClass().add("campaign-desk-status-actions");
        VBox feedback = new VBox(status, statusActions);
        feedback.getStyleClass().add("campaign-desk-feedback");

        card.getChildren().addAll(header, creation, campaignScroll, feedback);
        getChildren().add(card);
        StackPane.setAlignment(card, Pos.CENTER);
        showLoading();
    }

    public void showLoading() {
        busy = true;
        updateStatus("Kampagnen werden geladen …", false);
        recover.setManaged(false);
        recover.setVisible(false);
        reload.setManaged(false);
        reload.setVisible(false);
        renderRows();
    }

    public void showCampaigns(
            List<CampaignSnapshot> available,
            Optional<CampaignSnapshot> current,
            String announcement
    ) {
        campaigns = List.copyOf(Objects.requireNonNull(available, "available"));
        active = Objects.requireNonNull(current, "current");
        damaged = Optional.empty();
        recoveryMode = false;
        containedTransitionMode = false;
        busy = false;
        updateStatus(announcement == null ? "" : announcement, false);
        recover.setManaged(false);
        recover.setVisible(false);
        reload.setManaged(false);
        reload.setVisible(false);
        renderRows();
        Platform.runLater(() -> {
            if (campaigns.isEmpty()) {
                name.requestFocus();
            } else if (!currentCampaign.getChildren().isEmpty()) {
                currentCampaign.getChildren().getFirst().requestFocus();
            } else if (!otherCampaigns.getChildren().isEmpty()) {
                otherCampaigns.getChildren().getFirst().requestFocus();
            }
        });
    }

    public void showSwitching(String campaignName) {
        busy = true;
        updateStatus("„" + Objects.requireNonNull(campaignName, "campaignName")
                + "“ wird spielbereit gemacht …", false);
        recover.setManaged(false);
        recover.setVisible(false);
        reload.setManaged(false);
        reload.setVisible(false);
        renderRows();
    }

    public void showError(String message, boolean focusName) {
        busy = false;
        recoveryMode = false;
        containedTransitionMode = false;
        damaged = Optional.empty();
        String reason = Objects.requireNonNull(message, "message");
        updateStatus(reason, true);
        recover.setManaged(false);
        recover.setVisible(false);
        reload.setManaged(true);
        reload.setVisible(true);
        reload.setAccessibleText("Kampagnen neu laden. Grund: " + reason);
        renderRows();
        Platform.runLater(() -> (focusName ? name : reload).requestFocus());
    }

    public void showRecovery(
            String message,
            List<CampaignSnapshot> available,
            Optional<CampaignSnapshot> damagedCampaign
    ) {
        campaigns = List.copyOf(Objects.requireNonNull(available, "available"));
        damaged = Objects.requireNonNull(damagedCampaign, "damagedCampaign");
        active = damaged;
        recoveryMode = true;
        containedTransitionMode = false;
        busy = false;
        String reason = Objects.requireNonNull(message, "message");
        updateStatus(reason, true);
        recover.setManaged(true);
        recover.setVisible(true);
        recover.setText("Aktuelle Kampagne erneut öffnen");
        reload.setManaged(true);
        reload.setVisible(true);
        recover.setAccessibleText(
                "Aktuelle beschädigte Kampagne erneut öffnen. Grund: " + reason);
        reload.setAccessibleText("Kampagnen neu laden. Grund: " + reason);
        renderRows();
        Platform.runLater(recover::requestFocus);
    }

    public void showContainedTransition(
            String message,
            List<CampaignSnapshot> available,
            Optional<CampaignSnapshot> retainedCampaign
    ) {
        campaigns = List.copyOf(Objects.requireNonNull(available, "available"));
        active = Objects.requireNonNull(retainedCampaign, "retainedCampaign");
        damaged = Optional.empty();
        recoveryMode = true;
        containedTransitionMode = true;
        busy = false;
        String reason = Objects.requireNonNull(message, "message");
        updateStatus(reason, false);
        recover.setText("Kampagnenwechsel erneut prüfen");
        recover.setManaged(true);
        recover.setVisible(true);
        reload.setManaged(true);
        reload.setVisible(true);
        recover.setAccessibleText(
                "Sicheren Abschluss des Kampagnenwechsels erneut prüfen. Grund: " + reason);
        reload.setAccessibleText("Kampagnen neu laden. Grund: " + reason);
        renderRows();
        Platform.runLater(recover::requestFocus);
    }

    public void confirmCreation() {
        name.clear();
    }

    public String enteredNameForTesting() {
        return name.getText();
    }

    int nameHelpNotificationsForTesting() {
        return nameHelpNotifications;
    }

    private void submitName() {
        String entered = name.getText().trim();
        if (!busy && !recoveryMode && !entered.isBlank()) {
            actions.create(entered);
        }
    }

    private void renderRows() {
        currentCampaign.getChildren().clear();
        otherCampaigns.getChildren().clear();
        active.flatMap(current -> campaigns.stream()
                        .filter(campaign -> campaign.id().equals(current.id()))
                        .findFirst())
                .ifPresent(campaign -> currentCampaign.getChildren().add(row(campaign, true)));

        List<CampaignSnapshot> others = new ArrayList<>();
        for (CampaignSnapshot campaign : campaigns) {
            if (active.isEmpty() || !campaign.id().equals(active.orElseThrow().id())) {
                others.add(campaign);
            }
        }
        others.forEach(campaign -> otherCampaigns.getChildren().add(row(campaign, false)));
        boolean noCurrentCampaign = currentCampaign.getChildren().isEmpty();
        currentEmpty.setManaged(noCurrentCampaign);
        currentEmpty.setVisible(noCurrentCampaign);
        boolean noOtherCampaigns = otherCampaigns.getChildren().isEmpty();
        empty.setText(campaigns.isEmpty()
                ? "Noch keine Kampagne. Ein Name genügt, um spielbereit zu beginnen."
                : "Keine weiteren Kampagnen.");
        empty.setManaged(noOtherCampaigns);
        empty.setVisible(noOtherCampaigns);
        updateCreationState();
        for (javafx.scene.Node child : currentCampaign.getChildren()) {
            if (!child.getStyleClass().contains("campaign-desk-row-damaged")) {
                child.setDisable(busy);
            }
        }
        for (javafx.scene.Node child : otherCampaigns.getChildren()) {
            child.setDisable(busy);
        }
    }

    private Button row(CampaignSnapshot campaign, boolean current) {
        boolean isDamaged = damaged.filter(candidate -> candidate.id().equals(campaign.id()))
                .isPresent();
        Label rowName = new Label(campaign.name());
        rowName.getStyleClass().add("campaign-desk-row-name");
        String actionText;
        if (isDamaged) {
            actionText = "Beschädigt · Daten bleiben unverändert";
        } else if (containedTransitionMode && current) {
            actionText = "Aktuell · Wechsel wird sicher beendet";
        } else if (current) {
            actionText = "Aktuell · Fortsetzen";
        } else {
            actionText = recoveryMode ? "Stattdessen öffnen" : "Sofort wechseln";
        }
        Label action = new Label(actionText);
        action.getStyleClass().add("campaign-desk-row-meta");
        VBox content = new VBox(rowName, action);
        content.getStyleClass().add("campaign-desk-row-content");
        Button row = new Button();
        row.setGraphic(content);
        row.getStyleClass().add("campaign-desk-row");
        if (current) {
            row.getStyleClass().add("campaign-desk-row-current");
        }
        if (isDamaged) {
            row.getStyleClass().add("campaign-desk-row-damaged");
            row.setAccessibleText("Beschädigte aktuelle Kampagne " + campaign.name()
                    + ". Nicht öffnen; Daten bleiben unverändert.");
            row.setDisable(true);
        } else if (containedTransitionMode && current) {
            row.setAccessibleText("Gesunde aktuelle Kampagne " + campaign.name()
                    + ". Wechsel sicher beenden oder erneut prüfen");
        } else if (current) {
            row.setAccessibleText("Aktuelle Kampagne " + campaign.name() + ". Fortsetzen");
        } else {
            row.setAccessibleText((recoveryMode
                    ? "Gesunde Kampagne stattdessen öffnen: "
                    : "Zur Kampagne wechseln: ") + campaign.name());
        }
        row.setOnAction(ignored -> {
            if (containedTransitionMode && current) {
                actions.recover();
            } else {
                actions.select(campaign);
            }
        });
        if (!isDamaged) {
            row.setDisable(busy);
        }
        return row;
    }

    private void updateCreationState() {
        boolean visiblyBlank = name.getText().isBlank();
        boolean invalidVisibleInput = !name.getText().isEmpty() && visiblyBlank;
        nameValidation.setManaged(invalidVisibleInput);
        nameValidation.setVisible(invalidVisibleInput);
        nameValidation.setAccessibleText(invalidVisibleInput
                ? nameValidation.getText() : "");
        String accessibleHelp = invalidVisibleInput ? nameValidation.getText() : null;
        if (!Objects.equals(name.getAccessibleHelp(), accessibleHelp)) {
            name.setAccessibleHelp(accessibleHelp);
            name.notifyAccessibleAttributeChanged(AccessibleAttribute.HELP);
            nameHelpNotifications++;
        }
        name.setDisable(busy || recoveryMode);
        create.setDisable(busy || recoveryMode || visiblyBlank);
    }

    private void updateStatus(String message, boolean warning) {
        status.setText(message);
        status.setAccessibleText(message);
        if (warning && !status.getStyleClass().contains("text-warning")) {
            status.getStyleClass().add("text-warning");
        } else if (!warning) {
            status.getStyleClass().remove("text-warning");
        }
        status.notifyAccessibleAttributeChanged(javafx.scene.AccessibleAttribute.TEXT);
    }

}
