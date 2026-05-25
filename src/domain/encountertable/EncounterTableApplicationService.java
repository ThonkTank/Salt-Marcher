package src.domain.encountertable;

import java.util.List;
import java.util.Objects;
import src.domain.encountertable.model.catalog.usecase.LoadEncounterTableCandidatesUseCase;
import src.domain.encountertable.model.catalog.usecase.LoadEncounterTableSummariesUseCase;
import src.domain.encountertable.published.RefreshEncounterTableCatalogCommand;
import src.domain.encountertable.published.RefreshEncounterTableCandidatesCommand;

public final class EncounterTableApplicationService {

    private final LoadEncounterTableSummariesUseCase loadSummariesUseCase;
    private final LoadEncounterTableCandidatesUseCase loadCandidatesUseCase;

    public EncounterTableApplicationService(
            LoadEncounterTableSummariesUseCase loadSummariesUseCase,
            LoadEncounterTableCandidatesUseCase loadCandidatesUseCase
    ) {
        this.loadSummariesUseCase = Objects.requireNonNull(loadSummariesUseCase, "loadSummariesUseCase");
        this.loadCandidatesUseCase = Objects.requireNonNull(loadCandidatesUseCase, "loadCandidatesUseCase");
    }

    public void refreshCatalog(RefreshEncounterTableCatalogCommand command) {
        Objects.requireNonNull(command, "command");
        loadSummariesUseCase.execute();
    }

    public void refreshCandidates(RefreshEncounterTableCandidatesCommand command) {
        loadCandidatesUseCase.execute(
                command != null,
                command == null ? List.of() : command.tableIds(),
                command == null ? 0 : command.maximumXp());
    }
}
