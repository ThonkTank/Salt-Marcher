package src.data.creatures.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.model.catalog.model.CreatureCatalogData;
import src.domain.creatures.model.catalog.model.CreatureCatalogData.CreatureProfile;
import src.domain.creatures.model.catalog.repository.CreaturesPublishedStateRepository;
import src.domain.creatures.published.CreatureActionDetail;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureCatalogRow;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureFilterOptions;
import src.domain.creatures.published.CreatureFilterOptionsModel;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;

public final class CreaturePublishedStateRepositoryAdapter implements CreaturesPublishedStateRepository {

    private static final String LISTENER_PARAMETER = "listener";
    private static final CreatureCatalogData.DistinctFilterValues EMPTY_FILTER_VALUES =
            new CreatureCatalogData.DistinctFilterValues(List.of(), List.of(), List.of(), List.of(), List.of());
    private static final CreatureCatalogData.CatalogPageData EMPTY_CATALOG_PAGE =
            new CreatureCatalogData.CatalogPageData(List.of(), 0, 50, 0);

    private final List<Consumer<CreatureFilterOptionsResult>> filterOptionsListeners = new ArrayList<>();
    private final List<Consumer<CreatureCatalogPageResult>> catalogListeners = new ArrayList<>();
    private final List<Consumer<CreatureDetailResult>> detailListeners = new ArrayList<>();

    public final CreatureFilterOptionsModel filterOptionsModel = new CreatureFilterOptionsModel(
            this::currentFilterOptions,
            this::subscribeFilterOptionsListener);
    public final CreatureCatalogModel catalogModel = new CreatureCatalogModel(
            this::currentCatalogPage,
            this::subscribeCatalogListener);
    public final CreatureDetailModel detailModel = new CreatureDetailModel(
            this::currentCreatureDetail,
            this::subscribeDetailListener);

