package architecture.view.viewinputevent;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import architecture.view.ViewRolePredicates;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaMethodCall;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.RecordComponent;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.stream.Stream;

@AnalyzeMainClasses
public final class ViewInputEventArchitectureTest {

    private static final ConcurrentHashMap<String, Set<String>> PACKAGE_TOP_LEVEL_CLASS_CACHE = new ConcurrentHashMap<>();

    private ViewInputEventArchitectureTest() {
    }

    @ArchTest
    static final ArchRule viewInputEventsMustStayShellDomainDataAndServiceFree =
            noClasses()
                    .that(ViewRolePredicates.areViewInputEvents())
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("shell..", "src.domain..", "src.data..", "bootstrap..")
                    .orShould()
                    .dependOnClassesThat()
                    .haveSimpleNameEndingWith("ApplicationService");

    @ArchTest
    static final ArchRule interactiveViewsMustOwnSameStemViewInputEvents =
            classes()
                    .that(ViewRolePredicates.arePassiveViews())
                    .should(declareSameStemViewInputEventAndRequiredHandler());

    @ArchTest
    static final ArchRule viewInputEventsMustBelongToInteractiveSameStemViews =
            classes()
                    .that(ViewRolePredicates.areViewInputEvents())
                    .should(belongToInteractiveSameStemView());

    @ArchTest
    static final ArchRule viewInputEventsMustOwnMatchingIntentHandlerConsumeOverload =
            classes()
                    .that(ViewRolePredicates.areViewInputEvents())
                    .should(declareLocalIntentHandlerConsumeOverload());

    @ArchTest
    static final ArchRule viewInputEventsMustNotDeclareDeadSnapshotComponents =
            classes()
                    .that(ViewRolePredicates.areViewInputEvents())
                    .should(exposeOnlyComponentsConsumedByLocalIntentHandler());

