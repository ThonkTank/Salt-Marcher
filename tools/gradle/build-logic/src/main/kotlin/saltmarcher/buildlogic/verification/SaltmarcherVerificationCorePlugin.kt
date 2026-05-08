package saltmarcher.buildlogic.verification

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.withGroovyBuilder
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.enforcement.EnforcementBundleDescriptor
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension

class SaltmarcherVerificationCorePlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.pluginManager.apply("saltmarcher.enforcement-bundles")
        project.configureVerificationCore()
    }
}

internal fun Project.configureVerificationCore() {
    val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
    val activeEnforcementBundleIds = enforcementBundles.activeEnforcementBundleIds
    val focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode
    val verificationHarness = extensions.getByType<VerificationHarnessExtension>()

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
            val compileTask = verificationHarness.registerFocusedVerificationCompileTask(bundleId, checkerNames, compileDescription)
            if (focusedEnforcementBundleMode) compileTask else tasks.named<JavaCompile>("compileJava")
        } else {
            null
        }

        val aggregateDependencies = mutableListOf<Any>()

        if (checkerNames.isNotEmpty()) {
            val compileTask = selectedCompileJava
                ?: tasks.named<JavaCompile>("compileJava")
            aggregateDependencies += compileTask
        }

        descriptor.archunit?.let { archunit ->
            val compileTask = selectedCompileJava
                ?: error("Missing selected compile task for ArchUnit enforcement bundle '$bundleId'.")
            val archunitTask = verificationHarness.registerFocusedArchunitTestTask(
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

        descriptor.jqassistantTasks
            .takeIf(List<*>::isNotEmpty)
            ?.let { jqassistantTasks ->
                val compileTask = selectedCompileJava
                    ?: error("Missing selected compile task for jQAssistant enforcement bundle '$bundleId'.")
                jqassistantTasks.forEach { jqassistant ->
                    val taskPair = verificationHarness.registerFocusedJqassistantTaskPair(
                        bundleId,
                        jqassistant.scanTaskName,
                        jqassistant.analyzeTaskName,
                        jqassistant.scanDescription,
                        jqassistant.analyzeDescription,
                        jqassistant.ruleGroups,
                        jqassistant.rulesDirPaths,
                        jqassistant.reportsDirPath,
                        compileTask
                    )
                    if (jqassistant.taskName == rootTaskName) {
                        aggregateDependencies += taskPair.analyzeTask
                    } else {
                        tasks.register(jqassistant.taskName) {
                            group = LifecycleBasePlugin.VERIFICATION_GROUP
                            description = jqassistant.analyzeDescription
                            dependsOn(taskPair.analyzeTask)
                        }
                    }
                }
            }

        val buildHarnessTasks = descriptor.buildHarnessTaskMainClasses
            .keys
            .sortedBy(descriptor.taskNames::indexOf)
            .associateWith { taskName -> gradle.includedBuild("build-harness").task(":$taskName") }

        buildHarnessTasks
            .filterKeys { taskName -> taskName.startsWith("check") && taskName != rootTaskName }
            .forEach { (taskName, taskDependency) ->
                tasks.register(taskName) {
                    group = LifecycleBasePlugin.VERIFICATION_GROUP
                    description = "Run the focused $bundleDisplayName verification surface '$taskName'."
                    dependsOn(taskDependency)
                }
            }

        val aggregateBuildHarnessTasks = buildHarnessTasks
            .filterKeys { taskName -> !taskName.startsWith("check") || taskName == rootTaskName }
            .values
        aggregateDependencies.addAll(aggregateBuildHarnessTasks)

        val pmdTasks = descriptor.pmdTasks.associateBy(
            keySelector = { pmd -> pmd.taskName },
            valueTransform = { pmd ->
                verificationHarness.registerFocusedPmdTask(
                    bundleId,
                    pmd.taskName,
                    pmd.description,
                    pmd.rulesetPath,
                    pmd.sourceRoots,
                    pmd.sourceIncludes,
                    pmd.ignoreFailures,
                    pmd.consoleOutput
                )
            }
        )

        val aggregatePmdTasks = descriptor.pmdTasks
            .filterNot { pmd -> pmd.taskName.startsWith("check") && pmd.taskName != rootTaskName }
            .map { pmd -> pmdTasks.getValue(pmd.taskName) }

        val rootPmdTask = pmdTasks[rootTaskName]
        aggregateDependencies.addAll(aggregatePmdTasks.filter { taskProvider -> taskProvider != rootPmdTask })

        val directRootPmdTask = rootPmdTask?.takeIf {
            aggregateDependencies.isEmpty()
        }
        val rootTaskProvider: TaskProvider<out Task> = directRootPmdTask ?: tasks.register(rootTaskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = descriptor.rootTask?.description
                ?: "Run the focused $bundleDisplayName enforcement bundle through one root entrypoint."
            aggregateDependencies.forEach(::dependsOn)
            rootPmdTask?.let { dependsOn(it) }
        }

        if (descriptor.rootTask?.attachToCheckArchitecture == true) {
            verificationHarness.checkArchitecture.configure {
                dependsOn(rootTaskProvider)
            }
        }
        if (descriptor.rootTask?.attachToCheck == true) {
            verificationHarness.check.configure {
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

    val viewRefactorCandidatesBundleId = enforcementBundles.catalog.taskToBundleId["checkViewRefactorCandidates"]
    if (viewRefactorCandidatesBundleId != null && activeEnforcementBundleIds.contains(viewRefactorCandidatesBundleId)) {
        verificationHarness.checkViewArchitecture.configure {
            dependsOn(tasks.named("checkViewRefactorCandidates"))
        }
    }

    val checkDocumentationEnforcement = tasks.register("checkDocumentationEnforcement") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run all Markdown-backed architecture and enforcement documentation checks through the verification core."
        dependsOn(gradle.includedBuild("build-harness").task(":documentationEnforcementCheck"))
    }

    fun registerSurfaceTask(
        surfaceName: String,
        surfaceDescription: String,
        dependency: Any
    ) = tasks.register(surfaceName) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = surfaceDescription
        dependsOn(dependency)
    }

    val productionBuild = registerSurfaceTask(
        "production-build",
        "Run the public staged production-build verification surface.",
        verificationHarness.productionBuild
    )

    val qualityHygiene = registerSurfaceTask(
        "quality-hygiene",
        "Run the public staged non-architecture hygiene verification surface.",
        verificationHarness.checkQualityHygiene
    )

    val architecture = registerSurfaceTask(
        "architecture",
        "Run the public staged non-view architecture verification surface.",
        verificationHarness.checkArchitecture
    )

    val viewTopology = registerSurfaceTask(
        "view-topology",
        "Run the public staged passive-view topology verification surface.",
        verificationHarness.checkViewArchitecture
    )

    val docs = registerSurfaceTask(
        "docs",
        "Run the public staged documentation verification surface.",
        checkDocumentationEnforcement
    )

    val metricsReport = registerSurfaceTask(
        "metrics-report",
        "Run the public staged CKJM report surface.",
        verificationHarness.ckjmMain
    )

    val desktopInstall = registerSurfaceTask(
        "desktop-install",
        "Run the public staged desktop installation surface.",
        "installDesktopApp"
    )

    val productionHandoff = tasks.register("production-handoff") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the public staged production handoff surface."
        dependsOn(productionBuild)
        dependsOn(qualityHygiene)
        dependsOn(architecture)
        dependsOn(viewTopology)
    }

}
