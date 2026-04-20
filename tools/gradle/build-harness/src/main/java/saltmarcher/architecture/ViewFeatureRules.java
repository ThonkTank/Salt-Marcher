package saltmarcher.architecture;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

final class ViewFeatureRules implements ArchitectureRule {

    private static final Set<String> DISCOVERED_AREAS = Set.of("tabs", "topbar", "state");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewRoot, List<SourceFile>> sourcesByRoot = new TreeMap<>();
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            List<String> segments = sourceFile.relativeSegments();
            if (segments.size() < 4 || !segments.get(0).equals("src") || !segments.get(1).equals("view")) {
                continue;
            }
            String area = segments.get(2);
            if (area.equals("views")) {
                validateReusableView(sourceFile, violations);
                continue;
            }
            if (!Set.of("tabs", "topbar", "state", "details").contains(area) || segments.size() < 5) {
                continue;
            }
            sourcesByRoot.computeIfAbsent(new ViewRoot(area, segments.get(3)), ignored -> new ArrayList<>())
                    .add(sourceFile);
        }

        for (Map.Entry<ViewRoot, List<SourceFile>> entry : sourcesByRoot.entrySet()) {
            validateRoot(entry.getKey(), entry.getValue(), violations);
        }
    }

    private static void validateReusableView(SourceFile sourceFile, ViolationSink violations) {
        if (!isReusableViewFile(sourceFile) && !isReusableDisplayModelFile(sourceFile)) {
            violations.add(sourceFile.relativePath(), "view-reusable-root-shape",
                    "Reusable generic view sources under src/view/views must be passive *View.java files or reusable *DisplayModel.java files.");
        }
    }

    private static void validateRoot(ViewRoot root, List<SourceFile> files, ViolationSink violations) {
        long contributionCount = files.stream().filter(ViewFeatureRules::isContributionFile).count();
        long viewModelCount = files.stream().filter(ViewFeatureRules::isViewModelFile).count();
        long viewCount = files.stream().filter(ViewFeatureRules::isPassiveViewFile).count();

        for (SourceFile sourceFile : files) {
            validateAllowedRoleFile(root, sourceFile, violations);
        }

        if (root.isDiscoveredContributionRoot()) {
            if (contributionCount != 1) {
                violations.add(root.source(), "view-root-composition",
                        "Discoverable view roots under src/view/tabs, src/view/topbar, and src/view/state must contain exactly one *Contribution.java file.");
            }
        } else if (contributionCount != 0) {
            violations.add(root.source(), "view-details-no-contribution-root",
                    "Detail roots under src/view/details must not contain bootstrap-discovered *Contribution.java files.");
        }

        if (viewModelCount != 1) {
            violations.add(root.source(), "view-root-composition",
                    "Each view contribution or detail root must contain exactly one co-located *ViewModel.java file.");
        }
        if (viewCount < 1) {
            violations.add(root.source(), "view-root-composition",
                    "Each view contribution or detail root must contain at least one passive *View.java file.");
        }
    }

    private static void validateAllowedRoleFile(ViewRoot root, SourceFile sourceFile, ViolationSink violations) {
        if (isViewModelFile(sourceFile) || isPassiveViewFile(sourceFile)) {
            return;
        }
        if (root.isDiscoveredContributionRoot() && isContributionFile(sourceFile)) {
            return;
        }
        if (!root.isDiscoveredContributionRoot() && isContributionFile(sourceFile)) {
            return;
        }
        violations.add(sourceFile.relativePath(), "view-root-file-role",
                "View roots may contain only their *Contribution.java entrypoint where discoverable, one *ViewModel.java, and passive *View.java files.");
    }

    private static boolean isContributionFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("Contribution.java");
    }

    private static boolean isViewModelFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("ViewModel.java");
    }

    private static boolean isPassiveViewFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("View.java")
                && !sourceFile.fileName().endsWith("ViewModel.java");
    }

    private static boolean isReusableViewFile(SourceFile sourceFile) {
        return isPassiveViewFile(sourceFile);
    }

    private static boolean isReusableDisplayModelFile(SourceFile sourceFile) {
        return sourceFile.fileName().endsWith("DisplayModel.java");
    }

    private record ViewRoot(String area, String entry) implements Comparable<ViewRoot> {
        boolean isDiscoveredContributionRoot() {
            return DISCOVERED_AREAS.contains(area);
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
