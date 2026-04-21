package saltmarcher.quality.pmd;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;

public final class SaltMarcherSourcePolicyRule extends AbstractJavaRule {

    private static final Pattern ROOT_APPLICATION_SERVICE_COMPOSITION_PATTERN = Pattern.compile(
            "\\bnew\\s+[A-Z][A-Za-z0-9_]*(?:Repository|QueryAdapter|Lookup|Catalog|Search|Gateway|Store|ConnectionFactory|Migrator|TableManager)\\s*\\(");
    private static final Pattern ROOT_APPLICATION_SERVICE_STATIC_BACKEND_PATTERN = Pattern.compile(
            "(?m)^\\s*private\\s+static\\s+final\\s+.*(?:Repository|Lookup|Catalog|Search|QueryAdapter|Gateway|Store|Factory|ConnectionFactory)\\b");
    private static final Pattern ENUM_BODY_PATTERN = Pattern.compile("(?s)enum\\s+%s\\s*\\{(.*?)\\}");
    private static final Pattern ENUM_CONSTANT_PATTERN = Pattern.compile("(?m)^\\s*([A-Z][A-Z0-9_]*)\\b");
    private static final Pattern PERMITS_CLAUSE_PATTERN = Pattern.compile(
            "(?s)sealed\\s+interface\\s+ShellContributionSpec\\s+permits\\s+([^\\{]+)\\{");
    private static final Pattern SHELL_BINDING_METHOD_PATTERN = Pattern.compile(
            "(?m)^\\s*(?:default\\s+)?[A-Za-z0-9_<>, ?.@]+\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\(");
    private static final Pattern PUBLIC_METHOD_PATTERN = Pattern.compile(
            "(?m)^\\s*public\\s+(?:synchronized\\s+)?(?:<[^>]+>\\s+)?[A-Za-z0-9_<>, ?.@]+\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\(");
    private static final Pattern DOMAIN_APPLICATION_POLICY_HELPER_PATTERN = Pattern.compile(
            "(?m)^\\s*(?!(?:public\\b))(?:(?:private|protected)\\s+)?(?:static\\s+)?(?:<[^>]+>\\s+)?[A-Za-z0-9_<>, ?.@\\[\\]]+\\s+"
                    + "((?:score|rank|choose|balance|enforce)[A-Za-z0-9_]*)\\s*\\(");
    private static final Pattern DOMAIN_SETTER_STYLE_MUTATION_PATTERN = Pattern.compile(
            "(?m)^\\s*(?:public|protected)\\s+(?:final\\s+)?void\\s+(set[A-Z][A-Za-z0-9_]*)\\s*\\(");
    private static final Pattern FEATURE_SPECIFIC_PACKAGE_REFERENCE_PATTERN = Pattern.compile(
            "\\bsrc\\.(?:domain|data)\\.[a-z][A-Za-z0-9_]*\\."
                    + "|\\bsrc\\.view\\.(?:leftbartabs|statetabs|dropdowns|slotcontent)\\.[a-z][A-Za-z0-9_]*\\."
                    + "|\\bsrc\\.view\\.(?!(?:leftbartabs|statetabs|dropdowns|slotcontent)\\b)[a-z][A-Za-z0-9_]*\\.");
    private static final Set<String> SHELL_SLOT_API_CONSTANTS = Set.of(
            "TOP_BAR",
            "COCKPIT_CONTROLS",
            "COCKPIT_MAIN",
            "COCKPIT_DETAILS",
            "COCKPIT_STATE");
    private static final Set<String> SHELL_CONTRIBUTION_SPEC_PERMITTED_TYPES = Set.of(
            "ShellLeftBarTabSpec",
            "ShellTopBarSpec",
            "ShellStateTabSpec");
    private static final Set<String> SHELL_BINDING_ALLOWED_METHODS = Set.of(
            "title",
            "navigationLabel",
            "slotContent",
            "onActivate",
            "onDeactivate");
    private static final List<String> SHELL_RUNTIME_CONTEXT_ALLOWED_METHODS = List.of(
            "inspector",
            "services",
            "session");
    private static final List<String> SHELL_LEFT_BAR_TAB_SPEC_COMPONENTS = List.of(
            "key",
            "navigationGroup",
            "viewOrder",
            "defaultLanding",
            "navigationGraphicSupplier",
            "mode");
    private static final List<String> SHELL_TOP_BAR_SPEC_COMPONENTS = List.of(
            "key",
            "itemOrder");
    private static final List<String> SHELL_STATE_TAB_SPEC_COMPONENTS = List.of(
            "key",
            "tabLabel",
            "itemOrder");
    private static final Set<String> CONTROL_FLOW_METHOD_NAMES = Set.of("if", "for", "while", "switch");

