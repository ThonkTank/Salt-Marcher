package features.spells.catalog.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadSpellInput(Long spellId) {

    public record SpellDetailsInput(
            long spellId,
            String name,
            String source,
            int level,
            String school,
            String castingTime,
            String rangeText,
            String durationText,
            boolean ritual,
            boolean concentration,
            String componentsText,
            String materialComponentText,
            String classesText,
            String attackOrSaveText,
            String damageEffectText,
            String description,
            String higherLevelsText,
            List<String> tags
    ) {
    }

    public record LoadedSpellInput(boolean success, SpellDetailsInput spell) {
    }
}
