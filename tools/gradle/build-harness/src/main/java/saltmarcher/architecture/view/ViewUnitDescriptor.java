package saltmarcher.architecture.view;

public record ViewUnitDescriptor(
        ViewUnitKind kind,
        String group,
        String entry
) implements Comparable<ViewUnitDescriptor> {

    public String source() {
        if (kind == ViewUnitKind.ACTIVE_ROOT) {
            return "src/view/" + group + "/" + entry;
        }
        return "src/view/slotcontent/" + group + "/" + entry;
    }

    @Override
    public int compareTo(ViewUnitDescriptor other) {
        int kindComparison = kind.compareTo(other.kind);
        if (kindComparison != 0) {
            return kindComparison;
        }
        int groupComparison = group.compareTo(other.group);
        if (groupComparison != 0) {
            return groupComparison;
        }
        return entry.compareTo(other.entry);
    }
}
