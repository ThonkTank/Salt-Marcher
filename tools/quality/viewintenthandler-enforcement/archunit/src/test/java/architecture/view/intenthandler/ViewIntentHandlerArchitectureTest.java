package architecture.view.intenthandler;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import architecture.view.ViewRolePredicates;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.reflect.GenericArrayType;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.lang.reflect.TypeVariable;
import java.lang.reflect.WildcardType;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.stream.Stream;

@AnalyzeMainClasses
public final class ViewIntentHandlerArchitectureTest {

    private static final ConcurrentHashMap<String, Set<String>> PACKAGE_TOP_LEVEL_CLASS_CACHE = new ConcurrentHashMap<>();

    private ViewIntentHandlerArchitectureTest() {
    }

    @ArchTest
    static final ArchRule intentHandlersMustStayShellDomainAndDataFree =
            noClasses()
                    .that(ViewRolePredicates.areIntentHandlers())
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("shell..", "src.domain..", "src.data..", "bootstrap..");

    @ArchTest
    static final ArchRule intentHandlersWithPublishedEventSinkMustOwnMatchingPublishedEvents =
            classes()
                    .that(ViewRolePredicates.areIntentHandlers())
                    .should(ownMatchingPublishedEventForPublishedEventSink());

    private static ArchCondition<JavaClass> ownMatchingPublishedEventForPublishedEventSink() {
        return new ArchCondition<>("own a same-package PublishedEvent when exposing onPublishedEventRequested(Consumer<PublishedEvent>)") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                PublishedEventSinkInspection sinkInspection = inspectPublishedEventSinks(item.getName());
                String packageName = item.getPackageName();
                for (String violation : sinkInspection.violations()) {
                    events.add(SimpleConditionEvent.violated(item, item.getName() + " " + violation));
                }
                if (sinkInspection.publishedEventSimpleNames().isEmpty()) {
                    return;
                }
                Set<String> packageClassNames = topLevelClassNamesInPackage(packageName);
                for (String publishedEventSimpleName : sinkInspection.publishedEventSimpleNames()) {
                    if (!packageClassNames.contains(publishedEventSimpleName)) {
                        events.add(SimpleConditionEvent.violated(
                                item,
                                item.getName() + " exposes onPublishedEventRequested(...) for "
                                        + packageName + "." + publishedEventSimpleName
                                        + " but the package defines no matching local PublishedEvent"));
                    }
                }
            }
        };
    }

    private static PublishedEventSinkInspection inspectPublishedEventSinks(String className) {
        Class<?> reflectedClass = loadClass(className);
        Set<String> publishedEventSimpleNames = new LinkedHashSet<>();
        Set<String> violations = new LinkedHashSet<>();
        for (Method method : reflectedClass.getDeclaredMethods()) {
            if (Modifier.isPrivate(method.getModifiers())) {
                continue;
            }
            Set<String> referencedPublishedEvents = samePackagePublishedEventsInParameters(
                    method,
                    reflectedClass.getPackageName());
            if (isExactPublishedEventSinkMethod(method, reflectedClass.getPackageName())) {
                publishedEventSimpleNames.addAll(referencedPublishedEvents);
                continue;
            }
            if ("onPublishedEventRequested".equals(method.getName())) {
                violations.add("declares non-exact PublishedEvent sink method '" + renderSignature(method)
                        + "'; the only legal write-side seam is onPublishedEventRequested(Consumer<SamePackagePublishedEvent>)");
                continue;
            }
            if (!referencedPublishedEvents.isEmpty()) {
                violations.add("exposes alternate non-private PublishedEvent seam '" + renderSignature(method)
                        + "' for " + String.join(", ", referencedPublishedEvents));
            }
        }
        return new PublishedEventSinkInspection(Set.copyOf(publishedEventSimpleNames), Set.copyOf(violations));
    }

    private static boolean isExactPublishedEventSinkMethod(Method method, String expectedPackageName) {
        if (!"onPublishedEventRequested".equals(method.getName())
                || method.getParameterCount() != 1
                || method.getReturnType() != void.class
                || method.getParameterTypes()[0] != Consumer.class) {
            return false;
        }
        Set<String> referencedPublishedEvents = samePackagePublishedEvents(method.getGenericParameterTypes()[0], expectedPackageName);
        return referencedPublishedEvents.size() == 1;
    }

    private static Set<String> samePackagePublishedEventsInParameters(Method method, String expectedPackageName) {
        Set<String> referencedPublishedEvents = new LinkedHashSet<>();
        for (Type parameterType : method.getGenericParameterTypes()) {
            referencedPublishedEvents.addAll(samePackagePublishedEvents(parameterType, expectedPackageName));
        }
        return referencedPublishedEvents;
    }

    private static Set<String> samePackagePublishedEvents(Type type, String expectedPackageName) {
        Set<String> referencedPublishedEvents = new LinkedHashSet<>();
        collectSamePackagePublishedEvents(type, expectedPackageName, referencedPublishedEvents);
        return referencedPublishedEvents;
    }

    private static void collectSamePackagePublishedEvents(
            Type type,
            String expectedPackageName,
            Set<String> referencedPublishedEvents
    ) {
        if (type instanceof Class<?> eventClass) {
            if (eventClass.getPackageName().equals(expectedPackageName)
                    && eventClass.getSimpleName().endsWith("PublishedEvent")) {
                referencedPublishedEvents.add(eventClass.getSimpleName());
            }
            return;
        }
        if (type instanceof ParameterizedType parameterizedType) {
            collectSamePackagePublishedEvents(parameterizedType.getRawType(), expectedPackageName, referencedPublishedEvents);
            for (Type actualTypeArgument : parameterizedType.getActualTypeArguments()) {
                collectSamePackagePublishedEvents(actualTypeArgument, expectedPackageName, referencedPublishedEvents);
            }
            return;
        }
        if (type instanceof GenericArrayType genericArrayType) {
            collectSamePackagePublishedEvents(genericArrayType.getGenericComponentType(), expectedPackageName, referencedPublishedEvents);
            return;
        }
        if (type instanceof WildcardType wildcardType) {
            for (Type upperBound : wildcardType.getUpperBounds()) {
                collectSamePackagePublishedEvents(upperBound, expectedPackageName, referencedPublishedEvents);
            }
            for (Type lowerBound : wildcardType.getLowerBounds()) {
                collectSamePackagePublishedEvents(lowerBound, expectedPackageName, referencedPublishedEvents);
            }
            return;
        }
        if (type instanceof TypeVariable<?> typeVariable) {
            for (Type bound : typeVariable.getBounds()) {
                collectSamePackagePublishedEvents(bound, expectedPackageName, referencedPublishedEvents);
            }
        }
    }

    private static String renderSignature(Method method) {
        StringBuilder builder = new StringBuilder(method.getName()).append('(');
        Type[] parameterTypes = method.getGenericParameterTypes();
        for (int index = 0; index < parameterTypes.length; index++) {
            if (index > 0) {
                builder.append(", ");
            }
            builder.append(parameterTypes[index].getTypeName());
        }
        builder.append(')');
        return builder.toString();
    }

    private static Class<?> loadClass(String className) {
        try {
            return Class.forName(className, false, Thread.currentThread().getContextClassLoader());
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Could not load compiled class " + className, exception);
        }
    }

    private static Set<String> topLevelClassNamesInPackage(String packageName) {
        return PACKAGE_TOP_LEVEL_CLASS_CACHE.computeIfAbsent(packageName, ViewIntentHandlerArchitectureTest::scanTopLevelClassNames);
    }

    private static Set<String> scanTopLevelClassNames(String packageName) {
        Path packageDirectory = mainClassesDir().resolve(packageName.replace('.', '/'));
        if (!Files.isDirectory(packageDirectory)) {
            return Set.of();
        }
        try (Stream<Path> files = Files.list(packageDirectory)) {
            Set<String> classNames = new LinkedHashSet<>();
            files.filter(path -> path.getFileName().toString().endsWith(".class"))
                    .map(path -> path.getFileName().toString())
                    .filter(fileName -> !fileName.contains("$"))
                    .map(fileName -> fileName.substring(0, fileName.length() - ".class".length()))
                    .forEach(classNames::add);
            return Set.copyOf(classNames);
        } catch (IOException exception) {
            throw new UncheckedIOException("Could not scan compiled classes for package " + packageName, exception);
        }
    }

    private static Path mainClassesDir() {
        String mainClassesDir = System.getProperty("saltmarcher.mainClassesDir");
        if (mainClassesDir == null || mainClassesDir.isBlank()) {
            throw new IllegalStateException("saltmarcher.mainClassesDir is not set");
        }
        return Path.of(mainClassesDir);
    }

    private record PublishedEventSinkInspection(
            Set<String> publishedEventSimpleNames,
            Set<String> violations
    ) {
    }
}
