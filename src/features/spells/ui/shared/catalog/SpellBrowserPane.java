package features.spells.ui.shared.catalog;

import features.spells.api.SpellCatalogService;
import javafx.beans.property.SimpleStringProperty;
import javafx.scene.control.Button;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.scene.input.KeyCode;
import ui.components.catalog.AbstractCatalogBrowserPane;

import java.util.List;
import java.util.function.Consumer;

public class SpellBrowserPane extends AbstractCatalogBrowserPane<SpellCatalogService.SpellSummary, SpellCatalogService.FilterCriteria> {
    private static final List<SortOption> SORT_OPTIONS = List.of(
            new SortOption("Name (A-Z)", "name", "ASC"),
            new SortOption("Name (Z-A)", "name", "DESC"),
            new SortOption("Grad (aufst.)", "level", "ASC"),
            new SortOption("Grad (abst.)", "level", "DESC")
    );

    private Consumer<Long> onRequestSpell;

    public SpellBrowserPane() {
        super("0 Zauber gefunden", "Keine Zauber gefunden", SORT_OPTIONS);

        TableColumn<SpellCatalogService.SpellSummary, String> nameCol = new TableColumn<>("Name");
        nameCol.setCellValueFactory(cd -> new SimpleStringProperty(cd.getValue().name()));
        nameCol.setMinWidth(170);
        nameCol.setCellFactory(col -> new TableCell<>() {
            private final Button btn = new Button();
            {
                btn.getStyleClass().addAll("item-link", "flat");
                btn.setOnAction(e -> {
                    SpellCatalogService.SpellSummary spell = itemAt(getIndex());
                    if (spell != null && onRequestSpell != null && spell.spellId() > 0) {
                        onRequestSpell.accept(spell.spellId());
                    }
                });
            }

            @Override
            protected void updateItem(String value, boolean empty) {
                super.updateItem(value, empty);
                if (empty || value == null) {
                    setText(null);
                    setGraphic(null);
                    return;
                }
                btn.setText(value);
                btn.setAccessibleText("Zauber anzeigen: " + value);
                setText(null);
                setGraphic(btn);
            }
        });

        TableColumn<SpellCatalogService.SpellSummary, String> levelCol = new TableColumn<>("Grad");
        levelCol.setCellValueFactory(cd -> new SimpleStringProperty(levelText(cd.getValue().level())));
        levelCol.setMinWidth(60);
        levelCol.setMaxWidth(80);

        TableColumn<SpellCatalogService.SpellSummary, String> schoolCol = new TableColumn<>("Schule");
        schoolCol.setCellValueFactory(cd -> new SimpleStringProperty(nullToEmpty(cd.getValue().school())));
        schoolCol.setMinWidth(110);
        schoolCol.setMaxWidth(150);

        TableColumn<SpellCatalogService.SpellSummary, String> classCol = new TableColumn<>("Klassen");
        classCol.setCellValueFactory(cd -> new SimpleStringProperty(nullToEmpty(cd.getValue().classesText())));
        classCol.setMinWidth(180);

        TableColumn<SpellCatalogService.SpellSummary, String> sourceCol = new TableColumn<>("Quelle");
        sourceCol.setCellValueFactory(cd -> new SimpleStringProperty(nullToEmpty(cd.getValue().source())));
        sourceCol.setMinWidth(90);
        sourceCol.setMaxWidth(130);

        setColumns(List.of(nameCol, levelCol, schoolCol, classCol, sourceCol));

        table().setOnKeyPressed(e -> {
            SpellCatalogService.SpellSummary spell = table().getSelectionModel().getSelectedItem();
            if (spell == null || spell.spellId() <= 0 || onRequestSpell == null) return;
            if (e.getCode() == KeyCode.ENTER) {
                onRequestSpell.accept(spell.spellId());
                e.consume();
            }
        });
    }

    public void setOnRequestSpell(Consumer<Long> callback) {
        onRequestSpell = callback;
    }

    @Override
    protected SpellCatalogService.FilterCriteria emptyCriteria() {
        return SpellCatalogService.FilterCriteria.empty();
    }

    @Override
    protected PageLoadResult<SpellCatalogService.SpellSummary> loadPage(
            SpellCatalogService.FilterCriteria criteria,
            String sortColumn,
            String sortDirection,
            int limit,
            int offset) {
        SpellCatalogService.ServiceResult<SpellCatalogService.PageResult> result = SpellCatalogService.searchSpells(
                criteria,
                new SpellCatalogService.PageRequest(sortColumn, sortDirection, limit, offset));
        return sanitizeResult(result);
    }

    @Override
    protected String countLabelText(int totalCount) {
        return totalCount + " Zauber gefunden";
    }

    @Override
    protected String loadContext() {
        return "SpellBrowserPane.loadPage()";
    }

    private static PageLoadResult<SpellCatalogService.SpellSummary> sanitizeResult(
            SpellCatalogService.ServiceResult<SpellCatalogService.PageResult> result) {
        if (result == null) {
            return invalidResult("SpellCatalogService returned null ServiceResult");
        }
        SpellCatalogService.PageResult page = result.value();
        if (page == null) {
            return invalidResult("SpellCatalogService returned null PageResult");
        }
        if (page.spells() == null) {
            return invalidResult("SpellCatalogService returned PageResult with null spells");
        }
        if (!result.isOk()) {
            return new PageLoadResult<>(
                    page.spells(),
                    page.totalCount(),
                    false,
                    new IllegalStateException("SpellCatalogService status: " + result.status()),
                    false);
        }
        return new PageLoadResult<>(page.spells(), page.totalCount(), true, null, false);
    }

    private static PageLoadResult<SpellCatalogService.SpellSummary> invalidResult(String message) {
        return new PageLoadResult<>(List.of(), 0, false, new IllegalStateException(message), true);
    }

    private static String levelText(int level) {
        return level == 0 ? "Zaubertrick" : Integer.toString(level);
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
