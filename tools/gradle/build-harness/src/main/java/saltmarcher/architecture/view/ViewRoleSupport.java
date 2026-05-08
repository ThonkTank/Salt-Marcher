package saltmarcher.architecture.view;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import saltmarcher.architecture.SourceFile;

public final class ViewRoleSupport {

    private static final Set<String> ACTIVE_AREAS = Set.of("leftbartabs", "statetabs", "dropdowns");
    private static final Set<String> SLOTCONTENT_SLOTS = Set.of(
            "controls", "main", "state", "details", "topbar", "primitives");

    private ViewRoleSupport() {
    }

    public static Map<ViewUnit, List<SourceFile>> groupByUnit(List<SourceFile> sourceFiles) {
        Map<ViewUnit, List<SourceFile>> sourcesByRoot = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            ViewUnit unit = viewUnit(sourceFile);
            if (unit != null) {
                sourcesByRoot.computeIfAbsent(unit, ignored -> new ArrayList<>()).add(sourceFile);
            }
        }
        return sourcesByRoot;
    }

    public static ViewUnit viewUnit(SourceFile sourceFile) {
        List<String> segments = sourceFile.relativeSegments();
        if (!isViewSource(sourceFile)) {
            return null;
        }
        String area = segments.get(2);
        if ("slotcontent".equals(area) && isRecognizedSlotcontentSource(sourceFile)) {
            return new ViewUnit(area, segments.get(3), segments.get(4));
        }
        if (ACTIVE_AREAS.contains(area) && isRecognizedActiveRootSource(sourceFile)) {
            return new ViewUnit(area, null, segments.get(3));
        }
        return null;
    }

    public static boolean isViewSource(SourceFile sourceFile) {
        List<String> segments = sourceFile.relativeSegments();
        return segments.size() >= 4
                && "src".equals(segments.get(0))
                && "view".equals(segments.get(1));
    }

    public static boolean isRecognizedViewSource(SourceFile sourceFile) {
        return isRecognizedActiveRootSource(sourceFile) || isRecognizedSlotcontentSource(sourceFile);
    }

    public static boolean isRecognizedActiveRootSource(SourceFile sourceFile) {
        List<String> segments = sourceFile.relativeSegments();
        return isViewSource(sourceFile)
                && segments.size() == 5
                && ACTIVE_AREAS.contains(segments.get(2));
    }

    public static boolean isRecognizedSlotcontentSource(SourceFile sourceFile) {
        List<String> segments = sourceFile.relativeSegments();
        return isViewSource(sourceFile)
                && segments.size() == 6
                && "slotcontent".equals(segments.get(2))
                && SLOTCONTENT_SLOTS.contains(segments.get(3));
    }

    public static Set<String> slotcontentSlots() {
        return SLOTCONTENT_SLOTS;
    }

    public static boolean isActiveRoot(ViewUnit unit) {
        return ACTIVE_AREAS.contains(unit.area());
    }

    public static boolean isSlotcontent(ViewUnit unit) {
        return "slotcontent".equals(unit.area());
    }

    public static boolean isPrimitiveUnit(ViewUnit unit) {
        return isSlotcontent(unit) && "primitives".equals(unit.slot());
    }

    public static boolean requiresContribution(ViewUnit unit) {
        return ACTIVE_AREAS.contains(unit.area());
    }

    public static boolean isContributionFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("Contribution.java");
    }

    public static boolean isLegacyViewModelFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("ViewModel.java")
                || sourceFile.fileName().endsWith("PresentationModel.java");
    }

    public static boolean isContributionModelFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("ContributionModel.java");
    }

    public static boolean isContentModelFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("ContentModel.java");
    }

    public static boolean isProjectionModelFile(SourceFile sourceFile) {
        return isContributionModelFile(sourceFile) || isContentModelFile(sourceFile);
    }

    public static boolean isIntentHandlerFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("IntentHandler.java");
    }

    public static boolean isBinderFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("Binder.java");
    }

    public static boolean isPassiveViewFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("View.java")
                && !sourceFile.fileName().endsWith("ViewModel.java")
                && !sourceFile.fileName().endsWith("PresentationModel.java")
                && !sourceFile.fileName().endsWith("ContributionModel.java")
                && !sourceFile.fileName().endsWith("ContentModel.java");
    }

    public static boolean isPublishedEventFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("PublishedEvent.java");
    }

    public static boolean isViewInputEventFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("ViewInputEvent.java");
    }

    public static String passiveViewStem(SourceFile sourceFile) {
        if (!isPassiveViewFile(sourceFile)) {
            return "";
        }
        return sourceFile.fileName().substring(0, sourceFile.fileName().length() - "View.java".length());
    }

    public static String publishedEventStem(SourceFile sourceFile) {
        if (!isPublishedEventFile(sourceFile)) {
            return "";
        }
        return sourceFile.fileName().substring(0, sourceFile.fileName().length() - "PublishedEvent.java".length());
    }

    public static String viewInputEventStem(SourceFile sourceFile) {
        if (!isViewInputEventFile(sourceFile)) {
            return "";
        }
        return sourceFile.fileName().substring(0, sourceFile.fileName().length() - "ViewInputEvent.java".length());
    }

    public static Set<String> passiveViewStems(List<SourceFile> sourceFiles) {
        Set<String> stems = new LinkedHashSet<>();
        for (SourceFile sourceFile : sourceFiles) {
            String stem = passiveViewStem(sourceFile);
            if (!stem.isBlank()) {
                stems.add(stem);
            }
        }
        return stems;
    }

    public static Set<String> publishedEventStems(List<SourceFile> sourceFiles) {
        Set<String> stems = new LinkedHashSet<>();
        for (SourceFile sourceFile : sourceFiles) {
            String stem = publishedEventStem(sourceFile);
            if (!stem.isBlank()) {
                stems.add(stem);
            }
        }
        return stems;
    }

    public static Set<String> viewInputEventStems(List<SourceFile> sourceFiles) {
        Set<String> stems = new LinkedHashSet<>();
        for (SourceFile sourceFile : sourceFiles) {
            String stem = viewInputEventStem(sourceFile);
            if (!stem.isBlank()) {
                stems.add(stem);
            }
        }
        return stems;
    }

    public static boolean isInspectorEntryFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("InspectorEntry.java");
    }

    public static boolean isProjectorFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("Projector.java");
    }

    public record ViewUnit(String area, String slot, String entry) implements Comparable<ViewUnit> {
        public String source() {
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
