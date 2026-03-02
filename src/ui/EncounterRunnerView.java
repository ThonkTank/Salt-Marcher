package ui;

import entities.CombatantState;
import ui.components.StatBlockView;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.*;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;

import java.util.List;

public class EncounterRunnerView extends BorderPane {

    private final List<CombatantState> combatants;
    private final ObservableList<CombatantState> items;
    private final TableView<CombatantState> table;
    private final Label roundLabel;
    private int currentTurn = 0;
    private int round = 1;

    public EncounterRunnerView(List<CombatantState> combatants) {
        this.combatants = combatants;
        this.items = FXCollections.observableArrayList(combatants);

        setPadding(new Insets(0));

        // ---- TOP BAR ----
        roundLabel = new Label("Runde 1");
        roundLabel.getStyleClass().add("title");
        roundLabel.setPadding(new Insets(0, 16, 0, 4));

        Button nextButton = new Button("N\u00e4chster Zug \u25B6");
        nextButton.getStyleClass().add("accent");
        Button endButton = new Button("Kampf beenden");

        HBox topBar = new HBox(8);
        topBar.getStyleClass().add("toolbar");
        topBar.setAlignment(Pos.CENTER_LEFT);
        topBar.getChildren().addAll(roundLabel, nextButton, new Region(), endButton);

        setTop(topBar);

        // ---- TABLE ----
        table = new TableView<>(items);
        table.getSelectionModel().setSelectionMode(SelectionMode.SINGLE);
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);

        TableColumn<CombatantState, String> turnCol = new TableColumn<>("");
        turnCol.setCellValueFactory(cd -> new SimpleStringProperty(
                combatants.indexOf(cd.getValue()) == currentTurn ? "\u25B6" : ""));
        turnCol.setMaxWidth(28);
        turnCol.setMinWidth(28);
        turnCol.setSortable(false);

        TableColumn<CombatantState, String> nameCol = new TableColumn<>("Name");
        nameCol.setCellValueFactory(cd -> new SimpleStringProperty(cd.getValue().Name));
        nameCol.setPrefWidth(200);
        nameCol.setCellFactory(col -> new TableCell<>() {
            @Override
            protected void updateItem(String name, boolean empty) {
                super.updateItem(name, empty);
                if (empty || name == null) { setText(null); setGraphic(null); return; }
                CombatantState c = getTableView().getItems().get(getIndex());
                Label lbl = new Label(name);
                if (!c.IsPlayerCharacter) lbl.getStyleClass().add("creature-link");
                setGraphic(lbl);
            }
        });

        TableColumn<CombatantState, String> hpCol = new TableColumn<>("HP");
        hpCol.setCellValueFactory(cd -> new SimpleStringProperty(
                cd.getValue().IsPlayerCharacter ? "\u2014" : String.valueOf(cd.getValue().CurrentHp)));
        hpCol.setPrefWidth(60);

        TableColumn<CombatantState, String> maxHpCol = new TableColumn<>("Max HP");
        maxHpCol.setCellValueFactory(cd -> new SimpleStringProperty(
                cd.getValue().IsPlayerCharacter ? "\u2014" : String.valueOf(cd.getValue().MaxHp)));
        maxHpCol.setPrefWidth(60);

        TableColumn<CombatantState, String> acCol = new TableColumn<>("AC");
        acCol.setCellValueFactory(cd -> new SimpleStringProperty(
                cd.getValue().Ac > 0 ? String.valueOf(cd.getValue().Ac) : "\u2014"));
        acCol.setPrefWidth(50);

        TableColumn<CombatantState, Number> initCol = new TableColumn<>("Init");
        initCol.setCellValueFactory(cd -> new SimpleIntegerProperty(cd.getValue().Initiative));
        initCol.setPrefWidth(50);

        table.getColumns().addAll(turnCol, nameCol, hpCol, maxHpCol, acCol, initCol);

        // Row factory for active/dead styling
        table.setRowFactory(tv -> new TableRow<>() {
            @Override
            protected void updateItem(CombatantState item, boolean empty) {
                super.updateItem(item, empty);
                getStyleClass().removeAll("combatant-active", "combatant-dead");
                if (empty || item == null) return;
                int idx = getIndex();
                if (idx == currentTurn) {
                    getStyleClass().add("combatant-active");
                } else if (!item.IsPlayerCharacter && item.CurrentHp <= 0) {
                    getStyleClass().add("combatant-dead");
                }
            }
        });

        setCenter(table);

        // ---- LISTENERS ----
        nextButton.setOnAction(e -> nextTurn());
        endButton.setOnAction(e -> {
            Alert confirm = new Alert(Alert.AlertType.CONFIRMATION,
                    "Kampf wirklich beenden?", ButtonType.YES, ButtonType.NO);
            confirm.setTitle("Kampf beenden");
            confirm.showAndWait().ifPresent(bt -> {
                if (bt == ButtonType.YES) {
                    getScene().getWindow().hide();
                }
            });
        });

        // Name click -> stat block, HP double-click -> edit
        table.setOnMouseClicked(e -> {
            if (e.getButton() != MouseButton.PRIMARY) return;
            CombatantState c = table.getSelectionModel().getSelectedItem();
            if (c == null) return;

            if (!c.IsPlayerCharacter && e.getClickCount() == 1) {
                // Check if clicked on name column area (approximate)
                showStatBlock(c);
            }
            if (!c.IsPlayerCharacter && e.getClickCount() == 2) {
                editHp(c);
            }
        });

        // ENTER -> stat block, F2 -> edit HP
        table.setOnKeyPressed(e -> {
            CombatantState c = table.getSelectionModel().getSelectedItem();
            if (c == null) return;
            if (e.getCode() == KeyCode.ENTER && !c.IsPlayerCharacter) {
                showStatBlock(c);
                e.consume();
            } else if (e.getCode() == KeyCode.F2 && !c.IsPlayerCharacter) {
                editHp(c);
                e.consume();
            }
        });
    }

    private void nextTurn() {
        if (combatants.isEmpty()) return;

        int checked = 0;
        do {
            currentTurn = (currentTurn + 1) % combatants.size();
            if (currentTurn == 0) {
                round++;
                roundLabel.setText("Runde " + round);
            }
            checked++;
            if (checked > combatants.size()) break;
        } while (!combatants.get(currentTurn).IsPlayerCharacter
                && combatants.get(currentTurn).CurrentHp <= 0);

        items.setAll(combatants); // refresh
        table.scrollTo(currentTurn);
        table.getSelectionModel().select(currentTurn);
    }

    private void editHp(CombatantState c) {
        TextInputDialog dlg = new TextInputDialog();
        dlg.setTitle("HP anpassen");
        dlg.setHeaderText(c.Name + "  HP: " + c.CurrentHp + " / " + c.MaxHp);
        dlg.setContentText("Schaden (-) oder Heilung (+):");
        dlg.showAndWait().ifPresent(input -> {
            try {
                int delta = Integer.parseInt(input.trim());
                c.CurrentHp = Math.max(0, Math.min(c.MaxHp, c.CurrentHp + delta));
                items.setAll(combatants); // refresh
            } catch (NumberFormatException ex) {
                new Alert(Alert.AlertType.ERROR, "Ungueltige Eingabe: " + input).showAndWait();
            }
        });
    }

    private void showStatBlock(CombatantState cs) {
        if (cs.CreatureRef == null) return;
        StatBlockView.show(cs.CreatureRef, getScene().getWindow());
    }
}
