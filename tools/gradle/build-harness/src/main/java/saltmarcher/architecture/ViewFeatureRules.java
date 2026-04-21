package saltmarcher.architecture;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

final class ViewFeatureRules implements ArchitectureRule {

    private static final Set<String> REQUIRED_CONTRIBUTION_AREAS = Set.of("leftbartabs", "statetabs");
    private static final Set<String> ACTIVE_AREAS = Set.of("leftbartabs", "statetabs", "dropdowns");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewRoot, List<SourceFile>> sourcesByRoot = new TreeMap<>();
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            List<String> segments = sourceFile.relativeSegments();
            if (segments.size() < 4 || !segments.get(0).equals("src") || !segments.get(1).equals("view")) {
                continue;
            }
            String area = segments.get(2);
            if (area.equals("slotcontent")) {
                validateSlotcontent(sourceFile, violations);
                continue;
            }
            if (!ACTIVE_AREAS.contains(area) || segments.size() < 5) {
                continue;
            }
            sourcesByRoot.computeIfAbsent(new ViewRoot(area, segments.get(3)), ignored -> new ArrayList<>())
                    .add(sourceFile);
        }

        for (Map.Entry<ViewRoot, List<SourceFile>> entry : sourcesByRoot.entrySet()) {
            validateRoot(entry.getKey(), entry.getValue(), violations);
        }
    }

    private static void validateSlotcontent(SourceFile sourceFile, ViolationSink violations) {
        if (isContributionFile(sourceFile) || isBinderFile(sourceFile)) {
            violations.add(sourceFile.relativePath(), "view-slotcontent-no-shell-entrypoints",
                    "Slotcontent roots are reusable passive content and must not define *Contribution.java or *Binder.java files.");
            return;
        }
        if (!isPassiveViewFile(sourceFile)
                && !isViewModelFile(sourceFile)
                && !isReusableDisplayModelFile(sourceFile)
                && !isInspectorEntryFile(sourceFile)) {
            violations.add(sourceFile.relativePath(), "view-slotcontent-root-shape",
                    "Slotcontent sources must be passive *View.java files, optional *ViewModel.java files, reusable *DisplayModel.java files, or *InspectorEntry.java adapters.");
        }
    }

    private static void validateRoot(ViewRoot root, List<SourceFile> files, ViolationSink violations) {
        long contributionCount = files.stream().filter(ViewFeatureRules::isContributionFile).count();
        long binderCount = files.stream().filter(ViewFeatureRules::isBinderFile).count();
        long viewModelCount = files.stream().filter(ViewFeatureRules::isViewModelFile).count();

        for (SourceFile sourceFile : files) {
            validateAllowedRoleFile(root, sourceFile, violations);
        }

        if (root.requiresContribution()) {
            if (contributionCount != 1) {
                violations.add(root.source(), "view-root-composition",
                        "Left-bar and state tab roots must contain exactly one shell-discovered *Contribution.java file.");
            }
        } else if (contributionCount > 1) {
            violations.add(root.source(), "view-dropdown-optional-contribution",
                    "Dropdown roots may contain zero or one shell-discovered *Contribution.java file.");
        }

        if (binderCount != 1) {
            violations.add(root.source(), "view-root-composition",
                    "Each active view root must contain exactly one *Binder.java lifecycle and wiring owner.");
        }

        if (viewModelCount != 1) {
            violations.add(root.source(), "view-root-composition",
                    "Each active view root must contain exactly one aggregate *ViewModel.java file.");
        }
    }

    private static void validateAllowedRoleFile(ViewRoot root, SourceFile sourceFile, ViolationSink violations) {
        if (isReusableDisplayModelFile(sourceFile)) {
            violations.add(sourceFile.relativePath(), "view-active-root-no-display-model",
                    "Active view roots own aggregate *ViewModel.java files; reusable *DisplayModel.java files belong under src/view/slotcontent/<slot>/<entry>/.");
            return;
        }
        if (isViewModelFile(sourceFile) || isPassiveViewFile(sourceFile) || isBinderFile(sourceFile)) {
            return;
        }
        if (isContributionFile(sourceFile)) {
            return;
        }
        violations.add(sourceFile.relativePath(), "view-root-file-role",
                "Active view roots may contain only an optional or required *Contribution.java entrypoint, one *Binder.java, one *ViewModel.java, and passive *View.java files.");
    }

    private static boolean isContributionFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("Contribution.java");
    }

    private static boolean isViewModelFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("ViewModel.java");
    }

    private static boolean isBinderFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("Binder.java");
    }

    private static boolean isPassiveViewFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("View.java")
                && !sourceFile.fileName().endsWith("ViewModel.java");
    }

    private static boolean isReusableDisplayModelFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("DisplayModel.java");
    }

    private static boolean isInspectorEntryFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("InspectorEntry.java");
    }

    private record ViewRoot(String area, String entry) implements Comparable<ViewRoot> {
        boolean requiresContribution() {
            return REQUIRED_CONTRIBUTION_AREAS.contains(area);
        }

        String source() {
            return "src/view/" + area + "/" + entry;
        }

        @Override
        public int compareTo(ViewRoot other) {
            int areaComparison = area.compareTo(other.area);
            if (areaComparison != 0) {
                return areaComparison;
            }
            return entry.compareTo(other.entry);
        }
    }
}
