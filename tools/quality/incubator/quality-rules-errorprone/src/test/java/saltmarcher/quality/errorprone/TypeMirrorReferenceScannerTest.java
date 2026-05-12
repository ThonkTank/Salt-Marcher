package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.CompilationTestHelper;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.function.Predicate;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.RecordComponentElement;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.TypeParameterElement;
import javax.lang.model.element.VariableElement;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.util.ElementFilter;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class TypeMirrorReferenceScannerTest {

    @Test
    public void scansNestedGenericPublicSignatureEdges() {
        CompilationTestHelper.newInstance(TypeMirrorReferenceProbeChecker.class, getClass())
                .addSourceLines(
                        "probe/Surface.java",
                        "package probe;",
                        "import java.util.List;",
                        "// BUG: Diagnostic matches: traversal",
                        "public final class Surface<T extends ClassBoundForbidden>",
                        "    extends Base<ForbiddenArray[]> implements Contract<List<ForbiddenType>> {",
                        "  public List<ForbiddenType> listed;",
                        "  public List<? extends WildcardExtendsForbidden> upper;",
                        "  public List<? super WildcardSuperForbidden> lower;",
                        "  public <M extends MethodBoundForbidden> PublicContract.NestedForbidden method(",
                        "      ArrayForbidden[][] arrays) throws ThrownForbidden {",
                        "    return null;",
                        "  }",
                        "}")
                .addSourceLines(
                        "probe/RecordSurface.java",
                        "package probe;",
                        "// BUG: Diagnostic matches: record-component",
                        "public record RecordSurface(PublicContract.NestedForbidden nested) { }")
                .addSourceLines(
                        "probe/Base.java",
                        "package probe;",
                        "public class Base<T> { }")
                .addSourceLines(
                        "probe/Contract.java",
                        "package probe;",
                        "public interface Contract<T> { }")
                .addSourceLines(
                        "probe/PublicContract.java",
                        "package probe;",
                        "public final class PublicContract {",
                        "  public static final class NestedForbidden { }",
                        "}")
                .addSourceLines(
                        "probe/ForbiddenTypes.java",
                        "package probe;",
                        "class ForbiddenType { }",
                        "class ClassBoundForbidden { }",
                        "class ForbiddenArray { }",
                        "class WildcardExtendsForbidden { }",
                        "class WildcardSuperForbidden { }",
                        "class MethodBoundForbidden { }",
                        "class ArrayForbidden { }",
                        "class ThrownForbidden extends Exception { }")
                .expectErrorMessage("traversal", containsAll(
                        "probe.ClassBoundForbidden",
                        "probe.Base",
                        "probe.ForbiddenArray",
                        "probe.Contract",
                        "probe.ForbiddenType",
                        "probe.WildcardExtendsForbidden",
                        "probe.WildcardSuperForbidden",
                        "probe.MethodBoundForbidden",
                        "probe.PublicContract.NestedForbidden",
                        "probe.ArrayForbidden",
                        "probe.ThrownForbidden"))
                .expectErrorMessage("record-component", containsAll("probe.PublicContract.NestedForbidden"))
                .doTest();
    }

    @BugPattern(
            name = "TypeMirrorReferenceProbe",
            summary = "Reports TypeMirror references collected from public signature surfaces.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class TypeMirrorReferenceProbeChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

        @Override
        public Description matchClass(ClassTree tree, VisitorState state) {
            if (!tree.getSimpleName().toString().endsWith("Surface")) {
                return Description.NO_MATCH;
            }
            TypeElement typeElement = ASTHelpers.getSymbol(tree);
            if (typeElement == null) {
                return Description.NO_MATCH;
            }
            Set<String> referencedTypes = new LinkedHashSet<>();
            collect(typeElement.getSuperclass(), referencedTypes);
            for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
                collect(implementedInterface, referencedTypes);
            }
            for (TypeParameterElement typeParameter : typeElement.getTypeParameters()) {
                for (TypeMirror bound : typeParameter.getBounds()) {
                    collect(bound, referencedTypes);
                }
            }
            if (typeElement.getKind() == ElementKind.RECORD) {
                for (RecordComponentElement recordComponent : typeElement.getRecordComponents()) {
                    collect(recordComponent.asType(), referencedTypes);
                }
            }
            for (VariableElement field : ElementFilter.fieldsIn(typeElement.getEnclosedElements())) {
                collect(field.asType(), referencedTypes);
            }
            for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
                collect(method.getReturnType(), referencedTypes);
                for (VariableElement parameter : method.getParameters()) {
                    collect(parameter.asType(), referencedTypes);
                }
                for (TypeMirror thrownType : method.getThrownTypes()) {
                    collect(thrownType, referencedTypes);
                }
                for (TypeParameterElement typeParameter : method.getTypeParameters()) {
                    for (TypeMirror bound : typeParameter.getBounds()) {
                        collect(bound, referencedTypes);
                    }
                }
                collect(method.asType(), referencedTypes);
            }
            return buildDescription(tree)
                    .setMessage("TypeMirror traversal references: " + String.join(", ", referencedTypes))
                    .build();
        }

        private static void collect(TypeMirror typeMirror, Set<String> referencedTypes) {
            TypeMirrorReferenceScanner.collectTypeReferences(typeMirror, referencedTypes);
        }
    }

    private static Predicate<String> containsAll(String... snippets) {
        return message -> {
            for (String snippet : snippets) {
                if (!message.contains(snippet)) {
                    return false;
                }
            }
            return true;
        };
    }
}
