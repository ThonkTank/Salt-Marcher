package features.spells.catalog;

import database.DatabaseManager;
import features.spells.catalog.input.LoadFilterOptionsInput;
import features.spells.catalog.input.LoadSpellInput;
import features.spells.catalog.input.SearchSpellsInput;
import features.spells.model.Spell;
import features.spells.repository.SpellRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Canonical root seam for spell catalog reads shared by shell and spell-owned
 * catalog surfaces.
 */
@SuppressWarnings("unused")
public final class CatalogObject {
    private static final Logger LOGGER = Logger.getLogger(CatalogObject.class.getName());

    public LoadFilterOptionsInput.LoadedFilterOptionsInput loadFilterOptions(LoadFilterOptionsInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new LoadFilterOptionsInput.LoadedFilterOptionsInput(
                    true,
                    SpellRepository.getDistinctLevels(conn),
                    SpellRepository.getDistinctSchools(conn),
                    SpellRepository.getDistinctClasses(conn),
                    SpellRepository.getDistinctTags(conn),
                    SpellRepository.getDistinctSources(conn));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CatalogObject.loadFilterOptions(): DB access failed", e);
            return new LoadFilterOptionsInput.LoadedFilterOptionsInput(
                    false,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of());
        }
    }

    public SearchSpellsInput.SearchedSpellsInput searchSpells(SearchSpellsInput input) {
        SearchSpellsInput.CriteriaInput criteria = input.criteria() != null
                ? input.criteria()
                : new SearchSpellsInput.CriteriaInput(
                        null,
                        false,
                        false,
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of());
        SearchSpellsInput.PageInput page = input.page() != null
                ? input.page()
                : new SearchSpellsInput.PageInput("name", "ASC", 50, 0);
        try (Connection conn = DatabaseManager.getConnection()) {
            SpellRepository.SearchResult result = SpellRepository.searchWithFiltersAndCount(
                    conn,
                    criteria.nameQuery(),
                    criteria.ritualOnly(),
                    criteria.concentrationOnly(),
                    criteria.levels(),
                    criteria.schools(),
                    criteria.classes(),
                    criteria.tags(),
                    criteria.sources(),
                    page.sortColumn(),
                    page.sortDirection(),
                    page.limit(),
                    page.offset());
            return new SearchSpellsInput.SearchedSpellsInput(
                    true,
                    result.spells().stream().map(CatalogObject::toSummary).toList(),
                    result.totalCount());
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CatalogObject.searchSpells(): DB access failed", e);
            return new SearchSpellsInput.SearchedSpellsInput(false, List.of(), 0);
        }
    }

    public LoadSpellInput.LoadedSpellInput loadSpell(LoadSpellInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            Spell spell = SpellRepository.getSpell(conn, input.spellId());
            return new LoadSpellInput.LoadedSpellInput(
                    true,
                    spell != null ? toDetails(spell) : null);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CatalogObject.loadSpell(): DB access failed", e);
            return new LoadSpellInput.LoadedSpellInput(false, null);
        }
    }

    private static SearchSpellsInput.SpellSummaryInput toSummary(Spell spell) {
        return new SearchSpellsInput.SpellSummaryInput(
                spell.Id != null ? spell.Id : -1L,
                spell.Name,
                spell.Level,
                spell.School,
                spell.ClassesText,
                spell.Ritual,
                spell.Concentration,
                spell.Source);
    }

    private static LoadSpellInput.SpellDetailsInput toDetails(Spell spell) {
        return new LoadSpellInput.SpellDetailsInput(
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
