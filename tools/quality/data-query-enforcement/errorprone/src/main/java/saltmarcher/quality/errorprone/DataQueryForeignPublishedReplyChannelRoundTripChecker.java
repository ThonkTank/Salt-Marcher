package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.TypeMirror;

@BugPattern(
        name = "DataQueryForeignPublishedReplyChannelRoundTrip",
        summary = "Query adapters must not treat foreign published/*Model handles as imperative reply channels.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DataQueryForeignPublishedReplyChannelRoundTripChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(tree);
        Matcher queryMatcher = DataArchitectureSupport.QUERY_PACKAGE.matcher(packageName);
        if (!queryMatcher.matches()) {
            return Description.NO_MATCH;
        }
        String queryFeature = queryMatcher.group(1);

        List<String> violations = new ArrayList<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethod(MethodTree methodTree, Void unused) {
                if (methodTree.getBody() == null) {
                    return null;
                }
                MethodEvidence evidence = new MethodEvidence();
                new TreePathScanner<Void, Void>() {
                    @Override
                    public Void visitMethodInvocation(MethodInvocationTree methodInvocation, Void nestedUnused) {
                        Symbol symbol = ASTHelpers.getSymbol(methodInvocation);
                        if (!(symbol instanceof Symbol.MethodSymbol methodSymbol)) {
                            return super.visitMethodInvocation(methodInvocation, nestedUnused);
                        }
                        String ownerType = ownerTypeName(methodSymbol);
                        if (ownerType == null) {
                            return super.visitMethodInvocation(methodInvocation, nestedUnused);
                        }

                        String foreignApplicationFeature = foreignApplicationServiceFeature(ownerType, queryFeature);
                        if (foreignApplicationFeature != null
                                && isForeignCommandBoundary(methodSymbol, foreignApplicationFeature)) {
                            evidence.recordCommandCall(
                                    foreignApplicationFeature,
                                    simpleCall(ownerType, methodSymbol, foreignApplicationFeature));
                        }

                        String foreignPublishedModelFeature = foreignPublishedModelFeature(ownerType, queryFeature);
                        if (foreignPublishedModelFeature != null
                                && methodSymbol.getSimpleName().contentEquals("current")
                                && methodSymbol.getParameters().isEmpty()) {
                            evidence.recordModelPoll(
                                    foreignPublishedModelFeature,
                                    ownerType.substring(ownerType.lastIndexOf('.') + 1) + ".current()");
                        }
                        return super.visitMethodInvocation(methodInvocation, nestedUnused);
                    }
                }.scan(methodTree.getBody(), null);
                evidence.reportViolations(methodName(methodTree), violations);
                return null;
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Data query adapter package '" + packageName
                        + "' violates the one-way foreign published-state contract: "
                        + String.join("; ", violations))
                .build();
    }

    private static boolean isForeignCommandBoundary(Symbol.MethodSymbol methodSymbol, String foreignFeature) {
        if (methodSymbol.getParameters().size() != 1) {
            return false;
        }
        if (!"void".equals(methodSymbol.getReturnType().toString())) {
            return false;
        }
        return isSameFeaturePublishedCommand(methodSymbol.getParameters().getFirst().asType(), foreignFeature);
    }

    private static boolean isSameFeaturePublishedCommand(TypeMirror typeMirror, String featureName) {
        if (!(typeMirror instanceof DeclaredType declaredType)
                || !(declaredType.asElement() instanceof javax.lang.model.element.TypeElement typeElement)) {
            return false;
        }
        String qualifiedName = typeElement.getQualifiedName().toString();
        return qualifiedName.startsWith("src.domain." + featureName + ".published.")
                && qualifiedName.endsWith("Command");
    }

    private static String simpleCall(
            String ownerType,
            Symbol.MethodSymbol methodSymbol,
            String foreignFeature
    ) {
        TypeMirror parameterType = methodSymbol.getParameters().getFirst().asType();
        String parameterSimpleName = parameterType.toString();
        int separator = parameterSimpleName.lastIndexOf('.');
        if (separator >= 0) {
            parameterSimpleName = parameterSimpleName.substring(separator + 1);
        }
        return ownerType.substring(ownerType.lastIndexOf('.') + 1)
                + "."
                + methodSymbol.getSimpleName()
                + "("
                + parameterSimpleName
                + ")"
                + " for foreign feature '"
                + foreignFeature
                + "'";
    }

    private static String ownerTypeName(Symbol.MethodSymbol symbol) {
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    private static String methodName(MethodTree methodTree) {
        return methodTree.getName() == null ? "<unknown>" : methodTree.getName().toString();
    }

    private static String foreignApplicationServiceFeature(String ownerType, String queryFeature) {
        Matcher matcher = DataArchitectureSupport.DOMAIN_APPLICATION_SERVICE_TYPE.matcher(ownerType);
        if (!matcher.matches()) {
            return null;
        }
        String foreignFeature = matcher.group(1);
        return foreignFeature.equals(queryFeature) ? null : foreignFeature;
    }

    private static String foreignPublishedModelFeature(String ownerType, String queryFeature) {
        Matcher matcher = DataArchitectureSupport.DOMAIN_PUBLISHED_MODEL_TYPE.matcher(ownerType);
        if (!matcher.matches()) {
            return null;
        }
        String foreignFeature = matcher.group(1);
        return foreignFeature.equals(queryFeature) ? null : foreignFeature;
    }

    private static final class MethodEvidence {

        private final Map<String, List<String>> commandCallsByFeature = new LinkedHashMap<>();
        private final Map<String, List<String>> modelPollsByFeature = new LinkedHashMap<>();

        private void recordCommandCall(String featureName, String commandCall) {
            commandCallsByFeature.computeIfAbsent(featureName, ignored -> new ArrayList<>()).add(commandCall);
        }

        private void recordModelPoll(String featureName, String modelPoll) {
            modelPollsByFeature.computeIfAbsent(featureName, ignored -> new ArrayList<>()).add(modelPoll);
        }

        private void reportViolations(String methodName, List<String> violations) {
            for (Map.Entry<String, List<String>> entry : commandCallsByFeature.entrySet()) {
                List<String> modelPolls = modelPollsByFeature.get(entry.getKey());
                if (modelPolls == null || modelPolls.isEmpty()) {
                    continue;
                }
                violations.add("method '" + methodName
                        + "' sends foreign command call(s) "
                        + String.join(", ", entry.getValue())
                        + " and then polls foreign published state handle(s) "
                        + String.join(", ", modelPolls)
                        + ". This violates the foreign published reply-channel roundtrip anti-pattern. "
                        + "Correct pattern: send the command to the foreign ApplicationService and consume later "
                        + "published state changes as a real state seam, not as a private current()-style answer channel.");
            }
        }
    }
}
