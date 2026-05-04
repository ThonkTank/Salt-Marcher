package src.view.statetabs.encounter;

import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView.BodyPolicy;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView.PopupAction;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView.PopupSpec;

public final class EncounterCombatStateView extends VBox {

    private final Label combatRoundLabel = new Label();
    private final Label combatStatusLabel = new Label();
    private final VBox combatCardList = new VBox(6);
    private final HBox endCombatContainer = new HBox(6);
    private final DialogSurfaceView dialog = buildPane();
    private Consumer<EncounterCombatStateViewInputEvent> viewInputEventHandler = ignored -> { };

    public EncounterCombatStateView() {
        getChildren().add(dialog);
        VBox.setVgrow(dialog, Priority.ALWAYS);
    }

    public void onViewInputEvent(Consumer<EncounterCombatStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void showCombat(EncounterStateView.CombatStateView state) {
        EncounterStateView.CombatStateView safeState = state == null
                ? new EncounterStateView.CombatStateView(0, "", List.of(), false, List.of())
                : state;
        combatRoundLabel.setText("Runde " + safeState.round());
        combatStatusLabel.setText(safeState.status());
        Node addPartyNode = dialog.lookup("#encounter-add-party-button");
        if (addPartyNode instanceof PartyMemberButton addPartyButton) {
            addPartyButton.updateCandidates(safeState.missingPartyMembers());
            addPartyButton.onPartyMemberSelected((memberId, initiative) -> publish(
                    false,
                    "",
                    0,
                    false,
                    false,
                    initiative,
                    memberId,
                    false));
        }
        combatCardList.getChildren().clear();
        for (EncounterStateView.CombatCardView card : safeState.cards()) {
            combatCardList.getChildren().add(buildCombatCard(card));
        }
        showNormalEndButton(safeState.allEnemiesDefeated());
    }

    private DialogSurfaceView buildPane() {
        DialogSurfaceView nextDialog = new DialogSurfaceView();
        combatRoundLabel.getStyleClass().add("title");
        combatStatusLabel.getStyleClass().add("text-secondary");

        PartyMemberButton addPartyButton = new PartyMemberButton();
        HBox actions = new HBox(addPartyButton);
        actions.setAlignment(Pos.CENTER_RIGHT);

        combatCardList.setPadding(DialogSurfaceView.contentInsets());

        Button nextTurnButton = new Button("\u25B6 _Weiter");
        nextTurnButton.getStyleClass().add("accent");
        nextTurnButton.setMaxWidth(Double.MAX_VALUE);
        nextTurnButton.setOnAction(event -> publish(true, "", 0, false, false, 0, 0L, false));
        endCombatContainer.setAlignment(Pos.CENTER);
        DialogSurfaceView.grow(nextTurnButton);
        DialogSurfaceView.grow(endCombatContainer);
        nextDialog.setHeader(combatRoundLabel, combatStatusLabel, actions);
        nextDialog.setBody(combatCardList, BodyPolicy.SCROLL);
        nextDialog.setFooter(nextTurnButton, endCombatContainer);
        return nextDialog;
    }

    private Node buildCombatCard(EncounterStateView.CombatCardView card) {
        VBox root = new VBox(4);
        root.getStyleClass().add("combat-card");
        if (card.active()) {
            root.getStyleClass().add("combat-card-active");
        } else if (!card.alive()) {
            root.getStyleClass().add("combat-card-dead");
        } else if (card.playerCharacter()) {
            root.getStyleClass().add("combat-card-pc");
        }

        HBox top = new HBox(8);
        top.setAlignment(Pos.CENTER_LEFT);
        Label turn = new Label(card.active() ? "\u25B6" : "");
        if (card.active()) {
            turn.getStyleClass().add("combat-turn-indicator");
        } else {
            turn.getStyleClass().add("combat-turn-indicator-inactive");
        }
        Label name = new Label(card.alive() ? card.name() : "\u2020 " + card.name());
        name.getStyleClass().add("combat-name");
        if (!card.alive()) {
            name.getStyleClass().add("combat-name-dead");
        }
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        top.getChildren().addAll(turn, name, spacer);
        if (!card.playerCharacter()) {
            Node hp = hpBar(card);
            if (card.count() > 1) {
                Label count = new Label("x" + card.count());
                count.getStyleClass().add("ac-badge");
                top.getChildren().add(count);
            }
            Label ac = new Label("AC " + card.armorClass());
            ac.getStyleClass().add("ac-badge");
            top.getChildren().addAll(hp, ac);
        }
        Button init = new Button("Init " + card.initiative());
        init.getStyleClass().addAll("compact", "init-badge");
        init.setOnAction(event -> showInitiativePopup(init, card));
        top.getChildren().add(init);

        Label detail = new Label(card.detail());
        detail.getStyleClass().add("combat-detail");
        detail.setWrapText(true);
        root.getChildren().addAll(top, detail);
        return root;
    }

    private Node hpBar(EncounterStateView.CombatCardView card) {
        double fraction = card.maxHp() > 0 ? Math.max(0.0, Math.min(1.0, (double) card.currentHp() / card.maxHp())) : 0.0;
        return new ProgressMeterView(
                fraction,
                (fraction <= 0.25 ? "! " : "") + card.currentHp() + " / " + card.maxHp(),
                card.name() + " HP " + card.currentHp() + "/" + card.maxHp(),
                hpFillStyle(fraction),
                "progress-meter-combat",
                new PopupSpec(
                        "HP bearbeiten",
                        1,
                        List.of(
                                new PopupAction(
                                        "-",
                                        "",
                                        true,
                                        amount -> publish(
                                                false,
                                                card.id(),
                                                amount,
                                                false,
                                                false,
                                                0,
                                                0L,
                                                false)),
                                new PopupAction(
                                        "+",
                                        "",
                                        false,
                                        amount -> publish(
                                                false,
                                                card.id(),
                                                amount,
                                                true,
                                                false,
                                                0,
                                                0L,
                                                false)))));
    }

    private void showInitiativePopup(Node anchor, EncounterStateView.CombatCardView card) {
        AnchoredPopupView popup = new AnchoredPopupView();
        TextField field = popupNumberField(String.valueOf(card.initiative()));
        Button down = popupButton("\u25BC");
        Button up = popupButton("\u25B2");
        down.setOnAction(event -> field.setText(String.valueOf(parse(field.getText(), card.initiative()) - 1)));
        up.setOnAction(event -> field.setText(String.valueOf(parse(field.getText(), card.initiative()) + 1)));
        Button set = new Button("\u2713 Setzen");
        set.getStyleClass().add("accent");
        set.setDefaultButton(true);
        set.setOnAction(event -> {
            popup.hide();
            publish(
                    false,
                    card.id(),
                    0,
                    false,
                    true,
                    parse(field.getText(), card.initiative()),
                    0L,
                    false);
        });
        field.setOnAction(event -> set.fire());
        showPopup(anchor, popup, field, down, field, up, set);
    }

    private void showPopup(Node anchor, AnchoredPopupView popup, TextField focus, Node... nodes) {
        HBox content = new HBox(4);
        content.getStyleClass().add("anchored-popup");
        content.setAlignment(Pos.CENTER_LEFT);
        content.getChildren().addAll(nodes);
        popup.setContent(content);
        popup.showBelow(anchor, 8);
        popup.focusAfterShown(focus);
    }

    private TextField popupNumberField(String initial) {
        TextField field = new TextField(initial);
        field.getStyleClass().add("text-field");
        field.setPrefWidth(56);
        field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9-]*") ? change : null));
        return field;
    }

