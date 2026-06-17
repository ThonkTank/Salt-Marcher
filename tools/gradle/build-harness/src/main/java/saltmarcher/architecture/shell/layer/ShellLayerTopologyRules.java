package saltmarcher.architecture.shell.layer;

import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class ShellLayerTopologyRules implements ArchitectureRule {

    private static final Set<String> SHELL_API_PUBLIC_SURFACE_ALLOWLIST =
            Set.of(
                    "ContributionKey.java",
                    "InspectorEntrySpec.java",
                    "InspectorSink.java",
                    "NavigationGraphicResource.java",
                    "NavigationGroupSpec.java",
                    "ServiceContribution.java",
                    "ServiceRegistry.java",
                    "ShellBinding.java",
                    "ShellControls.java",
                    "ShellContribution.java",
                    "ShellContributionSpec.java",
                    "ShellRuntimeContext.java",
                    "ShellStateTabSpec.java",
                    "ShellSlot.java",
                    "ShellLeftBarTabMode.java",
                    "ShellLeftBarTabSpec.java",
                    "ShellTopBarSpec.java");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        List<SourceFile> sourceFiles = context.sourceFiles(violations);
        validateShellLayout(sourceFiles, violations);
        validateShellApiPublicSurface(sourceFiles, violations);
    }

    private void validateShellLayout(List<SourceFile> sourceFiles, ViolationSink violations) {
        for (SourceFile sourceFile : sourceFiles) {
            List<String> segments = sourceFile.relativeSegments();
            if (segments.isEmpty() || !"shell".equals(segments.getFirst())) {
                continue;
            }
            if (segments.size() < 2 || !Set.of("api", "host").contains(segments.get(1))) {
                violations.add(sourceFile.relativePath(), "shell-layout",
                        "Shell sources must live under shell/api or shell/host.");
            }
        }
    }

    private void validateShellApiPublicSurface(List<SourceFile> sourceFiles, ViolationSink violations) {
        TreeSet<String> actualFiles = sourceFiles.stream()
                .filter(sourceFile -> sourceFile.relativeSegments().size() == 3)
                .filter(sourceFile -> sourceFile.relativeSegments().get(0).equals("shell"))
                .filter(sourceFile -> sourceFile.relativeSegments().get(1).equals("api"))
                .map(SourceFile::fileName)
                .collect(Collectors.toCollection(TreeSet::new));

        TreeSet<String> missingFiles = new TreeSet<>(SHELL_API_PUBLIC_SURFACE_ALLOWLIST);
        missingFiles.removeAll(actualFiles);
        for (String missingFile : missingFiles) {
            violations.add("shell/api/" + missingFile, "shell-api-public-surface-allowlist",
                    "The public shell workbench contract must keep the fixed shell/api surface. Missing expected API file.");
        }

        TreeSet<String> extraFiles = new TreeSet<>(actualFiles);
        extraFiles.removeAll(SHELL_API_PUBLIC_SURFACE_ALLOWLIST);
        for (String extraFile : extraFiles) {
            violations.add("shell/api/" + extraFile, "shell-api-public-surface-allowlist",
                    "Do not add new public shell/api extension points without updating the passive workbench contract and enforcement coverage.");
        }
    }
}