    private static final Set<String> DOMAIN_BANNED_TOKENS = Set.of(
            "javafx.",
            "javax.json",
            "jakarta.json",
            "com.fasterxml.jackson",
            "org.json",
            "java.sql.",
            "javax.sql.",
            "java.net.",
            "okhttp3.",
            "retrofit2.",
            "java.io.",
            "java.nio.file."
    );

    private static final Set<String> VIEW_LEGACY_SHELL_TYPES = Set.of(
            "shell.host.AppShell",
            "shell.host.AppView",
            "shell.host.ShellServices",
            "shell.panel.DetailsNavigator",
            "shell.panel.SceneRegistry",
            "shell.host.InspectorPane",
            "shell.panel.ScenePane",
            "shell.host.StateTabPane"
    );

    private static final Set<String> LEGACY_PERSISTENCE_TYPES = Set.of(
            "shell.host.RuntimeServiceProvider",
            "shell.host.RuntimeServiceRegistry"
    );
    private static final Set<String> SHELL_SPEC_FORBIDDEN_REFERENCES = Set.of(
            "ShellRuntimeContext",
            "ServiceRegistry",
            "InspectorSink",
            "InspectorEntrySpec",
            "shell.host.",
            "src.view.",
            "src.domain.",
            "src.data.");
    private static final Set<String> SHELL_SPEC_SCENE_GRAPH_TYPES = Set.of(
            "javafx.scene.layout.",
            "javafx.scene.control.",
            "javafx.scene.canvas.",
            "javafx.scene.paint.",
            "javafx.scene.shape.",
            "javafx.scene.text.",
            "javafx.scene.image.");

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isUnderMainSourceRoots()) {
            return data;
        }

        if (sourceFacts.text().contains("setStyle(")) {
            asCtx(data).addViolationWithMessage(node,
                    "Inline JavaFX styling via setStyle(...) is forbidden. Define styling in a stylesheet under resources/ instead.");
        }

        if (isBootstrapOrShellSource(sourceFacts)
                && FEATURE_SPECIFIC_PACKAGE_REFERENCE_PATTERN.matcher(sourceFacts.text()).find()) {
            asCtx(data).addViolationWithMessage(node,
                    "Bootstrap and shell code must stay generic and must not reference concrete src/view,"
                            + " src/domain, or src/data feature packages.");
        }

        if (sourceFacts.isViewSource()) {
            if (sourceFacts.isLegacyViewSource()) {
                asCtx(data).addViolationWithMessage(node,
                        "View code must migrate to src/view/leftbartabs, src/view/statetabs, src/view/dropdowns, or reusable src/view/slotcontent; old component-local roots are forbidden.");
            }
            for (String legacyType : VIEW_LEGACY_SHELL_TYPES) {
                if (sourceFacts.text().contains(legacyType)) {
                    asCtx(data).addViolationWithMessage(node,
                            "View code must not use legacy shell wiring type '" + legacyType + "'.");
                }
            }
        }

        if (sourceFacts.relativePath().equals("shell/api/ShellSlot.java")) {
            Set<String> constants = enumConstants(sourceFacts.text(), "ShellSlot");
            if (!constants.equals(SHELL_SLOT_API_CONSTANTS)) {
                asCtx(data).addViolationWithMessage(node,
                        "ShellSlot must define exactly the fixed workbench slots: "
                                + String.join(", ", SHELL_SLOT_API_CONSTANTS) + ".");
            }
        }

        if (sourceFacts.relativePath().equals("shell/api/ShellContributionSpec.java")) {
            Set<String> permittedTypes = shellContributionSpecPermittedTypes(sourceFacts.text());
            if (!permittedTypes.equals(SHELL_CONTRIBUTION_SPEC_PERMITTED_TYPES)) {
                asCtx(data).addViolationWithMessage(node,
                        "ShellContributionSpec must remain the sealed family of "
                                + String.join(", ", SHELL_CONTRIBUTION_SPEC_PERMITTED_TYPES) + ".");
            }
        }

        if (isShellContributionSpec(sourceFacts.relativePath())) {
            validateShellContributionSpecPurity(node, data, sourceFacts);
            validateShellContributionSpecApiShape(node, data, sourceFacts);
        }

        if (sourceFacts.relativePath().equals("shell/api/ShellRuntimeContext.java")) {
            List<String> methods = publicMethods(sourceFacts.text());
            if (!methods.equals(SHELL_RUNTIME_CONTEXT_ALLOWED_METHODS)) {
                asCtx(data).addViolationWithMessage(node,
                        "ShellRuntimeContext must expose only the fixed runtime gateway methods: "
                                + String.join(", ", SHELL_RUNTIME_CONTEXT_ALLOWED_METHODS) + ".");
            }
        }

        if (sourceFacts.relativePath().equals("shell/api/ShellBinding.java")) {
            Set<String> methods = shellBindingMethods(sourceFacts.text());
            if (!methods.equals(SHELL_BINDING_ALLOWED_METHODS)) {
                asCtx(data).addViolationWithMessage(node,
                        "ShellBinding must expose only bound content and lifecycle hooks: "
                                + String.join(", ", SHELL_BINDING_ALLOWED_METHODS) + ".");
            }
        }

        if (sourceFacts.isDomainSource()) {
            for (String token : DOMAIN_BANNED_TOKENS) {
                if (sourceFacts.text().contains(token)) {
                    asCtx(data).addViolationWithMessage(node,
                            "Domain code must not reference '" + token + "'.");
                }
            }

            if (sourceFacts.isDomainRoot()) {
                if (ROOT_APPLICATION_SERVICE_COMPOSITION_PATTERN.matcher(sourceFacts.text()).find()
                        || sourceFacts.text().contains(".shared(")
                        || sourceFacts.text().contains(".getInstance(")
                        || ROOT_APPLICATION_SERVICE_STATIC_BACKEND_PATTERN.matcher(sourceFacts.text()).find()) {
                    asCtx(data).addViolationWithMessage(node,
                            "Root application services must stay thin and must not instantiate or cache data port-adapter or source-adapter infrastructure directly.");
                }
            }
            if (sourceFacts.isDomainApplicationSource()) {
                Matcher matcher = DOMAIN_APPLICATION_POLICY_HELPER_PATTERN.matcher(sourceFacts.text());
                if (matcher.find()) {
                    asCtx(data).addViolationWithMessage(node,
                            "Domain application code must not hide policy helper method '" + matcher.group(1)
                                    + "'. Move rule-bearing behavior into the owning domain module and keep application code as orchestration.");
                }
            }
            if (sourceFacts.isNamedDomainModuleSource()) {
                Matcher matcher = DOMAIN_SETTER_STYLE_MUTATION_PATTERN.matcher(sourceFacts.text());
                if (matcher.find()) {
                    asCtx(data).addViolationWithMessage(node,
                            "Named domain modules must use domain command names instead of JavaBean-style void mutation method '"
                                    + matcher.group(1) + "'.");
                }
            }
        }

        if (sourceFacts.isDataRoot()) {
            for (String registeredType : sourceFacts.registeredServiceTypes()) {
                if (isForbiddenDataRootRegistration(registeredType, sourceFacts.featureName())) {
                    asCtx(data).addViolationWithMessage(node,
                            "Root service entrypoint may register only own-feature domain boundary types."
                                    + " Found registration for '" + registeredType + "'.");
                }
            }
        }

        for (String legacyType : LEGACY_PERSISTENCE_TYPES) {
            if (sourceFacts.text().contains(legacyType)) {
                asCtx(data).addViolationWithMessage(node,
                        "Legacy runtime-service wiring is forbidden. Use shell.api.ServiceContribution and shell.api.ServiceRegistry instead.");
            }
        }

        return data;
    }

    private static boolean isForbiddenDataRootRegistration(String registeredType, String featureName) {
        return !isAllowedDataRootRegistration(registeredType, featureName);
    }

    private static boolean isAllowedDataRootRegistration(String registeredType, String featureName) {
        String domainFeaturePrefix = "src.domain." + featureName + ".";
        if (!registeredType.startsWith(domainFeaturePrefix)) {
            return false;
        }

        String simpleName = registeredType.substring(registeredType.lastIndexOf('.') + 1);
        if (simpleName.endsWith("ApplicationService")) {
            return true;
        }

        return simpleName.endsWith("Repository")
                || simpleName.endsWith("Lookup")
                || simpleName.endsWith("Catalog")
                || simpleName.endsWith("Search");
    }

    private static boolean isBootstrapOrShellSource(SaltMarcherSourceFacts sourceFacts) {
        return sourceFacts.relativePath().startsWith("bootstrap/")
                || sourceFacts.relativePath().startsWith("shell/");
    }

    private static boolean isShellContributionSpec(String relativePath) {
        return relativePath.equals("shell/api/ShellLeftBarTabSpec.java")
                || relativePath.equals("shell/api/ShellTopBarSpec.java")
                || relativePath.equals("shell/api/ShellStateTabSpec.java");
    }

    private void validateShellContributionSpecPurity(
            ASTCompilationUnit node,
            Object data,
            SaltMarcherSourceFacts sourceFacts) {
        for (String forbiddenReference : SHELL_SPEC_FORBIDDEN_REFERENCES) {
            if (sourceFacts.text().contains(forbiddenReference)) {
                asCtx(data).addViolationWithMessage(node,
                        "Shell contribution spec metadata must not reference runtime, feature, or host type '"
                                + forbiddenReference + "'.");
            }
        }

        boolean isShellLeftBarTabSpec = sourceFacts.relativePath().equals("shell/api/ShellLeftBarTabSpec.java");
        for (String sceneGraphType : SHELL_SPEC_SCENE_GRAPH_TYPES) {
            if (sourceFacts.text().contains(sceneGraphType)) {
                asCtx(data).addViolationWithMessage(node,
                        "Shell contribution specs must not construct or depend on scene-graph implementation type '"
                                + sceneGraphType + "'.");
            }
        }
        if (!isShellLeftBarTabSpec && sourceFacts.text().contains("javafx.scene.Node")) {
            asCtx(data).addViolationWithMessage(node,
                    "Only ShellLeftBarTabSpec may expose the documented feature-owned navigation graphic Node supplier.");
        }
    }

    private void validateShellContributionSpecApiShape(
            ASTCompilationUnit node,
            Object data,
            SaltMarcherSourceFacts sourceFacts) {
        if (sourceFacts.relativePath().equals("shell/api/ShellLeftBarTabSpec.java")) {
            validateRecordComponents(node, data, sourceFacts, "ShellLeftBarTabSpec", SHELL_LEFT_BAR_TAB_SPEC_COMPONENTS);
            validatePublicMethods(node, data, sourceFacts, Set.of("navigationGraphic"));
            return;
        }
        if (sourceFacts.relativePath().equals("shell/api/ShellTopBarSpec.java")) {
            validateRecordComponents(node, data, sourceFacts, "ShellTopBarSpec", SHELL_TOP_BAR_SPEC_COMPONENTS);
            validatePublicMethods(node, data, sourceFacts, Set.of());
            return;
        }
        if (sourceFacts.relativePath().equals("shell/api/ShellStateTabSpec.java")) {
            validateRecordComponents(node, data, sourceFacts, "ShellStateTabSpec", SHELL_STATE_TAB_SPEC_COMPONENTS);
            validatePublicMethods(node, data, sourceFacts, Set.of());
        }
    }

    private void validateRecordComponents(
            ASTCompilationUnit node,
            Object data,
            SaltMarcherSourceFacts sourceFacts,
            String recordName,
            List<String> expectedComponents) {
        List<String> components = recordComponentNames(sourceFacts.text(), recordName);
        if (!components.equals(expectedComponents)) {
            asCtx(data).addViolationWithMessage(node,
                    recordName + " must keep the fixed passive workbench metadata components: "
                            + String.join(", ", expectedComponents) + ".");
        }
    }

    private void validatePublicMethods(
            ASTCompilationUnit node,
            Object data,
            SaltMarcherSourceFacts sourceFacts,
            Set<String> allowedMethods) {
        List<String> unexpectedMethods = publicMethods(sourceFacts.text()).stream()
                .filter(method -> !method.equals(sourceFacts.simpleName()))
                .filter(method -> !allowedMethods.contains(method))
                .toList();
        if (!unexpectedMethods.isEmpty()) {
            asCtx(data).addViolationWithMessage(node,
                    "Shell contribution specs must not expose runtime, capability, or scene-graph APIs."
                            + " Unexpected public methods: " + String.join(", ", unexpectedMethods) + ".");
        }
    }

    private static Set<String> enumConstants(String sourceText, String enumName) {
        Matcher bodyMatcher = Pattern.compile(String.format(ENUM_BODY_PATTERN.pattern(), enumName)).matcher(sourceText);
        if (!bodyMatcher.find()) {
            return Set.of();
        }
        String constantsBody = bodyMatcher.group(1).split(";", 2)[0];
        Matcher constantMatcher = ENUM_CONSTANT_PATTERN.matcher(constantsBody);
        Set<String> constants = new LinkedHashSet<>();
        while (constantMatcher.find()) {
            constants.add(constantMatcher.group(1));
        }
        return constants;
    }

    private static Set<String> shellContributionSpecPermittedTypes(String sourceText) {
        Matcher matcher = PERMITS_CLAUSE_PATTERN.matcher(sourceText);
        if (!matcher.find()) {
            return Set.of();
        }
        Set<String> permittedTypes = new LinkedHashSet<>();
        for (String permittedType : matcher.group(1).split(",")) {
            permittedTypes.add(permittedType.trim());
        }
        return permittedTypes;
    }

    private static Set<String> shellBindingMethods(String sourceText) {
        Matcher matcher = SHELL_BINDING_METHOD_PATTERN.matcher(sourceText);
        Set<String> methods = new LinkedHashSet<>();
        while (matcher.find()) {
            String methodName = matcher.group(1);
            if (!CONTROL_FLOW_METHOD_NAMES.contains(methodName)) {
                methods.add(methodName);
            }
        }
        return methods;
    }

    private static List<String> publicMethods(String sourceText) {
        Matcher matcher = PUBLIC_METHOD_PATTERN.matcher(sourceText);
        List<String> methods = new ArrayList<>();
        while (matcher.find()) {
            String methodName = matcher.group(1);
            if (!CONTROL_FLOW_METHOD_NAMES.contains(methodName)) {
                methods.add(methodName);
            }
        }
        return methods;
    }

    private static List<String> recordComponentNames(String sourceText, String recordName) {
        Matcher matcher = Pattern.compile("(?s)record\\s+" + Pattern.quote(recordName) + "\\s*\\((.*?)\\)\\s*implements")
                .matcher(sourceText);
        if (!matcher.find()) {
            return List.of();
        }
        return splitTopLevelArguments(matcher.group(1)).stream()
                .map(SaltMarcherSourcePolicyRule::componentName)
                .toList();
    }

    private static String componentName(String component) {
        String normalized = component.replace('\n', ' ').trim();
        int lastSpace = normalized.lastIndexOf(' ');
        return lastSpace < 0 ? normalized : normalized.substring(lastSpace + 1);
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
            if (character == '(' || character == '[' || character == '{' || character == '<') {
                depth++;
                continue;
            }
            if (character == ')' || character == ']' || character == '}' || character == '>') {
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
