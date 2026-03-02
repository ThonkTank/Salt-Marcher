package ui.components;

import entities.PlayerCharacter;
import javafx.geometry.Insets;
import javafx.scene.control.*;
import javafx.scene.layout.GridPane;
import javafx.stage.Window;

import java.util.ArrayList;
import java.util.List;

public class InitiativeDialog {

    public static List<Integer> show(Window owner, List<PlayerCharacter> party) {
        Dialog<List<Integer>> dialog = new Dialog<>();
        dialog.setTitle("Initiative \u2014 Spielercharaktere");
        dialog.initOwner(owner);

        GridPane grid = new GridPane();
        grid.setHgap(6);
        grid.setVgap(4);
        grid.setPadding(new Insets(8));

        List<Spinner<Integer>> spinners = new ArrayList<>();
        for (int i = 0; i < party.size(); i++) {
            PlayerCharacter pc = party.get(i);
            grid.add(new Label(pc.Name + " (Lv. " + pc.Level + "):"), 0, i);
            Spinner<Integer> sp = new Spinner<>(1, 30, 10);
            sp.setEditable(true);
            sp.setPrefWidth(80);
            grid.add(sp, 1, i);
            spinners.add(sp);
        }

        dialog.getDialogPane().setContent(grid);
        dialog.getDialogPane().getButtonTypes().addAll(ButtonType.OK, ButtonType.CANCEL);
        dialog.setResultConverter(bt ->
                bt == ButtonType.OK ? spinners.stream().map(Spinner::getValue).toList() : null);

        return dialog.showAndWait().orElse(null);
    }
}