    private static ArchCondition<JavaClass> declareSameStemViewInputEventAndRequiredHandler() {
        return new ArchCondition<>("declare a same-stem ViewInputEvent and require a local IntentHandler only for active roots when exposing onViewInputEvent") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (!declaresInteractiveViewInputSeam(item)) {
                    return;
                }
                String packageName = item.getPackageName();
                Set<String> packageClassNames = topLevelClassNamesInPackage(packageName);
                String expectedViewInputEvent = expectedViewInputEventSimpleName(item.getSimpleName());
                if (!packageClassNames.contains(expectedViewInputEvent)) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " exposes onViewInputEvent(...) but is missing "
                                    + packageName + "." + expectedViewInputEvent));
                }
                if (isReusableSlotcontentPackage(packageName)) {
                    return;
                }
                if (countClassesEndingWith(packageClassNames, "IntentHandler") == 0) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " exposes onViewInputEvent(...) but its package defines no local *IntentHandler"));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> belongToInteractiveSameStemView() {
        return new ArchCondition<>("belong to an interactive same-stem View, with a local IntentHandler only for active roots") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String packageName = item.getPackageName();
                Set<String> packageClassNames = topLevelClassNamesInPackage(packageName);
                String expectedView = expectedViewSimpleName(item.getSimpleName());
                if (!packageClassNames.contains(expectedView)) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " has no same-package same-stem passive View " + packageName + "." + expectedView));
                    return;
                }
                if (!declaresInteractiveViewInputSeam(packageName + "." + expectedView)) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " belongs to " + packageName + "." + expectedView
                                    + " but that View does not expose a valid onViewInputEvent(Consumer<SameStemViewInputEvent>) seam"));
                }
                if (isReusableSlotcontentPackage(packageName)) {
                    return;
                }
                if (countClassesEndingWith(packageClassNames, "IntentHandler") == 0) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " exists without a local *IntentHandler"));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> exposeOnlyComponentsConsumedByLocalIntentHandler() {
        return new ArchCondition<>("declare only record components consumed by a co-located IntentHandler when such a consume entrypoint exists") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                Class<?> eventClass = loadClass(item.getName());
                if (isReusableSlotcontentPackage(item.getPackageName())) {
                    return;
                }
                if (!eventClass.isRecord()) {
                    return;
                }
                RecordComponent[] components = eventClass.getRecordComponents();
                if (components.length == 0) {
                    return;
                }
                Optional<JavaClass> handlerClass = localIntentHandlerFor(item, eventClass);
                if (handlerClass.isEmpty()) {
                    return;
                }
                Set<String> consumedComponents = consumedRecordComponents(handlerClass.get(), eventClass);
                Set<String> missingComponents = new LinkedHashSet<>();
                for (RecordComponent component : components) {
                    if (!consumedComponents.contains(component.getName())) {
                        missingComponents.add(component.getName());
                    }
                }
                if (missingComponents.isEmpty()) {
                    return;
                }
                events.add(SimpleConditionEvent.violated(
                        item,
                        item.getName() + " declares ViewInputEvent components that the co-located IntentHandler never reads: "
                                + String.join(", ", missingComponents)));
            }
        };
    }

    private static ArchCondition<JavaClass> declareLocalIntentHandlerConsumeOverload() {
        return new ArchCondition<>("declare a co-located IntentHandler consume overload for the same ViewInputEvent type") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                Class<?> eventClass = loadClass(item.getName());
                if (isReusableSlotcontentPackage(item.getPackageName())) {
                    return;
                }
                if (localIntentHandlerFor(item, eventClass).isPresent()) {
                    return;
                }
                events.add(SimpleConditionEvent.violated(
                        item,
                        item.getName() + " has no co-located *IntentHandler.consume("
                                + item.getSimpleName() + ") overload"));
            }
        };
    }

    private static boolean declaresInteractiveViewInputSeam(JavaClass javaClass) {
        return declaresInteractiveViewInputSeam(javaClass.getName());
    }

    private static boolean declaresInteractiveViewInputSeam(String className) {
        Class<?> reflectedClass = loadClass(className);
        String expectedViewInputEvent = expectedViewInputEventSimpleName(reflectedClass.getSimpleName());
        for (Method method : reflectedClass.getDeclaredMethods()) {
            if (!"onViewInputEvent".equals(method.getName())) {
                continue;
            }
            int modifiers = method.getModifiers();
            if (Modifier.isPrivate(modifiers)) {
                continue;
            }
            if (method.getParameterCount() != 1
                    || method.getReturnType() != void.class
                    || method.getParameterTypes()[0] != Consumer.class) {
                continue;
            }
            Type genericParameter = method.getGenericParameterTypes()[0];
            if (!(genericParameter instanceof ParameterizedType parameterizedType)
                    || parameterizedType.getRawType() != Consumer.class
                    || parameterizedType.getActualTypeArguments().length != 1) {
                continue;
            }
            Type eventType = parameterizedType.getActualTypeArguments()[0];
            if (!(eventType instanceof Class<?> eventClass)) {
                continue;
            }
            if (eventClass.getPackageName().equals(reflectedClass.getPackageName())
                    && eventClass.getSimpleName().equals(expectedViewInputEvent)) {
                return true;
            }
        }
        return false;
    }

    private static Optional<JavaClass> localIntentHandlerFor(JavaClass eventClass, Class<?> reflectedEventClass) {
        return eventClass.getPackage().getClasses().stream()
                .filter(javaClass -> javaClass.getSimpleName().endsWith("IntentHandler"))
                .filter(javaClass -> declaresConsumeOverload(javaClass.getName(), reflectedEventClass))
                .findFirst();
    }

    private static boolean declaresConsumeOverload(String handlerClassName, Class<?> eventClass) {
        Class<?> handlerClass = loadClass(handlerClassName);
        for (Method method : handlerClass.getDeclaredMethods()) {
            if ("consume".equals(method.getName())
                    && method.getParameterCount() == 1
                    && method.getParameterTypes()[0].equals(eventClass)) {
                return true;
            }
        }
        return false;
    }

    private static Set<String> consumedRecordComponents(JavaClass handlerClass, Class<?> eventClass) {
        Set<String> componentNames = Arrays.stream(eventClass.getRecordComponents())
                .map(RecordComponent::getName)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        Set<String> consumedComponents = new LinkedHashSet<>();
        for (JavaMethod method : handlerClass.getMethods()) {
            for (JavaMethodCall call : method.getMethodCallsFromSelf()) {
                if (!Objects.equals(call.getTargetOwner().getName(), eventClass.getName())) {
                    continue;
                }
                String targetName = call.getTarget().getName();
                if (componentNames.contains(targetName)) {
                    consumedComponents.add(targetName);
                }
            }
        }
        return Set.copyOf(consumedComponents);
    }

    private static Class<?> loadClass(String className) {
        try {
            return Class.forName(className, false, Thread.currentThread().getContextClassLoader());
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Could not load compiled class " + className, exception);
        }
    }

    private static Set<String> topLevelClassNamesInPackage(String packageName) {
        return PACKAGE_TOP_LEVEL_CLASS_CACHE.computeIfAbsent(packageName, ViewInputEventArchitectureTest::scanTopLevelClassNames);
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

    private static int countClassesEndingWith(Set<String> classNames, String suffix) {
        int count = 0;
        for (String className : classNames) {
            if (className.endsWith(suffix)) {
                count++;
            }
        }
        return count;
    }

    private static boolean isReusableSlotcontentPackage(String packageName) {
        return packageName.startsWith("src.view.slotcontent.");
    }

    private static String expectedViewInputEventSimpleName(String viewSimpleName) {
        return viewSimpleName + "InputEvent";
    }

    private static String expectedViewSimpleName(String viewInputEventSimpleName) {
        return viewInputEventSimpleName.replaceFirst("InputEvent$", "");
    }

    private static Path mainClassesDir() {
        String mainClassesDir = System.getProperty("saltmarcher.mainClassesDir");
        if (mainClassesDir == null || mainClassesDir.isBlank()) {
            throw new IllegalStateException("saltmarcher.mainClassesDir is not set");
        }
        return Path.of(mainClassesDir);
    }
}
