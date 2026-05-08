package saltmarcher.architecture.view;

public record ViewUnitDescriptor(
        ViewUnitKind kind,
        String area,
        String slot,
        String entry
) implements Comparable<ViewUnitDescriptor> {

    public String source() {
        if (kind == ViewUnitKind.ACTIVE_ROOT) {
            return "src/view/" + area + "/" + entry;
        }
        return "src/view/slotcontent/" + slot + "/" + entry;
    }

    @Override
    public int compareTo(ViewUnitDescriptor other) {
        int kindComparison = kind.compareTo(other.kind);
        if (kindComparison != 0) {
            return kindComparison;
        }
        int areaComparison = area.compareTo(other.area);
        if (areaComparison != 0) {
            return areaComparison;
        }
        if (slot == null && other.slot != null) {
            return -1;
        }
        if (slot != null && other.slot == null) {
            return 1;
        }
        if (slot != null) {
            int slotComparison = slot.compareTo(other.slot);
            if (slotComparison != 0) {
                return slotComparison;
            }
        }
        return entry.compareTo(other.entry);
    }
}
