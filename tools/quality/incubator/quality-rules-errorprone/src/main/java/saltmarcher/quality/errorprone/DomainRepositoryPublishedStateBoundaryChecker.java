package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.tools.javac.code.Symbol;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import javax.lang.model.element.VariableElement;
import javax.lang.model.type.TypeKind;
import javax.lang.model.type.TypeMirror;

@BugPattern(
        name = "DomainRepositoryPublishedStateBoundary",
        summary = "Domain repositories must not replace same-context published read models with generic publish/Object channels.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainRepositoryPublishedStateBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Pattern REPOSITORY_PACKAGE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.model\\.([^.]+)\\.repository$");
    private static final String OBJECT_TYPE = "java.lang.Object";
    private static final List<String> FORBIDDEN_PUBLISHED_STATE_PAYLOAD_TYPES = List.of(
            OBJECT_TYPE,
            "java.lang.String",
            "java.util.Collection",
            "java.util.List",
            "java.util.Map",
            "java.util.Optional",
            "java.util.Set");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(tree);
        java.util.regex.Matcher packageMatcher = REPOSITORY_PACKAGE.matcher(packageName);
        if (!packageMatcher.matches()) {
            return Description.NO_MATCH;
        }
        ClassTree topLevelClass = DomainRoleConcernSupport.topLevelClass(tree);
        if (topLevelClass == null || !topLevelClass.getSimpleName().toString().endsWith("Repository")) {
            return Description.NO_MATCH;
        }

        String simpleName = topLevelClass.getSimpleName().toString();
        boolean publishedStateRepository = simpleName.endsWith("PublishedStateRepository");
        RepositoryContext repositoryContext = new RepositoryContext(
                packageMatcher.group(1),
                packageMatcher.group(2),
                packageName,
                simpleName);
        List<String> violations = new ArrayList<>();
        for (Tree member : topLevelClass.getMembers()) {
            if (member instanceof MethodTree methodTree) {
                collectMethodViolations(methodTree, publishedStateRepository, repositoryContext, violations);
            }
        }
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(topLevelClass)
                .setMessage("Domain repository '" + topLevelClass.getSimpleName()
                        + "' violates the outbound repository contract: "
                        + String.join("; ", violations)
                        + ". Same-context publication belongs in typed *PublishedStateRepository sinks and "
                        + "published/*Model handles, not generic repository publish/Object channels.")
                .build();
    }

    private static void collectMethodViolations(
            MethodTree methodTree,
            boolean publishedStateRepository,
            RepositoryContext repositoryContext,
            List<String> violations
    ) {
        Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(methodTree);
        if (methodSymbol == null || methodSymbol.isConstructor()) {
            return;
        }
        String methodName = methodSymbol.getSimpleName().toString();
        boolean publishMethod = methodName.startsWith("publish");
        if (publishedStateRepository) {
            if (!publishMethod) {
                violations.add("method " + methodName + "() must use publish* naming");
                return;
            }
            collectPublishedStatePublishViolations(methodSymbol, repositoryContext, violations);
            return;
        }
        if (!publishedStateRepository && publishMethod) {
            violations.add("method " + methodName + "() uses publish naming");
        }
        if (containsObjectChannel(methodSymbol.getReturnType())) {
            violations.add("method " + methodName + "() returns forbidden signature type "
                    + methodSymbol.getReturnType());
        }
        for (VariableElement parameter : methodSymbol.getParameters()) {
            if (containsObjectChannel(parameter.asType())) {
                violations.add("method " + methodName + "() accepts forbidden signature type "
                        + parameter.asType() + " parameter " + parameter.getSimpleName());
            }
        }
    }

    private static void collectPublishedStatePublishViolations(
            Symbol.MethodSymbol methodSymbol,
            RepositoryContext repositoryContext,
            List<String> violations
    ) {
        String methodName = methodSymbol.getSimpleName().toString();
        if (methodSymbol.getReturnType().getKind() != TypeKind.VOID) {
            violations.add("method " + methodName + "() must return void");
        }
        if (methodSymbol.getParameters().isEmpty()) {
            violations.add("method " + methodName + "() must accept a typed publication payload");
        }
        for (VariableElement parameter : methodSymbol.getParameters()) {
            TypeMirror parameterType = parameter.asType();
            if (containsForbiddenPublishedStatePayload(parameterType)) {
                violations.add("method " + methodName + "() accepts forbidden publication payload "
                        + parameterType + " parameter " + parameter.getSimpleName());
            } else if (!isAllowedPublishedStatePayload(parameterType, repositoryContext)) {
                violations.add("method " + methodName + "() accepts non-internal publication payload "
                        + parameterType + " parameter " + parameter.getSimpleName());
            }
        }
    }

    private static boolean isAllowedPublishedStatePayload(TypeMirror type, RepositoryContext repositoryContext) {
        String typeName = type.toString();
        if (containsForbiddenPublishedStatePayload(type)) {
            return false;
        }
        return typeName.startsWith(repositoryContext.modelPrefix())
                || typeName.startsWith(repositoryContext.useCasePrefix())
                || typeName.startsWith(repositoryContext.repositoryPrefix())
                || typeName.startsWith(repositoryContext.repositoryNestedPrefix());
    }

    private static boolean containsObjectChannel(TypeMirror type) {
        String typeName = type.toString();
        return containsType(typeName, OBJECT_TYPE);
    }

    private static boolean containsForbiddenPublishedStatePayload(TypeMirror type) {
        String typeName = type.toString();
        if (typeName.contains(".published.")) {
            return true;
        }
        for (String forbiddenType : FORBIDDEN_PUBLISHED_STATE_PAYLOAD_TYPES) {
            if (containsType(typeName, forbiddenType)) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsType(String typeName, String forbiddenType) {
        return typeName.equals(forbiddenType)
                || typeName.startsWith(forbiddenType + "<")
                || typeName.contains("<" + forbiddenType)
                || typeName.contains(", " + forbiddenType)
                || typeName.contains("? extends " + forbiddenType)
                || typeName.contains("? super " + forbiddenType);
    }

    private record RepositoryContext(
            String context,
            String family,
            String packageName,
            String simpleName
    ) {

        private String familyPrefix() {
            return "src.domain." + context + ".model." + family;
        }

        private String modelPrefix() {
            return familyPrefix() + ".model.";
        }

        private String useCasePrefix() {
            return familyPrefix() + ".usecase.";
        }

        private String repositoryPrefix() {
            return familyPrefix() + ".repository.";
        }

        private String repositoryNestedPrefix() {
            return packageName + "." + simpleName + ".";
        }
    }
}
