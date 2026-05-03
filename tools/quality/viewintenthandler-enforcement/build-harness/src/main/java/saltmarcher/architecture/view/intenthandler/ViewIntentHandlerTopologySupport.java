package saltmarcher.architecture.view.intenthandler;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import saltmarcher.architecture.SourceFile;

final class ViewIntentHandlerTopologySupport {

    private static final Set<String> ACTIVE_AREAS = Set.of("leftbartabs", "statetabs", "dropdowns");

    private ViewIntentHandlerTopologySupport() {
    }

    static Map<ViewUnit, List<SourceFile>> groupByUnit(List<SourceFile> sourceFiles) {
        Map<ViewUnit, List<SourceFile>> sourcesByUnit = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            ViewUnit unit = viewUnit(sourceFile);
            if (unit != null) {
                sourcesByUnit.computeIfAbsent(unit, ignored -> new ArrayList<>()).add(sourceFile);
            }
        }
        return sourcesByUnit;
    }

    static boolean isIntentHandlerFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("IntentHandler.java");
    }

    static boolean isActiveRoot(ViewUnit unit) {
        return ACTIVE_AREAS.contains(unit.area());
    }

    static boolean isSlotcontent(ViewUnit unit) {
        return "slotcontent".equals(unit.area());
    }

    private static ViewUnit viewUnit(SourceFile sourceFile) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() < 4
                || !"src".equals(segments.get(0))
                || !"view".equals(segments.get(1))) {
            return null;
        }
        String area = segments.get(2);
        if ("slotcontent".equals(area) && segments.size() >= 5) {
            return new ViewUnit(area, segments.get(3), segments.get(4));
        }
        if (ACTIVE_AREAS.contains(area) && segments.size() >= 4) {
            return new ViewUnit(area, null, segments.get(3));
        }
        return null;
    }

    record ViewUnit(String area, String slot, String entry) implements Comparable<ViewUnit> {
        String source() {
            if (slot == null) {
                return "src/view/" + area + "/" + entry;
            }
            return "src/view/" + area + "/" + slot + "/" + entry;
        }

        @Override
        public int compareTo(ViewUnit other) {
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
}
