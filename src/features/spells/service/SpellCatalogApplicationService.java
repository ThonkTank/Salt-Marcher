package features.spells.service;

import database.DatabaseManager;
import features.spells.api.SpellCatalogService;
import features.spells.model.Spell;
import features.spells.repository.SpellRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class SpellCatalogApplicationService {
    private static final Logger LOGGER = Logger.getLogger(SpellCatalogApplicationService.class.getName());

    private SpellCatalogApplicationService() {
        throw new AssertionError("No instances");
    }

    public static SpellCatalogService.ServiceResult<SpellCatalogService.FilterOptions> loadFilterOptions() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return SpellCatalogService.ServiceResult.ok(new SpellCatalogService.FilterOptions(
                    SpellRepository.getDistinctLevels(conn),
                    SpellRepository.getDistinctSchools(conn),
                    SpellRepository.getDistinctClasses(conn),
                    SpellRepository.getDistinctTags(conn),
                    SpellRepository.getDistinctSources(conn)));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "SpellCatalogApplicationService.loadFilterOptions(): DB access failed", e);
            return SpellCatalogService.ServiceResult.dbAccessFailed(
                    new SpellCatalogService.FilterOptions(List.of(), List.of(), List.of(), List.of(), List.of()));
        }
    }

    public static SpellCatalogService.ServiceResult<SpellCatalogService.PageResult> searchSpells(
            SpellCatalogService.FilterCriteria criteria,
            SpellCatalogService.PageRequest pageRequest) {
        SpellCatalogService.FilterCriteria effectiveCriteria =
                criteria != null ? criteria : SpellCatalogService.FilterCriteria.empty();
        SpellCatalogService.PageRequest effectivePage =
                pageRequest != null ? pageRequest : new SpellCatalogService.PageRequest("name", "ASC", 50, 0);
        try (Connection conn = DatabaseManager.getConnection()) {
            SpellRepository.SearchResult result = SpellRepository.searchWithFiltersAndCount(
                    conn,
                    effectiveCriteria.nameQuery(),
                    effectiveCriteria.ritualOnly(),
                    effectiveCriteria.concentrationOnly(),
                    effectiveCriteria.levels(),
                    effectiveCriteria.schools(),
                    effectiveCriteria.classes(),
                    effectiveCriteria.tags(),
                    effectiveCriteria.sources(),
                    effectivePage.sortColumn(),
                    effectivePage.sortDirection(),
                    effectivePage.limit(),
                    effectivePage.offset());
            return SpellCatalogService.ServiceResult.ok(new SpellCatalogService.PageResult(
                    result.spells().stream().map(SpellCatalogApplicationService::toSummary).toList(),
                    result.totalCount()));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "SpellCatalogApplicationService.searchSpells(): DB access failed", e);
            return SpellCatalogService.ServiceResult.dbAccessFailed(new SpellCatalogService.PageResult(List.of(), 0));
        }
    }

    public static SpellCatalogService.ServiceResult<SpellCatalogService.SpellDetails> getSpell(Long spellId) {
        try (Connection conn = DatabaseManager.getConnection()) {
            Spell spell = SpellRepository.getSpell(conn, spellId);
            return SpellCatalogService.ServiceResult.ok(spell != null ? toDetails(spell) : null);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "SpellCatalogApplicationService.getSpell(): DB access failed", e);
            return SpellCatalogService.ServiceResult.dbAccessFailed(null);
        }
    }

    private static SpellCatalogService.SpellSummary toSummary(Spell spell) {
        return new SpellCatalogService.SpellSummary(
                spell.Id != null ? spell.Id : -1L,
                spell.Name,
                spell.Level,
                spell.School,
                spell.ClassesText,
                spell.Ritual,
                spell.Concentration,
                spell.Source);
    }

    private static SpellCatalogService.SpellDetails toDetails(Spell spell) {
        return new SpellCatalogService.SpellDetails(
                spell.Id,
                spell.Name,
                spell.Source,
                spell.Level,
                spell.School,
                spell.CastingTime,
                spell.RangeText,
                spell.DurationText,
                spell.Ritual,
                spell.Concentration,
                spell.ComponentsText,
                spell.MaterialComponentText,
                spell.ClassesText,
                spell.AttackOrSaveText,
                spell.DamageEffectText,
                spell.Description,
                spell.HigherLevelsText,
                spell.Tags == null ? List.of() : List.copyOf(spell.Tags));
    }
}
