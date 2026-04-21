package src.view.slotcontent.details.creature;

import java.util.List;

public record CreatureDetailsDisplayModel(
        String name,
        String meta,
        List<PropertyLine> coreProperties,
        List<AbilityScore> abilities,
        List<PropertyLine> properties,
        List<ActionGroup> sections
) {
    public CreatureDetailsDisplayModel {
        coreProperties = coreProperties == null ? List.of() : List.copyOf(coreProperties);
        abilities = abilities == null ? List.of() : List.copyOf(abilities);
        properties = properties == null ? List.of() : List.copyOf(properties);
        sections = sections == null ? List.of() : List.copyOf(sections);
    }

    public record PropertyLine(String label, String value) {
    }

    public record AbilityScore(String label, String value) {
    }

    public record ActionGroup(String title, String description, List<ActionLine> actions) {
        public ActionGroup {
            actions = actions == null ? List.of() : List.copyOf(actions);
        }
    }

    public record ActionLine(String name, String description) {
    }
}
