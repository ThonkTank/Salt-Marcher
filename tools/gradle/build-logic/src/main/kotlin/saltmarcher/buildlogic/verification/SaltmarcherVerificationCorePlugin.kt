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
import saltmarcher.buildlogic.enforcement.standardVerificationSurfaceCatalog

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
    val verificationSurfaceCatalog = standardVerificationSurfaceCatalog(enforcementBundles.catalog)

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
        val rootTaskName = descriptor.entryTaskName
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
        aggregateDependencies.addAll(
            descriptor.dependentBundleIds.map { dependencyBundleId ->
                tasks.named(descriptor(dependencyBundleId).entryTaskName)
            }
        )

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
                archunit.sourceIncludes,
                archunit.includePatterns
            )
            aggregateDependencies += archunitTask
        }

        descriptor.utilityTasks.forEach { utilityTask ->
            aggregateDependencies += verificationHarness.registerUtilityVerificationTask(
                utilityTask.taskName,
                utilityTask.kind
            )
        }

        aggregateDependencies.addAll(
            descriptor.buildHarnessTasks.map { task ->
                gradle.includedBuild("build-harness").task(":${task.taskName}")
            }
        )

        tasks.register(rootTaskName) {
            description = descriptor.entryTaskDescription.ifBlank {
                "Internal entry task for the $bundleDisplayName enforcement bundle."
            }
            aggregateDependencies.forEach(::dependsOn)
        }
    }

    activeEnforcementBundleIds
        .forEach(::registerStandardBundle)

    verificationSurfaceCatalog.surfacesInOrder.forEach { surface ->
        val activeSurfaceBundleIds = surface.bundleIds.filter(activeEnforcementBundleIds::contains)
        tasks.register(surface.publicTaskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = surface.description
            activeSurfaceBundleIds
                .map(::descriptor)
                .map(EnforcementBundleDescriptor::entryTaskName)
                .forEach(::dependsOn)
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
        "Run the public staged closed-world view-layer topology verification surface.",
        descriptor("viewLayer").entryTaskName
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
