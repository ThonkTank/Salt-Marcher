package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.tools.javac.code.Symbol;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import javax.lang.model.element.Modifier;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.TypeMirror;
import saltmarcher.quality.errorprone.flow.MethodFlowSupport;

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

        Map<Symbol.MethodSymbol, MethodFlowSupport.MethodContext> localMethodContexts =
                collectLocalMethodContexts(tree, state);
        for (MethodFlowSupport.MethodContext methodContext : localMethodContexts.values()) {
            if (methodContext.methodTree().getBody() == null) {
                continue;
            }
            MethodFlowSupport<ForeignCommandFact> flowSupport = new MethodFlowSupport<>(
                    localMethodContexts,
                    state,
                    new RoundTripInvocationTransfer(queryFeature, methodName(methodContext.methodTree()), state));
            flowSupport.analyze(methodContext.methodSymbol(), Set.of());
        }
        return Description.NO_MATCH;
    }

    private static Map<Symbol.MethodSymbol, MethodFlowSupport.MethodContext> collectLocalMethodContexts(
            CompilationUnitTree tree,
            VisitorState state
    ) {
        Map<Symbol.MethodSymbol, MethodFlowSupport.MethodContext> methods = new LinkedHashMap<>();
        ArrayDeque<ClassTree> classStack = new ArrayDeque<>();
        for (Tree typeDeclaration : tree.getTypeDecls()) {
            collectFromMember(typeDeclaration, tree, state, classStack, methods);
        }
        return methods;
    }

    private static void collectFromMember(
            Tree member,
            CompilationUnitTree compilationUnit,
            VisitorState state,
            ArrayDeque<ClassTree> classStack,
            Map<Symbol.MethodSymbol, MethodFlowSupport.MethodContext> methods
    ) {
        if (member instanceof ClassTree classTree) {
            classStack.addLast(classTree);
            try {
                for (Tree nestedMember : classTree.getMembers()) {
                    collectFromMember(nestedMember, compilationUnit, state, classStack, methods);
                }
            } finally {
                classStack.removeLast();
            }
            return;
        }
        if (!(member instanceof MethodTree methodTree) || classStack.isEmpty()) {
            return;
        }
        Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodTree);
        if (symbol == null) {
            return;
        }
        methods.put(symbol, new MethodFlowSupport.MethodContext(
                symbol,
                compilationUnit,
                classStack.getLast(),
                methodTree));
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

    private record ForeignCommandFact(String featureName, String commandCall) {
    }

    private final class RoundTripInvocationTransfer implements MethodFlowSupport.InvocationTransfer<ForeignCommandFact> {

        private final String queryFeature;
        private final String methodName;
        private final VisitorState state;

        private RoundTripInvocationTransfer(String queryFeature, String methodName, VisitorState state) {
            this.queryFeature = queryFeature;
            this.methodName = methodName;
            this.state = state;
        }

        @Override
        public Set<ForeignCommandFact> afterInvocation(
                MethodInvocationTree invocationTree,
                Symbol.MethodSymbol symbol,
                Set<ForeignCommandFact> incomingFacts
        ) {
            String ownerType = ownerTypeName(symbol);
            if (ownerType == null) {
                return incomingFacts;
            }

            String foreignApplicationFeature = foreignApplicationServiceFeature(ownerType, queryFeature);
            if (foreignApplicationFeature != null
                    && isForeignCommandBoundary(symbol, foreignApplicationFeature)) {
                Set<ForeignCommandFact> nextFacts = new java.util.LinkedHashSet<>(incomingFacts);
                nextFacts.add(new ForeignCommandFact(
                        foreignApplicationFeature,
                        simpleCall(ownerType, symbol, foreignApplicationFeature)));
                return nextFacts;
            }

            String foreignPublishedFeature = foreignPublishedModelFeature(ownerType, queryFeature);
            if (foreignPublishedFeature != null
                    && symbol.getSimpleName().contentEquals("current")
                    && symbol.getParameters().isEmpty()) {
                List<String> commandCalls = incomingFacts.stream()
                        .filter(fact -> fact.featureName().equals(foreignPublishedFeature))
                        .map(ForeignCommandFact::commandCall)
                        .distinct()
                        .toList();
                if (!commandCalls.isEmpty()) {
                    state.reportMatch(buildDescription(invocationTree)
                            .setMessage("method '" + methodName
                                    + "' sends foreign command call(s) "
                                    + String.join(", ", commandCalls)
                                    + " and then polls foreign published state handle(s) "
                                    + ownerType.substring(ownerType.lastIndexOf('.') + 1)
                                    + ".current(). This violates the foreign published reply-channel roundtrip anti-pattern. "
                                    + "Correct pattern: send the command to the foreign ApplicationService and consume later "
                                    + "published state changes as a real state seam, not as a private current()-style answer channel.")
                            .build());
                }
            }
            return incomingFacts;
        }

        @Override
        public boolean shouldInline(Symbol.MethodSymbol symbol) {
            return symbol.getModifiers().contains(javax.lang.model.element.Modifier.PRIVATE)
                    || symbol.getModifiers().contains(javax.lang.model.element.Modifier.STATIC)
                    || symbol.getModifiers().contains(javax.lang.model.element.Modifier.FINAL)
                    || ownerClassIsEffectivelyNonOverridable(symbol);
        }

        private boolean ownerClassIsEffectivelyNonOverridable(Symbol.MethodSymbol symbol) {
            return symbol.owner instanceof Symbol.ClassSymbol classSymbol
                    && classSymbol.getModifiers().contains(Modifier.FINAL);
        }
    }
}
