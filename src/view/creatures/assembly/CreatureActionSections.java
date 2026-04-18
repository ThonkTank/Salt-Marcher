package src.view.creatures.assembly;

import javafx.scene.Node;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureActionDetail;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class CreatureActionSections {

    private CreatureActionSections() {
    }

    static @Nullable Node build(List<CreatureActionDetail> actions) {
        if (actions == null || actions.isEmpty()) {
            return null;
        }
        Map<String, List<CreatureActionDetail>> grouped = new LinkedHashMap<>();
        for (CreatureActionDetail action : actions) {
            grouped.computeIfAbsent(sectionTitle(action.actionType()), ignored -> new java.util.ArrayList<>()).add(action);
        }
        VBox sections = new VBox(10);
        for (Map.Entry<String, List<CreatureActionDetail>> entry : grouped.entrySet()) {
            VBox section = CreatureInspectorNodes.section(entry.getKey());
            for (CreatureActionDetail action : entry.getValue()) {
                section.getChildren().add(CreatureInspectorNodes.labeled(action.name(), description(action)));
            }
            sections.getChildren().add(section);
        }
        return sections;
    }

    private static String sectionTitle(String actionType) {
        if (actionType == null || actionType.isBlank()) {
            return "Actions";
        }
        return switch (actionType) {
            case "trait" -> "Traits";
            case "bonus_action" -> "Bonus Actions";
            case "reaction" -> "Reactions";
            case "legendary_action" -> "Legendary Actions";
            default -> "Actions";
        };
    }

    private static String description(CreatureActionDetail action) {
        String description = action.description() == null ? "" : action.description().trim();
        if (action.toHitBonus() == null) {
            return description.isEmpty() ? "—" : description;
        }
        String prefix = action.toHitBonus() >= 0 ? "To hit +" + action.toHitBonus() : "To hit " + action.toHitBonus();
        return description.isEmpty() ? prefix : prefix + " | " + description;
    }
}
