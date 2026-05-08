package saltmarcher.quality.errorprone.flow;

import com.google.errorprone.VisitorState;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.tools.javac.code.Symbol;
import com.sun.tools.javac.processing.JavacProcessingEnvironment;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import javax.annotation.processing.ProcessingEnvironment;
import org.checkerframework.nullaway.dataflow.analysis.AbstractValue;
import org.checkerframework.nullaway.dataflow.analysis.ForwardAnalysisImpl;
import org.checkerframework.nullaway.dataflow.analysis.ForwardTransferFunction;
import org.checkerframework.nullaway.dataflow.analysis.RegularTransferResult;
import org.checkerframework.nullaway.dataflow.analysis.Store;
import org.checkerframework.nullaway.dataflow.analysis.TransferInput;
import org.checkerframework.nullaway.dataflow.analysis.TransferResult;
import org.checkerframework.nullaway.dataflow.cfg.ControlFlowGraph;
import org.checkerframework.nullaway.dataflow.cfg.UnderlyingAST;
import org.checkerframework.nullaway.dataflow.cfg.builder.CFGBuilder;
import org.checkerframework.nullaway.dataflow.cfg.node.AbstractNodeVisitor;
import org.checkerframework.nullaway.dataflow.cfg.node.LocalVariableNode;
import org.checkerframework.nullaway.dataflow.cfg.node.MethodInvocationNode;
import org.checkerframework.nullaway.dataflow.cfg.node.Node;
import org.checkerframework.nullaway.dataflow.cfg.visualize.CFGVisualizer;
import org.checkerframework.nullaway.dataflow.expression.JavaExpression;

/**
 * Method-local definite-fact flow support backed by a compiler CFG/dataflow engine.
 *
 * <p>The analysis carries only facts that hold on every reachable path. Same-file helper methods may
 * be inlined conservatively through the transfer function when the checker allows it.
 */
public final class MethodFlowSupport<F> {

    private final Map<String, MethodContext> localMethodContexts;
    private final InvocationTransfer<F> invocationTransfer;
    private final ProcessingEnvironment processingEnvironment;
    private final Deque<String> activeInlineStack = new ArrayDeque<>();

    public MethodFlowSupport(
            Map<Symbol.MethodSymbol, MethodContext> localMethodContexts,
            VisitorState state,
            InvocationTransfer<F> invocationTransfer
    ) {
        this.localMethodContexts = localMethodContexts.entrySet().stream()
                .collect(Collectors.toUnmodifiableMap(
                        entry -> symbolKey(entry.getKey()),
                        Map.Entry::getValue));
        this.processingEnvironment = JavacProcessingEnvironment.instance(state.context);
        this.invocationTransfer = Objects.requireNonNull(invocationTransfer, "invocationTransfer");
    }

    public AnalysisOutcome<F> analyze(Symbol.MethodSymbol methodSymbol, Set<F> initialFacts) {
        MethodContext methodContext = localMethodContexts.get(symbolKey(methodSymbol));
        if (methodContext == null) {
            return AnalysisOutcome.continuing(initialFacts);
        }
        return analyze(methodContext, initialFacts);
    }

    public AnalysisOutcome<F> analyze(MethodTree methodTree, Set<F> initialFacts) {
        Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(methodTree);
        return methodSymbol == null ? AnalysisOutcome.continuing(initialFacts) : analyze(methodSymbol, initialFacts);
    }

    private AnalysisOutcome<F> analyze(MethodContext methodContext, Set<F> initialFacts) {
        if (methodContext.methodTree() == null || methodContext.methodTree().getBody() == null) {
            return AnalysisOutcome.continuing(initialFacts);
        }
        String methodKey = symbolKey(methodContext.methodSymbol());
        if (activeInlineStack.contains(methodKey)) {
            return AnalysisOutcome.continuing(initialFacts);
        }

        activeInlineStack.addLast(methodKey);
        try {
            ControlFlowGraph cfg = CFGBuilder.build(
                    methodContext.compilationUnit(),
                    methodContext.methodTree(),
                    methodContext.classTree(),
                    processingEnvironment);
            DataflowTransfer transfer = new DataflowTransfer(initialFacts);
            ForwardAnalysisImpl<UnitValue, FactStore<F>, DataflowTransfer> analysis = new ForwardAnalysisImpl<>(transfer);
            analysis.performAnalysis(cfg);
            FactStore<F> regularExitStore = analysis.getRegularExitStore();
            if (regularExitStore != null) {
                return AnalysisOutcome.continuing(regularExitStore.facts());
            }
            FactStore<F> exceptionalExitStore = analysis.getExceptionalExitStore();
            return AnalysisOutcome.continuing(exceptionalExitStore == null ? initialFacts : exceptionalExitStore.facts());
        } finally {
            activeInlineStack.removeLastOccurrence(methodKey);
        }
    }

