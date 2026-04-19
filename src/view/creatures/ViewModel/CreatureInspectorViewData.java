package src.view.creatures.ViewModel;

import java.util.List;
import java.util.Objects;

public record CreatureInspectorViewData(List<Section> sections) {

    public CreatureInspectorViewData {
        sections = List.copyOf(Objects.requireNonNull(sections, "sections"));
    }

    public record Section(String title, List<Field> fields) {

        public Section {
            Objects.requireNonNull(title, "title");
            fields = List.copyOf(Objects.requireNonNull(fields, "fields"));
        }
    }

    public record Field(String label, String value) {

        public Field {
            Objects.requireNonNull(label, "label");
        }
    }
}
