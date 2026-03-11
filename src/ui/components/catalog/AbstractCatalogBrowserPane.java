package ui.components.catalog;

import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.concurrent.Task;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.AccessibleAttribute;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.SelectionMode;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.List;

public abstract class AbstractCatalogBrowserPane<T, C> extends BorderPane {
    public record SortOption(String label, String column, String dir) {
        @Override public String toString() { return label; }
    }

    public record PageLoadResult<T>(
            List<T> items,
            int totalCount,
            boolean serviceOk,
            Throwable failureCause,
            boolean loaderContractFailure) {}

    private static final int PAGE_SIZE = 50;

    private final ObservableList<T> items = FXCollections.observableArrayList();
    private final TableView<T> table = new TableView<>(items);
    private final Label countLabel;
    private final Label pageLabel = new Label("Seite 1");
    private final Button prevButton = new Button("\u25C0 Zur\u00fcck");
    private final Button nextButton = new Button("Weiter \u25B6");
    private final ComboBox<SortOption> sortCombo;
    private final Label loadingPlaceholder = new Label("Lade...");
    private final Label emptyPlaceholder;
    private final Label errorPlaceholder = new Label("Fehler beim Laden");

    private Task<?> currentTask;
    private C currentCriteria;
    private int currentOffset = 0;
    private int totalCount = 0;
    private String sortColumn;
    private String sortDirection;

    protected AbstractCatalogBrowserPane(String initialCountLabel, String emptyPlaceholderText, List<SortOption> sortOptions) {
        countLabel = new Label(initialCountLabel);
        emptyPlaceholder = new Label(emptyPlaceholderText);
        sortCombo = new ComboBox<>(FXCollections.observableArrayList(sortOptions));
        SortOption firstOption = sortOptions.isEmpty() ? null : sortOptions.getFirst();
        sortColumn = firstOption != null ? firstOption.column() : "name";
        sortDirection = firstOption != null ? firstOption.dir() : "ASC";

        setPadding(new Insets(8));

        HBox topBar = new HBox(8);
        topBar.setAlignment(Pos.CENTER_LEFT);
        topBar.setPadding(new Insets(0, 0, 6, 0));
        countLabel.getStyleClass().add("text-secondary");
        pageLabel.getStyleClass().add("text-secondary");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        Label sortLabel = new Label("Sortierung:");
        sortLabel.getStyleClass().add("text-muted");
        if (!sortOptions.isEmpty()) {
            sortCombo.getSelectionModel().selectFirst();
        }
        topBar.getChildren().addAll(countLabel, spacer, sortLabel, sortCombo);
        setTop(topBar);

        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        table.getSelectionModel().setSelectionMode(SelectionMode.SINGLE);
        table.setPlaceholder(emptyPlaceholder);
        setCenter(table);

        HBox pagination = new HBox(8, prevButton, pageLabel, nextButton);
        pagination.setAlignment(Pos.CENTER);
        pagination.setPadding(new Insets(6, 0, 0, 0));
        setBottom(pagination);

        prevButton.setOnAction(e -> {
            if (currentOffset > 0) {
                currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
                loadPage();
            }
        });
        nextButton.setOnAction(e -> {
            if (currentOffset + PAGE_SIZE < totalCount) {
                currentOffset += PAGE_SIZE;
                loadPage();
            }
        });
        sortCombo.setOnAction(e -> {
            SortOption option = sortCombo.getValue();
            if (option == null) return;
            sortColumn = option.column();
            sortDirection = option.dir();
            currentOffset = 0;
            loadPage();
        });
    }

    protected final TableView<T> table() {
        return table;
    }

    protected final T itemAt(int index) {
        if (index < 0 || index >= items.size()) return null;
        return items.get(index);
    }

    protected final void setColumns(List<? extends TableColumn<T, ?>> columns) {
        table.getColumns().setAll(columns);
    }

    protected final boolean hasLoadedCriteria() {
        return !items.isEmpty() || currentCriteria != null;
    }

    protected final void resetToFirstPage() {
        currentOffset = 0;
    }

    public final void applyFilters(C criteria) {
        currentCriteria = criteria;
        currentOffset = 0;
        loadPage();
    }

    public final void loadInitial() {
        if (!items.isEmpty()) return;
        currentCriteria = emptyCriteria();
        currentOffset = 0;
        loadPage();
    }

    public final void refresh() {
        if (items.isEmpty() && currentCriteria == null) {
            loadInitial();
            return;
        }
        loadPage();
    }

    private void loadPage() {
        if (currentTask != null && currentTask.isRunning()) currentTask.cancel();
        table.setPlaceholder(loadingPlaceholder);
        prevButton.setDisable(true);
        nextButton.setDisable(true);
        sortCombo.setDisable(true);

        C criteria = currentCriteria != null ? currentCriteria : emptyCriteria();
        int offset = currentOffset;
        Task<PageLoadResult<T>> task = new Task<>() {
            @Override
            protected PageLoadResult<T> call() {
                return loadPage(criteria, sortColumn, sortDirection, PAGE_SIZE, offset);
            }
        };
        currentTask = task;

        UiAsyncTasks.submit(task, result -> {
            PageLoadResult<T> page = sanitize(result);
            totalCount = Math.max(0, page.totalCount());
            items.setAll(page.items());
            table.setPlaceholder(page.serviceOk() ? emptyPlaceholder : errorPlaceholder);
            sortCombo.setDisable(false);
            updatePagination();
            if (page.failureCause() != null) {
                UiErrorReporter.reportBackgroundFailure(
                        page.loaderContractFailure()
                                ? loadContext() + " invalid result"
                                : loadContext() + " service failure",
                        page.failureCause());
            }
        }, throwable -> {
            if (!task.isCancelled()) {
                UiErrorReporter.reportBackgroundFailure(loadContext(), throwable);
                table.setPlaceholder(errorPlaceholder);
                sortCombo.setDisable(false);
                updatePagination();
            }
        });
    }

    private PageLoadResult<T> sanitize(PageLoadResult<T> result) {
        if (result == null) {
            return new PageLoadResult<>(List.of(), 0, false, new IllegalStateException("Loader returned null PageLoadResult"), true);
        }
        if (result.items() == null) {
            return new PageLoadResult<>(List.of(), 0, false, new IllegalStateException("Loader returned null items"), true);
        }
        return result;
    }

    private void updatePagination() {
        int currentPage = totalCount == 0 ? 1 : (currentOffset / PAGE_SIZE) + 1;
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil((double) totalCount / PAGE_SIZE);
        countLabel.setText(countLabelText(totalCount));
        pageLabel.setText("Seite " + currentPage + " / " + totalPages);
        prevButton.setDisable(currentOffset <= 0);
        nextButton.setDisable(currentOffset + PAGE_SIZE >= totalCount);
        countLabel.notifyAccessibleAttributeChanged(AccessibleAttribute.TEXT);
        pageLabel.notifyAccessibleAttributeChanged(AccessibleAttribute.TEXT);
    }

    protected abstract C emptyCriteria();
    protected abstract PageLoadResult<T> loadPage(C criteria, String sortColumn, String sortDirection, int limit, int offset);
    protected abstract String countLabelText(int totalCount);
    protected abstract String loadContext();
}
