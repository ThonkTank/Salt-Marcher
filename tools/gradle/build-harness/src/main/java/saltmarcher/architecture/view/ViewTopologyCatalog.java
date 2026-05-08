package saltmarcher.architecture.view;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import saltmarcher.architecture.SourceFile;

public final class ViewTopologyCatalog {

    private static final Set<String> ACTIVE_AREAS = Set.of("leftbartabs", "statetabs", "dropdowns");
    private static final Set<String> SLOTCONTENT_SLOTS = Set.of(
            "controls", "main", "state", "details", "topbar", "primitives");

    private ViewTopologyCatalog() {
    }

    public static boolean isViewSource(SourceFile sourceFile) {
        List<String> segments = sourceFile.relativeSegments();
        return segments.size() >= 4
                && "src".equals(segments.get(0))
                && "view".equals(segments.get(1));
    }

    public static ViewSourceDescriptor describe(SourceFile sourceFile) {
        if (!isViewSource(sourceFile)) {
            return new ViewSourceDescriptor(sourceFile, null, ViewRole.UNKNOWN, false);
        }
        ViewRole role = ViewRole.fromFileName(sourceFile.fileName());
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() == 5 && ACTIVE_AREAS.contains(segments.get(2))) {
            return new ViewSourceDescriptor(
                    sourceFile,
                    new ViewUnitDescriptor(ViewUnitKind.ACTIVE_ROOT, segments.get(2), null, segments.get(3)),
                    role,
                    true);
        }
        if (segments.size() == 6
                && "slotcontent".equals(segments.get(2))
                && SLOTCONTENT_SLOTS.contains(segments.get(3))) {
            return new ViewSourceDescriptor(
                    sourceFile,
                    new ViewUnitDescriptor(
                            ViewUnitKind.REUSABLE_SLOTCONTENT,
                            "slotcontent",
                            segments.get(3),
                            segments.get(4)),
                    role,
                    true);
        }
        return new ViewSourceDescriptor(sourceFile, null, role, false);
    }

    public static List<ViewSourceDescriptor> describeViewSources(List<SourceFile> sourceFiles) {
        List<ViewSourceDescriptor> descriptors = new ArrayList<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (!isViewSource(sourceFile)) {
                continue;
            }
            descriptors.add(describe(sourceFile));
        }
        return List.copyOf(descriptors);
    }

    public static Map<ViewUnitDescriptor, List<ViewSourceDescriptor>> groupRecognizedUnits(List<SourceFile> sourceFiles) {
        Map<ViewUnitDescriptor, List<ViewSourceDescriptor>> sourcesByUnit = new TreeMap<>();
        for (ViewSourceDescriptor descriptor : describeViewSources(sourceFiles)) {
            if (!descriptor.isRecognizedViewSource()) {
                continue;
            }
            sourcesByUnit.computeIfAbsent(descriptor.unit(), ignored -> new ArrayList<>()).add(descriptor);
        }
        return sourcesByUnit;
    }
}