    private Button popupButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("spinner-btn");
        button.setFocusTraversable(false);
        return button;
    }

    private void showNormalEndButton(boolean allEnemiesDefeated) {
        endCombatContainer.getChildren().clear();
        Button end = new Button("_Kampf beenden");
        if (allEnemiesDefeated) {
            end.getStyleClass().add("accent");
        }
        end.setMaxWidth(Double.MAX_VALUE);
        end.setOnAction(event -> showConfirmEndButtons(allEnemiesDefeated));
        HBox.setHgrow(end, Priority.ALWAYS);
        endCombatContainer.getChildren().add(end);
    }

    private void showConfirmEndButtons(boolean allEnemiesDefeated) {
        endCombatContainer.getChildren().clear();
        Button cancel = new Button("Abbruch");
        Button confirm = new Button("_Bestätigen!");
        if (allEnemiesDefeated) {
            confirm.getStyleClass().add("accent");
        }
        cancel.setMaxWidth(Double.MAX_VALUE);
        confirm.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(cancel, Priority.ALWAYS);
        HBox.setHgrow(confirm, Priority.ALWAYS);
        cancel.setOnAction(event -> showNormalEndButton(allEnemiesDefeated));
        confirm.setOnAction(event -> publish(false, "", 0, false, false, 0, 0L, true));
        endCombatContainer.getChildren().addAll(cancel, confirm);
    }

    private void publish(
            boolean nextTurnRequested,
            String combatantId,
            int hpDelta,
            boolean healing,
            boolean initiativeChangeRequested,
            int initiativeValue,
            long partyMemberId,
            boolean endCombatRequested
    ) {
        viewInputEventHandler.accept(new EncounterCombatStateViewInputEvent(
                nextTurnRequested,
                combatantId,
                hpDelta,
                healing,
                initiativeChangeRequested,
                initiativeValue,
                partyMemberId,
                endCombatRequested));
    }

    private int parse(String text, int fallback) {
        try {
            return Integer.parseInt(text.trim());
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }

    private static String hpFillStyle(double fraction) {
        if (fraction > 0.5) {
            return "hp-fill-healthy";
        }
        if (fraction > 0.25) {
            return "hp-fill-wounded";
        }
        return "hp-fill-critical";
    }

    @FunctionalInterface
    private interface PartyMemberSelectionListener {
        void onPartyMemberSelected(long memberId, int initiative);
    }

    private static final class PartyMemberButton extends Button {

        private static final String CONTROL_ID = "encounter-add-party-button";

        private final PartyMemberPopup popup = new PartyMemberPopup();
        private List<EncounterStateView.PartyMemberCandidate> candidates = List.of();
        private PartyMemberSelectionListener selectionListener = (memberId, initiative) -> { };

        private PartyMemberButton() {
            super("SC hinzufügen");
            getStyleClass().addAll("compact", "neutral-action");
            setId(CONTROL_ID);
            updateCandidates(List.of());
            popup.onPartyMemberSelected((memberId, initiative) ->
                    selectionListener.onPartyMemberSelected(memberId, initiative));
            setOnAction(event -> popup.show(this, candidates));
        }

        private void updateCandidates(List<EncounterStateView.PartyMemberCandidate> value) {
            candidates = value == null ? List.of() : List.copyOf(value);
            setDisable(candidates.isEmpty());
            setTooltip(new javafx.scene.control.Tooltip(candidates.isEmpty()
                    ? "Alle aktiven SCs sind im Kampf."
                    : "Aktives Party-Mitglied in den laufenden Kampf aufnehmen."));
        }

        private void onPartyMemberSelected(PartyMemberSelectionListener listener) {
            selectionListener = listener == null ? (memberId, initiative) -> { } : listener;
        }
    }

    private static final class PartyMemberPopup {

        private final AnchoredPopupView popup = new AnchoredPopupView();
        private PartyMemberSelectionListener selectionListener = (memberId, initiative) -> { };

        private void onPartyMemberSelected(PartyMemberSelectionListener listener) {
            selectionListener = listener == null ? (memberId, initiative) -> { } : listener;
        }

        private void show(Node anchor, List<EncounterStateView.PartyMemberCandidate> candidates) {
            if (anchor == null || candidates == null || candidates.isEmpty()) {
                return;
            }
            popup.hide();

            VBox list = new VBox(6);
            list.getStyleClass().add("anchored-popup");
            list.setPadding(new Insets(8));

            TextField firstField = null;
            for (EncounterStateView.PartyMemberCandidate candidate : candidates) {
                TextField initiativeField = initiativeField(candidate.name());
                Button down = spinnerButton("\u25BC");
                Button up = spinnerButton("\u25B2");
                down.setOnAction(event -> initiativeField.setText(String.valueOf(parseInitiative(initiativeField.getText()) - 1)));
                up.setOnAction(event -> initiativeField.setText(String.valueOf(parseInitiative(initiativeField.getText()) + 1)));

                Button add = new Button("Hinzufügen");
                add.getStyleClass().add("accent");
                Runnable apply = () -> {
                    popup.hide();
                    selectionListener.onPartyMemberSelected(candidate.memberId(), parseInitiative(initiativeField.getText()));
                };
                add.setOnAction(event -> apply.run());
                initiativeField.setOnAction(event -> apply.run());

                Label name = new Label(candidate.name() + " (Lv. " + candidate.level() + ")");
                name.getStyleClass().add("combat-name");
                HBox.setHgrow(name, Priority.ALWAYS);

                HBox row = new HBox(6, name, down, initiativeField, up, add);
                row.setAlignment(Pos.CENTER_LEFT);
                list.getChildren().add(row);
                if (firstField == null) {
                    firstField = initiativeField;
                }
            }

            popup.setContent(list);
            popup.showBelow(anchor, 8);
            if (firstField != null) {
                popup.focusAfterShown(firstField);
            }
        }

        private static TextField initiativeField(String name) {
            TextField field = new TextField("10");
            field.getStyleClass().add("text-field");
            field.setPrefWidth(56);
            field.setAccessibleText("Initiative für " + name);
            field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9-]*") ? change : null));
            return field;
        }

        private static Button spinnerButton(String text) {
            Button button = new Button(text);
            button.getStyleClass().add("spinner-btn");
            button.setFocusTraversable(false);
            return button;
        }

        private static int parseInitiative(String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException exception) {
                return 10;
            }
        }
    }
}
