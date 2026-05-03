import org.gradle.api.Task
import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.withGroovyBuilder
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.enforcement.EnforcementBundleDescriptor
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension

plugins {
    id("saltmarcher.enforcement-bundles")
}

val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
val activeEnforcementBundleIds = enforcementBundles.activeEnforcementBundleIds
val focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode

@Suppress("UNCHECKED_CAST")
val registerFocusedVerificationCompileTask = extra["saltmarcherRegisterFocusedVerificationCompileTask"] as
    (String, List<String>, String) -> TaskProvider<JavaCompile>
@Suppress("UNCHECKED_CAST")
val registerFocusedArchunitTestTask = extra["saltmarcherRegisterFocusedArchunitTestTask"] as
    (String, String, String, TaskProvider<JavaCompile>, List<String>, List<String>, List<String>, Boolean) -> TaskProvider<Test>
@Suppress("UNCHECKED_CAST")
val registerFocusedPmdTask = extra["saltmarcherRegisterFocusedPmdTask"] as
    (String, String, String, String, List<String>, List<String>) -> TaskProvider<Pmd>
@Suppress("UNCHECKED_CAST")
val registerFocusedJqassistantTaskPair = extra["saltmarcherRegisterFocusedJqassistantTaskPair"] as
    (String, String, String, String, String, String, String, String, TaskProvider<JavaCompile>) -> Pair<TaskProvider<*>, TaskProvider<*>>

fun descriptor(bundleId: String): EnforcementBundleDescriptor = enforcementBundles.descriptor(bundleId)

fun defaultBundleDisplayName(bundleId: String): String = bundleId.replaceFirstChar(Char::uppercaseChar)

fun configureMainCompileErrorProneChecks(checkerNames: List<String>) {
    if (checkerNames.isEmpty()) {
        return
    }
    tasks.named<JavaCompile>("compileJava") {
        val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
        errorproneOptions.withGroovyBuilder {
            checkerNames.forEach { checkName ->
                "error"(checkName)
            }
        }
    }
}

fun registerStandardBundle(bundleId: String) {
    val descriptor = descriptor(bundleId)
    val rootTaskName = descriptor.publicCheckTaskName()
    val checkerNames = descriptor.errorProneCheckers
    val bundleDisplayName = defaultBundleDisplayName(bundleId)

    configureMainCompileErrorProneChecks(checkerNames)

    val selectedCompileJava = if (descriptor.requiresFocusedCompile()) {
        val compileDescription = if (checkerNames.isEmpty()) {
            "Compile only the $bundleDisplayName verification slice."
        } else {
            "Compile only the $bundleDisplayName verification slice with the dedicated Error Prone checks enabled."
        }
        val compileTask = registerFocusedVerificationCompileTask(bundleId, checkerNames, compileDescription)
        if (focusedEnforcementBundleMode) compileTask else tasks.named<JavaCompile>("compileJava")
    } else {
        null
    }

    val aggregateDependencies = mutableListOf<Any>()
    selectedCompileJava?.let(aggregateDependencies::add)

    descriptor.archunit?.let { archunit ->
        val compileTask = selectedCompileJava
            ?: error("Missing selected compile task for ArchUnit enforcement bundle '$bundleId'.")
        val archunitTask = registerFocusedArchunitTestTask(
            bundleId,
            archunit.taskName,
            archunit.description,
            compileTask,
            archunit.sourceDirs,
            archunit.sourceIncludes,
            archunit.includePatterns,
            archunit.useSharedTestSupport
        )
        aggregateDependencies += archunitTask
    }

    descriptor.jqassistant?.let { jqassistant ->
        val compileTask = selectedCompileJava
            ?: error("Missing selected compile task for jQAssistant enforcement bundle '$bundleId'.")
        val (_, analyzeTask) = registerFocusedJqassistantTaskPair(
            bundleId,
            jqassistant.scanTaskName,
            jqassistant.analyzeTaskName,
            jqassistant.scanDescription,
            jqassistant.analyzeDescription,
            jqassistant.configPath,
            jqassistant.rulesDirPath,
            jqassistant.reportsDirPath,
            compileTask
        )
        aggregateDependencies += analyzeTask
    }

    descriptor.buildHarnessTaskMainClasses
        .keys
        .sortedBy(descriptor.taskNames::indexOf)
        .forEach { taskName ->
            aggregateDependencies += gradle.includedBuild("build-harness").task(":$taskName")
        }

    val pmdTask = descriptor.pmd?.let { pmd ->
        registerFocusedPmdTask(
            bundleId,
            pmd.taskName,
            pmd.description,
            pmd.rulesetPath,
            pmd.sourceRoots,
            pmd.sourceIncludes
        )
    }

    val directRootPmdTask = pmdTask?.takeIf {
        descriptor.pmd?.taskName == rootTaskName && aggregateDependencies.isEmpty()
    }
    if (pmdTask != null && directRootPmdTask == null) {
        aggregateDependencies += pmdTask
    }

    val rootTaskProvider: TaskProvider<out Task> = directRootPmdTask ?: tasks.register(rootTaskName) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = descriptor.rootTask?.description
            ?: "Run the focused $bundleDisplayName enforcement bundle through one root entrypoint."
        aggregateDependencies.forEach(::dependsOn)
    }

    if (descriptor.rootTask?.attachToCheckArchitecture == true) {
        tasks.matching { it.name == "checkArchitecture" }.configureEach {
            dependsOn(rootTaskProvider)
        }
    }
    if (descriptor.rootTask?.attachToCheck == true) {
        tasks.named("check") {
            dependsOn(rootTaskProvider)
        }
    }
}

activeEnforcementBundleIds
    .filter { bundleId -> descriptor(bundleId).rootPluginId == null }
    .forEach(::registerStandardBundle)

activeEnforcementBundleIds
    .mapNotNull { bundleId -> descriptor(bundleId).rootPluginId }
    .distinct()
    .forEach(pluginManager::apply)

val checkDocumentationEnforcement by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run all Markdown-backed architecture and enforcement documentation checks through the verification core."
    dependsOn(gradle.includedBuild("build-harness").task(":documentationEnforcementCheck"))
}

fun registerSurfaceTask(
    surfaceName: String,
    surfaceDescription: String,
    dependencyTaskName: String
) = tasks.register(surfaceName) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = surfaceDescription
    dependsOn(dependencyTaskName)
}

registerSurfaceTask(
    "production-build",
    "Run the public staged production-build verification surface.",
    "productionBuild"
)

registerSurfaceTask(
    "quality-hygiene",
    "Run the public staged non-architecture hygiene verification surface.",
    "checkQualityHygiene"
)

registerSurfaceTask(
    "architecture",
    "Run the public staged non-view architecture verification surface.",
    "checkArchitecture"
)

registerSurfaceTask(
    "view-topology",
    "Run the public staged passive-view topology verification surface.",
    "checkViewArchitecture"
)

registerSurfaceTask(
    "docs",
    "Run the public staged documentation verification surface.",
    "checkDocumentationEnforcement"
)

registerSurfaceTask(
    "metrics-report",
    "Run the public staged CKJM report surface.",
    "ckjmMain"
)

registerSurfaceTask(
    "desktop-install",
    "Run the public staged desktop installation surface.",
    "installDesktopApp"
)

tasks.register("production-handoff") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run the public staged production handoff surface."
    dependsOn("production-build")
    dependsOn("quality-hygiene")
    dependsOn("architecture")
    dependsOn("view-topology")
}
