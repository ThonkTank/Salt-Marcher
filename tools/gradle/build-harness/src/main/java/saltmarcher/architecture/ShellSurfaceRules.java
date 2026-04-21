package saltmarcher.architecture;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

final class ShellSurfaceRules implements ArchitectureRule {

    private static final Pattern SHELL_LEFT_BAR_TAB_SPEC_CONSTRUCTOR_PATTERN =
            Pattern.compile("\\bnew\\s+(?:shell\\.api\\.)?ShellLeftBarTabSpec\\s*\\(");
    private static final Set<String> SHELL_API_PUBLIC_SURFACE_ALLOWLIST =
            Set.of(
                    "ContributionKey.java",
                    "InspectorEntrySpec.java",
                    "InspectorSink.java",
                    "NavigationGraphicSupport.java",
                    "NavigationGroupSpec.java",
                    "ServiceContribution.java",
                    "ServiceRegistry.java",
                    "ShellBinding.java",
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
        validateShellApiPublicSurface(sourceFiles, violations);
        validateViewModelContributionPlacementAndStartup(sourceFiles, violations);
        validateServiceContributionPlacement(sourceFiles, violations);
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

    private void validateViewModelContributionPlacementAndStartup(
            List<SourceFile> sourceFiles,
            ViolationSink violations) {
        List<SourceFile> defaultLandingRoots = new ArrayList<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.fileName().endsWith("ViewContribution.java")
                    && sourceFile.relativePath().startsWith("src/view/")) {
                violations.add(sourceFile.relativePath(), "shell-view-contribution-placement",
                        "View-layer shell contributions must use *Contribution.java under src/view/leftbartabs, src/view/statetabs, or src/view/dropdowns; *ViewContribution implementations are forbidden.");
            }

            if (sourceFile.kind() != SourceKind.VIEW_CONTRIBUTION) {
                continue;
            }
            if (sourceFile.relativePath().startsWith("src/view/slotcontent/")) {
                violations.add(sourceFile.relativePath(), "shell-view-contribution-placement",
                        "Slotcontent entries are composed by active-root Binders and must not be bootstrap-discovered view contributions.");
                continue;
            }
            for (List<String> arguments : shellTabSpecArgumentLists(sourceFile.content())) {
                if (arguments.size() < 4) {
                    violations.add(sourceFile.relativePath(), "shell-tab-default-landing-literal",
                            "ShellLeftBarTabSpec root metadata must expose a literal defaultLanding argument.");
                    continue;
                }
                String defaultLanding = arguments.get(3).trim();
                if (defaultLanding.equals("true")) {
                    defaultLandingRoots.add(sourceFile);
                    continue;
                }
                if (!defaultLanding.equals("false")) {
                    violations.add(sourceFile.relativePath(), "shell-tab-default-landing-literal",
                            "ShellLeftBarTabSpec defaultLanding must be the literal true or false so startup uniqueness can be enforced.");
                }
            }
        }

        if (defaultLandingRoots.size() > 1) {
            String files = defaultLandingRoots.stream()
                    .map(SourceFile::relativePath)
                    .sorted()
                    .collect(Collectors.joining(", "));
            violations.add("src/view", "shell-default-landing-uniqueness",
                    "At most one ShellLeftBarTabSpec root may declare defaultLanding=true. Found: " + files);
        }
    }

    private void validateServiceContributionPlacement(List<SourceFile> sourceFiles, ViolationSink violations) {
        for (SourceFile sourceFile : sourceFiles) {
            if (!sourceFile.fileName().endsWith("ServiceContribution.java")) {
                continue;
            }
            if (sourceFile.relativePath().equals("shell/api/ServiceContribution.java")
                    || sourceFile.kind() == SourceKind.DATA_ROOT) {
                continue;
            }
            violations.add(sourceFile.relativePath(), "service-contribution-placement",
                    "ServiceContribution roots are runtime composition adapters currently placed under data features. Place them at src/data/<feature>/<Feature>ServiceContribution.java.");
        }
    }

    private static List<List<String>> shellTabSpecArgumentLists(String sourceText) {
        List<List<String>> arguments = new ArrayList<>();
        Matcher matcher = SHELL_LEFT_BAR_TAB_SPEC_CONSTRUCTOR_PATTERN.matcher(sourceText);
        while (matcher.find()) {
            int openParenthesis = matcher.end() - 1;
            int closeParenthesis = findClosingParenthesis(sourceText, openParenthesis);
            if (closeParenthesis < 0) {
                arguments.add(List.of());
                continue;
            }
            arguments.add(splitTopLevelArguments(sourceText.substring(openParenthesis + 1, closeParenthesis)));
        }
        return arguments;
    }

    private static int findClosingParenthesis(String sourceText, int openParenthesis) {
        int depth = 0;
        boolean inString = false;
        boolean inCharacter = false;
        boolean escaped = false;
        for (int index = openParenthesis; index < sourceText.length(); index++) {
            char character = sourceText.charAt(index);
            if (escaped) {
                escaped = false;
                continue;
            }
            if (inString || inCharacter) {
                if (character == '\\') {
                    escaped = true;
                    continue;
                }
                if (inString && character == '"') {
                    inString = false;
                }
                if (inCharacter && character == '\'') {
                    inCharacter = false;
                }
                continue;
            }
            if (character == '"') {
                inString = true;
                continue;
            }
            if (character == '\'') {
                inCharacter = true;
                continue;
            }
            if (character == '(') {
                depth++;
                continue;
            }
            if (character == ')') {
                depth--;
                if (depth == 0) {
                    return index;
                }
            }
        }
        return -1;
    }

    private static List<String> splitTopLevelArguments(String argumentsText) {
        List<String> arguments = new ArrayList<>();
        int start = 0;
        int depth = 0;
        boolean inString = false;
        boolean inCharacter = false;
        boolean escaped = false;
        for (int index = 0; index < argumentsText.length(); index++) {
            char character = argumentsText.charAt(index);
            if (escaped) {
                escaped = false;
                continue;
            }
            if (inString || inCharacter) {
                if (character == '\\') {
                    escaped = true;
                    continue;
                }
                if (inString && character == '"') {
                    inString = false;
                }
                if (inCharacter && character == '\'') {
                    inCharacter = false;
                }
                continue;
            }
            if (character == '"') {
                inString = true;
                continue;
            }
            if (character == '\'') {
                inCharacter = true;
                continue;
            }
            if (character == '(' || character == '[' || character == '{') {
                depth++;
                continue;
            }
            if (character == ')' || character == ']' || character == '}') {
                depth--;
                continue;
            }
            if (character == ',' && depth == 0) {
                arguments.add(argumentsText.substring(start, index).trim());
                start = index + 1;
            }
        }
        arguments.add(argumentsText.substring(start).trim());
        return arguments;
    }
}