    private CreatureFilterOptionsResult currentFilterOptions =
            new CreatureFilterOptionsResult(
                    CreatureReadStatus.STORAGE_ERROR,
                    toPublishedFilterOptions(EMPTY_FILTER_VALUES, List.of()));
    private CreatureCatalogPageResult currentCatalogPage =
            new CreatureCatalogPageResult(CreatureQueryStatus.STORAGE_ERROR, toPublishedCatalogPage(EMPTY_CATALOG_PAGE));
    private CreatureDetailResult currentCreatureDetail =
            new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null);

    @Override
    public void publishFilterOptions(FilterOptionsPublication result) {
        FilterOptionsPublication safeResult = result == null
                ? new FilterOptionsPublication(STORAGE_ERROR, EMPTY_FILTER_VALUES, List.of())
                : result;
        CreatureCatalogData.DistinctFilterValues values = safeResult.values();
        currentFilterOptions = new CreatureFilterOptionsResult(
                toReadStatus(safeResult.status()),
                toPublishedFilterOptions(values, safeResult.challengeRatings()));
        notifyListeners(filterOptionsListeners, currentFilterOptions);
    }

    @Override
    public void publishCatalogPage(CatalogPagePublication result) {
        CatalogPagePublication safeResult = result == null
                ? new CatalogPagePublication(STORAGE_ERROR, EMPTY_CATALOG_PAGE)
                : result;
        currentCatalogPage = new CreatureCatalogPageResult(
                toQueryStatus(safeResult.status()),
                toPublishedCatalogPage(safeResult.page()));
        notifyListeners(catalogListeners, currentCatalogPage);
    }

    @Override
    public void publishCreatureDetail(CreatureDetailPublication result) {
        CreatureDetailPublication safeResult = result == null
                ? new CreatureDetailPublication(STORAGE_ERROR, null)
                : result;
        currentCreatureDetail = new CreatureDetailResult(
                toLookupStatus(safeResult.status()),
                toPublishedCreatureDetail(safeResult.detail()));
        notifyListeners(detailListeners, currentCreatureDetail);
    }

    private CreatureFilterOptionsResult currentFilterOptions() {
        return currentFilterOptions;
    }

    private CreatureCatalogPageResult currentCatalogPage() {
        return currentCatalogPage;
    }

    private CreatureDetailResult currentCreatureDetail() {
        return currentCreatureDetail;
    }

    private Runnable subscribeFilterOptionsListener(Consumer<CreatureFilterOptionsResult> listener) {
        Consumer<CreatureFilterOptionsResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        filterOptionsListeners.add(safeListener);
        return () -> filterOptionsListeners.remove(safeListener);
    }

    private Runnable subscribeCatalogListener(Consumer<CreatureCatalogPageResult> listener) {
        Consumer<CreatureCatalogPageResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        catalogListeners.add(safeListener);
        return () -> catalogListeners.remove(safeListener);
    }

    private Runnable subscribeDetailListener(Consumer<CreatureDetailResult> listener) {
        Consumer<CreatureDetailResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        detailListeners.add(safeListener);
        return () -> detailListeners.remove(safeListener);
    }

    private static <T> void notifyListeners(List<Consumer<T>> listeners, T result) {
        for (Consumer<T> listener : List.copyOf(listeners)) {
            listener.accept(result);
        }
    }

    private static CreatureReadStatus toReadStatus(String status) {
        return SUCCESS.equals(status) ? CreatureReadStatus.SUCCESS : CreatureReadStatus.STORAGE_ERROR;
    }

    private static CreatureQueryStatus toQueryStatus(String status) {
        return switch (status) {
            case SUCCESS -> CreatureQueryStatus.SUCCESS;
            case INVALID_QUERY -> CreatureQueryStatus.INVALID_QUERY;
            default -> CreatureQueryStatus.STORAGE_ERROR;
        };
    }

    private static CreatureLookupStatus toLookupStatus(String status) {
        return switch (status) {
            case SUCCESS -> CreatureLookupStatus.SUCCESS;
            case NOT_FOUND -> CreatureLookupStatus.NOT_FOUND;
            default -> CreatureLookupStatus.STORAGE_ERROR;
        };
    }

    private static CreatureFilterOptions toPublishedFilterOptions(
            CreatureCatalogData.DistinctFilterValues values,
            List<String> challengeRatings
    ) {
        return new CreatureFilterOptions(
                values.sizes(),
                values.types(),
                values.subtypes(),
                values.biomes(),
                values.alignments(),
                challengeRatings);
    }

    private static CreatureCatalogPage toPublishedCatalogPage(CreatureCatalogData.CatalogPageData page) {
        return new CreatureCatalogPage(
                page.rows().stream()
                        .map(row -> new CreatureCatalogRow(
                                row.id(),
                                row.name(),
                                row.size(),
                                row.creatureType(),
                                row.alignment(),
                                row.challengeRating(),
                                row.xp(),
                                row.hitPoints(),
                                row.armorClass()))
                        .toList(),
                page.totalCount(),
                page.pageSize(),
                page.pageOffset());
    }

    private static @Nullable CreatureDetail toPublishedCreatureDetail(@Nullable CreatureProfile detail) {
        if (detail == null) {
            return null;
        }
        return new CreatureDetail(
                detail.id(),
                detail.name(),
                detail.size(),
                detail.creatureType(),
                detail.subtypes(),
                detail.biomes(),
                detail.alignment(),
                detail.challengeRating(),
                detail.xp(),
                detail.hitPoints(),
                detail.hitDiceExpression(),
                detail.hitDiceCount(),
                detail.hitDiceSides(),
                detail.hitDiceModifier(),
                detail.armorClass(),
                detail.armorClassNotes(),
                detail.walkSpeed(),
                detail.flySpeed(),
                detail.swimSpeed(),
                detail.climbSpeed(),
                detail.burrowSpeed(),
                detail.strength(),
                detail.dexterity(),
                detail.constitution(),
                detail.intelligence(),
                detail.wisdom(),
                detail.charisma(),
                detail.initiativeBonus(),
                detail.proficiencyBonus(),
                detail.savingThrows(),
                detail.skills(),
                detail.damageVulnerabilities(),
                detail.damageResistances(),
                detail.damageImmunities(),
                detail.conditionImmunities(),
                detail.senses(),
                detail.passivePerception(),
                detail.languages(),
                detail.legendaryActionCount(),
                detail.actions().stream()
                        .map(action -> new CreatureActionDetail(
                                action.actionType(),
                                action.name(),
                                action.description(),
                                action.toHitBonus()))
                        .toList());
    }
}
