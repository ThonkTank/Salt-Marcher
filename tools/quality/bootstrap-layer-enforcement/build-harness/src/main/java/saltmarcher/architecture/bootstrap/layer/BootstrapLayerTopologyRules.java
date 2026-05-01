package saltmarcher.architecture.bootstrap.layer;

import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.SourceKind;
import saltmarcher.architecture.ViolationSink;

public final class BootstrapLayerTopologyRules implements ArchitectureRule {

    private static final Pattern SHELL_LEFT_BAR_TAB_SPEC_CONSTRUCTOR_PATTERN =
            Pattern.compile("\\bnew\\s+(?:shell\\.api\\.)?ShellLeftBarTabSpec\\s*\\(");
    private static final Pattern SHELL_CONTRIBUTION_INTERFACE_PATTERN =
            Pattern.compile("\\bimplements\\b[^\\{;]*\\bShellContribution\\b");
    private static final Pattern SERVICE_CONTRIBUTION_INTERFACE_PATTERN =
            Pattern.compile("\\bimplements\\b[^\\{;]*\\bServiceContribution\\b");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        List<SourceFile> sourceFiles = context.sourceFiles(violations);
        validateViewContributionDiscoveryRoots(sourceFiles, violations);
        validateServiceContributionDiscoveryRoots(sourceFiles, violations);
    }

    private void validateViewContributionDiscoveryRoots(List<SourceFile> sourceFiles, ViolationSink violations) {
        List<SourceFile> defaultLandingRoots = new ArrayList<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (!sourceFile.relativePath().startsWith("src/view/") || !sourceFile.fileName().endsWith("Contribution.java")) {
                continue;
            }
            if (sourceFile.kind() != SourceKind.VIEW_CONTRIBUTION) {
                String ruleId = sourceFile.relativePath().startsWith("src/view/slotcontent/")
                        ? "bootstrap-no-feature-internal-entrypoint-discovery"
                        : "bootstrap-view-discovery-root-set";
                violations.add(sourceFile.relativePath(), ruleId,
                        "Bootstrap discovers only active-root *Contribution entrypoints under src/view/leftbartabs, src/view/statetabs, and src/view/dropdowns.");
                continue;
            }

            validateContributionContract(sourceFile, defaultLandingRoots, violations);
        }

        if (defaultLandingRoots.size() > 1) {
            String files = defaultLandingRoots.stream()
                    .map(SourceFile::relativePath)
                    .sorted()
                    .collect(Collectors.joining(", "));
            violations.add("src/view", "bootstrap-startup-defaultlanding-uniqueness",
                    "At most one ShellLeftBarTabSpec root may declare defaultLanding=true. Found: " + files);
        }
    }

    private void validateContributionContract(
            SourceFile sourceFile,
            List<SourceFile> defaultLandingRoots,
            ViolationSink violations) {
        String simpleName = sourceFile.fileName().replaceFirst("\\.java$", "");
        if (!hasPublicFinalClass(sourceFile.content(), simpleName)) {
            violations.add(sourceFile.relativePath(), "bootstrap-generic-discovery-instantiation-contract",
                    "Bootstrap-discovered view roots must be public final classes.");
        }
        if (!SHELL_CONTRIBUTION_INTERFACE_PATTERN.matcher(sourceFile.content()).find()) {
            violations.add(sourceFile.relativePath(), "bootstrap-generic-discovery-instantiation-contract",
                    "Bootstrap-discovered view roots must implement shell.api.ShellContribution.");
        }
        if (!hasPublicNoArgConstructor(sourceFile.content(), simpleName)) {
            violations.add(sourceFile.relativePath(), "bootstrap-generic-discovery-instantiation-contract",
                    "Bootstrap-discovered view roots must expose a public no-arg constructor.");
        }

        for (List<String> arguments : shellTabSpecArgumentLists(sourceFile.content())) {
            if (arguments.size() < 4) {
                violations.add(sourceFile.relativePath(), "bootstrap-startup-defaultlanding-literal",
                        "ShellLeftBarTabSpec root metadata must expose a literal defaultLanding argument.");
                continue;
            }
            String defaultLanding = arguments.get(3).trim();
            if (defaultLanding.equals("true")) {
                defaultLandingRoots.add(sourceFile);
                continue;
            }
            if (!defaultLanding.equals("false")) {
                violations.add(sourceFile.relativePath(), "bootstrap-startup-defaultlanding-literal",
                        "ShellLeftBarTabSpec defaultLanding must be the literal true or false so startup uniqueness remains mechanically checkable.");
            }
        }
    }

    private void validateServiceContributionDiscoveryRoots(List<SourceFile> sourceFiles, ViolationSink violations) {
        TreeMap<String, List<SourceFile>> rootClassesByFeature = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (!sourceFile.relativePath().startsWith("src/data/")
                    || !sourceFile.fileName().endsWith("ServiceContribution.java")) {
                continue;
            }
            if (sourceFile.kind() != SourceKind.DATA_ROOT) {
                String ruleId = sourceFile.relativePath().contains("/repository/")
                        || sourceFile.relativePath().contains("/query/")
                        || sourceFile.relativePath().contains("/gateway/")
                        || sourceFile.relativePath().contains("/model/")
                        || sourceFile.relativePath().contains("/mapper/")
                        ? "bootstrap-no-feature-internal-entrypoint-discovery"
                        : "bootstrap-data-service-discovery-root-set";
                violations.add(sourceFile.relativePath(), ruleId,
                        "Bootstrap discovers only src/data/<feature>/<Feature>ServiceContribution.java root entrypoints for backend runtime registration.");
                continue;
            }
            rootClassesByFeature.computeIfAbsent(sourceFile.featureName(), ignored -> new ArrayList<>()).add(sourceFile);
            validateServiceContributionContract(sourceFile, violations);
        }

        for (var entry : rootClassesByFeature.entrySet()) {
            if (entry.getValue().size() <= 1) {
                continue;
            }
            String files = entry.getValue().stream()
                    .map(SourceFile::relativePath)
                    .sorted()
                    .collect(Collectors.joining(", "));
            violations.add("src/data/" + entry.getKey(), "bootstrap-data-service-discovery-root-set",
                    "Bootstrap expects exactly one root service contribution class per data feature. Found: " + files);
        }
    }

    private void validateServiceContributionContract(SourceFile sourceFile, ViolationSink violations) {
        String simpleName = sourceFile.fileName().replaceFirst("\\.java$", "");
        if (!hasPublicFinalClass(sourceFile.content(), simpleName)) {
            violations.add(sourceFile.relativePath(), "bootstrap-generic-discovery-instantiation-contract",
                    "Bootstrap-discovered service roots must be public final classes.");
        }
        if (!SERVICE_CONTRIBUTION_INTERFACE_PATTERN.matcher(sourceFile.content()).find()) {
            violations.add(sourceFile.relativePath(), "bootstrap-generic-discovery-instantiation-contract",
                    "Bootstrap-discovered service roots must implement shell.api.ServiceContribution.");
        }
        if (!hasPublicNoArgConstructor(sourceFile.content(), simpleName)) {
            violations.add(sourceFile.relativePath(), "bootstrap-generic-discovery-instantiation-contract",
                    "Bootstrap-discovered service roots must expose a public no-arg constructor.");
        }
    }

    private static boolean hasPublicFinalClass(String sourceText, String simpleName) {
        Pattern pattern = Pattern.compile("(?m)^\\s*public\\s+final\\s+class\\s+" + Pattern.quote(simpleName) + "\\b");
        return pattern.matcher(sourceText).find();
    }

    private static boolean hasPublicNoArgConstructor(String sourceText, String simpleName) {
        Pattern pattern = Pattern.compile("(?m)^\\s*public\\s+" + Pattern.quote(simpleName) + "\\s*\\(\\s*\\)");
        return pattern.matcher(sourceText).find();
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