    private final class DataflowTransfer
            extends AbstractNodeVisitor<TransferResult<UnitValue, FactStore<F>>, TransferInput<UnitValue, FactStore<F>>>
            implements ForwardTransferFunction<UnitValue, FactStore<F>> {

        private final Set<F> initialFacts;

        private DataflowTransfer(Set<F> initialFacts) {
            this.initialFacts = Set.copyOf(initialFacts);
        }

        @Override
        public FactStore<F> initialStore(UnderlyingAST underlyingAst, java.util.List<LocalVariableNode> parameters) {
            return new FactStore<>(initialFacts);
        }

        @Override
        public TransferResult<UnitValue, FactStore<F>> visitNode(
                Node node,
                TransferInput<UnitValue, FactStore<F>> input
        ) {
            return unchanged(input.getRegularStore());
        }

        @Override
        public TransferResult<UnitValue, FactStore<F>> visitMethodInvocation(
                MethodInvocationNode node,
                TransferInput<UnitValue, FactStore<F>> input
        ) {
            FactStore<F> currentStore = input.getRegularStore();
            if (!(node.getTarget().getMethod() instanceof Symbol.MethodSymbol methodSymbol)) {
                return unchanged(currentStore);
            }

            String methodKey = symbolKey(methodSymbol);
            if (invocationTransfer.shouldInline(methodSymbol) && localMethodContexts.containsKey(methodKey)) {
                AnalysisOutcome<F> helperOutcome = analyze(methodSymbol, currentStore.facts());
                return unchanged(new FactStore<>(helperOutcome.facts()));
            }

            Set<F> updatedFacts = invocationTransfer.afterInvocation(node.getTree(), methodSymbol, currentStore.facts());
            return unchanged(new FactStore<>(updatedFacts));
        }

        private RegularTransferResult<UnitValue, FactStore<F>> unchanged(FactStore<F> store) {
            return new RegularTransferResult<>(UnitValue.INSTANCE, store);
        }
    }

    public interface InvocationTransfer<F> {

        Set<F> afterInvocation(MethodInvocationTree invocationTree, Symbol.MethodSymbol symbol, Set<F> incomingFacts);

        default boolean shouldInline(Symbol.MethodSymbol symbol) {
            return false;
        }
    }

    public record MethodContext(
            Symbol.MethodSymbol methodSymbol,
            CompilationUnitTree compilationUnit,
            ClassTree classTree,
            MethodTree methodTree
    ) {
    }

    public record AnalysisOutcome<F>(Set<F> facts, boolean continues) {

        public AnalysisOutcome {
            facts = Set.copyOf(facts);
        }

        public static <F> AnalysisOutcome<F> continuing(Set<F> facts) {
            return new AnalysisOutcome<>(facts, true);
        }
    }

    private record UnitValue() implements AbstractValue<UnitValue> {

        private static final UnitValue INSTANCE = new UnitValue();

        @Override
        public UnitValue leastUpperBound(UnitValue other) {
            return INSTANCE;
        }
    }

    private record FactStore<F>(Set<F> facts) implements Store<FactStore<F>> {

        private FactStore {
            facts = Set.copyOf(facts);
        }

        @Override
        public FactStore<F> copy() {
            return new FactStore<>(facts);
        }

        @Override
        public FactStore<F> leastUpperBound(FactStore<F> other) {
            Set<F> intersection = new LinkedHashSet<>(facts);
            intersection.retainAll(other.facts);
            return new FactStore<>(intersection);
        }

        @Override
        public FactStore<F> widenedUpperBound(FactStore<F> other) {
            return leastUpperBound(other);
        }

        @Override
        public boolean canAlias(JavaExpression left, JavaExpression right) {
            return false;
        }

        @Override
        public String visualize(CFGVisualizer<?, FactStore<F>, ?> visualizer) {
            return new TreeSet<>(facts.stream().map(String::valueOf).toList()).toString();
        }
    }

    private static String symbolKey(Symbol.MethodSymbol symbol) {
        String owner = symbol.owner instanceof Symbol.ClassSymbol classSymbol
                ? classSymbol.getQualifiedName().toString()
                : String.valueOf(symbol.owner);
        String parameters = symbol.getParameters().stream()
                .map(parameter -> parameter.asType().toString())
                .collect(Collectors.joining(","));
        return owner + "#" + symbol.getSimpleName() + "(" + parameters + ")";
    }
}
