package saltmarcher.quality.errorprone;

import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Element;
import javax.lang.model.element.TypeElement;
import javax.lang.model.type.ArrayType;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.ErrorType;
import javax.lang.model.type.ExecutableType;
import javax.lang.model.type.IntersectionType;
import javax.lang.model.type.NoType;
import javax.lang.model.type.NullType;
import javax.lang.model.type.PrimitiveType;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.type.TypeVariable;
import javax.lang.model.type.UnionType;
import javax.lang.model.type.WildcardType;
import javax.lang.model.util.SimpleTypeVisitor14;

public final class TypeMirrorReferenceScanner {

    private TypeMirrorReferenceScanner() {
    }

    public static Set<String> collectTypeReferences(TypeMirror typeMirror) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        collectTypeReferences(typeMirror, referencedTypes);
        return referencedTypes;
    }

    public static void collectTypeReferences(TypeMirror typeMirror, Set<String> referencedTypes) {
        if (typeMirror == null) {
            return;
        }
        Set<TypeMirror> visitedTypeMirrors = Collections.newSetFromMap(new IdentityHashMap<>());
        typeMirror.accept(new SimpleTypeVisitor14<Void, Void>() {
            @Override
            public Void visitDeclared(DeclaredType declaredType, Void unused) {
                if (!visitOnce(declaredType)) {
                    return null;
                }
                Element element = declaredType.asElement();
                if (element instanceof TypeElement typeElement) {
                    addReference(typeElement.getQualifiedName().toString(), referencedTypes);
                }
                for (TypeMirror typeArgument : declaredType.getTypeArguments()) {
                    scanType(typeArgument);
                }
                return null;
            }

            @Override
            public Void visitArray(ArrayType arrayType, Void unused) {
                if (!visitOnce(arrayType)) {
                    return null;
                }
                scanType(arrayType.getComponentType());
                return null;
            }

            @Override
            public Void visitTypeVariable(TypeVariable typeVariable, Void unused) {
                if (!visitOnce(typeVariable)) {
                    return null;
                }
                scanType(typeVariable.getUpperBound());
                TypeMirror lowerBound = typeVariable.getLowerBound();
                if (lowerBound != null) {
                    scanType(lowerBound);
                }
                return null;
            }

            @Override
            public Void visitWildcard(WildcardType wildcardType, Void unused) {
                if (!visitOnce(wildcardType)) {
                    return null;
                }
                scanType(wildcardType.getExtendsBound());
                scanType(wildcardType.getSuperBound());
                return null;
            }

            @Override
            public Void visitExecutable(ExecutableType executableType, Void unused) {
                if (!visitOnce(executableType)) {
                    return null;
                }
                scanType(executableType.getReturnType());
                for (TypeMirror parameterType : executableType.getParameterTypes()) {
                    scanType(parameterType);
                }
                for (TypeMirror thrownType : executableType.getThrownTypes()) {
                    scanType(thrownType);
                }
                for (TypeMirror typeVariable : executableType.getTypeVariables()) {
                    scanType(typeVariable);
                }
                return null;
            }

            @Override
            public Void visitIntersection(IntersectionType intersectionType, Void unused) {
                if (!visitOnce(intersectionType)) {
                    return null;
                }
                for (TypeMirror bound : intersectionType.getBounds()) {
                    scanType(bound);
                }
                return null;
            }

            @Override
            public Void visitUnion(UnionType unionType, Void unused) {
                if (!visitOnce(unionType)) {
                    return null;
                }
                for (TypeMirror alternative : unionType.getAlternatives()) {
                    scanType(alternative);
                }
                return null;
            }

            @Override
            public Void visitError(ErrorType errorType, Void unused) {
                if (!visitOnce(errorType)) {
                    return null;
                }
                Element element = errorType.asElement();
                if (element instanceof TypeElement typeElement) {
                    addReference(typeElement.getQualifiedName().toString(), referencedTypes);
                }
                return null;
            }

            @Override
            public Void visitNoType(NoType noType, Void unused) {
                return null;
            }

            @Override
            public Void visitPrimitive(PrimitiveType primitiveType, Void unused) {
                return null;
            }

            @Override
            public Void visitNull(NullType nullType, Void unused) {
                return null;
            }

            @Override
            protected Void defaultAction(TypeMirror ignored, Void unused) {
                return null;
            }

            private void scanType(TypeMirror candidateTypeMirror) {
                if (candidateTypeMirror != null) {
                    candidateTypeMirror.accept(this, null);
                }
            }

            private boolean visitOnce(TypeMirror candidateTypeMirror) {
                return visitedTypeMirrors.add(candidateTypeMirror);
            }
        }, null);
    }

    private static void addReference(String qualifiedName, Set<String> referencedTypes) {
        if (qualifiedName != null && !qualifiedName.isBlank()) {
            referencedTypes.add(qualifiedName);
        }
    }
}
