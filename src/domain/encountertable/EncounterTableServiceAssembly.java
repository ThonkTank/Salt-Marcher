package src.domain.encountertable;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import shell.api.ServiceRegistry;
import src.domain.encountertable.model.catalog.EncounterTableCandidateData;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.encountertable.model.catalog.repository.EncounterTablePublishedStateRepository;
import src.domain.encountertable.model.catalog.usecase.LoadEncounterTableCandidatesUseCase;
import src.domain.encountertable.model.catalog.usecase.LoadEncounterTableSummariesUseCase;
import src.domain.encountertable.published.EncounterTableCandidate;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableCandidatesModel;
import src.domain.encountertable.published.EncounterTableCandidatesResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.EncounterTableSummary;

final class EncounterTableServiceAssembly {

    private final java.util.concurrent.atomic.AtomicReference<EncounterTablePublishedStateRepositoryAdapter> publishedState =
            new java.util.concurrent.atomic.AtomicReference<>();

    EncounterTableApplicationService createApplicationService(ServiceRegistry services) {
        EncounterTableCatalogPort catalog = services.require(EncounterTableCatalogPort.class);
        return new EncounterTableApplicationService(
                new LoadEncounterTableSummariesUseCase(catalog, publishedState()),
                new LoadEncounterTableCandidatesUseCase(catalog, publishedState()));
    }

    EncounterTableCatalogModel catalogModel(ServiceRegistry services) {
        return publishedState().catalogModel;
    }

    EncounterTableCandidatesModel candidatesModel(ServiceRegistry services) {
        return publishedState().candidatesModel;
    }

    private EncounterTablePublishedStateRepositoryAdapter publishedState() {
        EncounterTablePublishedStateRepositoryAdapter existing = publishedState.get();
        if (existing != null) {
            return existing;
        }
        EncounterTablePublishedStateRepositoryAdapter candidate = new EncounterTablePublishedStateRepositoryAdapter();
        return publishedState.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(publishedState.get(), "publishedState");
    }

    private static final class EncounterTablePublishedStateRepositoryAdapter implements EncounterTablePublishedStateRepository {

        private static final String LISTENER_PARAMETER = "listener";

        private final List<Consumer<EncounterTableCatalogResult>> catalogListeners = new ArrayList<>();
        private final List<Consumer<EncounterTableCandidatesResult>> candidatesListeners = new ArrayList<>();

        final EncounterTableCatalogModel catalogModel = new EncounterTableCatalogModel(
                this::currentCatalog,
                this::subscribeCatalogListener);
        final EncounterTableCandidatesModel candidatesModel = new EncounterTableCandidatesModel(
                this::currentCandidates,
                this::subscribeCandidatesListener);

        private EncounterTableCatalogResult currentCatalog =
                new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, List.of());
        private EncounterTableCandidatesResult currentCandidates =
                new EncounterTableCandidatesResult(EncounterTableReadStatus.STORAGE_ERROR, List.of());

        @Override
        public void publishCatalog(CatalogPublication result) {
            CatalogPublication safeResult = result == null ? new CatalogPublication(STORAGE_ERROR, List.of()) : result;
            currentCatalog = new EncounterTableCatalogResult(
                    SUCCESS.equals(safeResult.status())
                            ? EncounterTableReadStatus.SUCCESS
                            : EncounterTableReadStatus.STORAGE_ERROR,
                    safeResult.tables().stream()
                            .map(summary -> new EncounterTableSummary(
                                    summary.tableId(),
                                    summary.name(),
                                    summary.linkedLootTableId()))
                            .toList());
            for (Consumer<EncounterTableCatalogResult> listener : List.copyOf(catalogListeners)) {
                listener.accept(currentCatalog);
            }
        }

        @Override
        public void publishCandidates(CandidatesPublication result) {
            CandidatesPublication safeResult = result == null ? new CandidatesPublication(STORAGE_ERROR, List.of()) : result;
            currentCandidates = new EncounterTableCandidatesResult(
                    SUCCESS.equals(safeResult.status())
                            ? EncounterTableReadStatus.SUCCESS
                            : EncounterTableReadStatus.STORAGE_ERROR,
                    safeResult.candidates().stream()
                            .map(EncounterTablePublishedStateRepositoryAdapter::toPublishedCandidate)
                            .toList());
            for (Consumer<EncounterTableCandidatesResult> listener : List.copyOf(candidatesListeners)) {
                listener.accept(currentCandidates);
            }
        }

        private EncounterTableCatalogResult currentCatalog() {
            return currentCatalog;
        }

        private EncounterTableCandidatesResult currentCandidates() {
            return currentCandidates;
        }

        private Runnable subscribeCatalogListener(Consumer<EncounterTableCatalogResult> listener) {
            Consumer<EncounterTableCatalogResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
            catalogListeners.add(safeListener);
            return () -> catalogListeners.remove(safeListener);
        }

        private Runnable subscribeCandidatesListener(Consumer<EncounterTableCandidatesResult> listener) {
            Consumer<EncounterTableCandidatesResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
            candidatesListeners.add(safeListener);
            return () -> candidatesListeners.remove(safeListener);
        }

        private static EncounterTableCandidate toPublishedCandidate(EncounterTableCandidateData candidate) {
            return new EncounterTableCandidate(
                    candidate.creatureId(),
                    candidate.name(),
                    candidate.creatureType(),
                    candidate.challengeRating(),
                    candidate.xp(),
                    candidate.hitPoints(),
                    candidate.hitDiceCount(),
                    candidate.hitDiceSides(),
                    candidate.hitDiceModifier(),
                    candidate.armorClass(),
                    candidate.initiativeBonus(),
                    candidate.legendaryActionCount(),
                    candidate.weight(),
                    "Encounter table");
        }
    }
}
