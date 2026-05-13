package saltmarcher.buildlogic.verification

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.ExtensionAware
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
    val publicVerificationSurfaceNames = verificationSurfaceCatalog.surfacesInOrder
        .map { surface -> surface.publicTaskName }

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
        val selectorTaskName = descriptor.selectorTaskName
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
                tasks.named(descriptor(dependencyBundleId).selectorTaskName)
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

        descriptor.jqassistant?.let { jqassistant ->
            aggregateDependencies += verificationHarness.registerJqassistantTask(bundleId, jqassistant)
        }

        aggregateDependencies.addAll(
            descriptor.buildHarnessTasks.map { task ->
                gradle.includedBuild("build-harness").task(":${task.taskName}")
            }
        )

        tasks.register(selectorTaskName) {
            description = descriptor.selectorTaskDescription.ifBlank {
                "Internal selector for the $bundleDisplayName enforcement bundle."
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
                .map(EnforcementBundleDescriptor::selectorTaskName)
                .forEach(::dependsOn)
        }
    }

    val checkDocumentationEnforcement = tasks.register("checkDocumentationEnforcement") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run all Markdown-backed architecture and enforcement documentation checks through the verification core."
        dependsOn(gradle.includedBuild("build-harness").task(":documentationEnforcementCheck"))
    }

    val checkArchitecture = tasks.register("checkArchitecture") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the public architecture aggregate through the canonical layer surfaces and internal architecture owners."
        dependsOn("architectureTest")
        dependsOn(gradle.includedBuild("build-harness").task(":architectureCheck"))
        publicVerificationSurfaceNames.forEach(::dependsOn)
    }

    tasks.register("desktop-install") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the convenience desktop installation path after a green local handoff."
        dependsOn("installDesktopApp")
    }

    tasks.register("production-handoff") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the public production handoff surface through the small verification API and internal quality owners."
        dependsOn("assemble")
        dependsOn("test")
        dependsOn(checkArchitecture)
        dependsOn("pmdMain")
        dependsOn("spotbugsMain")
        dependsOn("cpdMain")
        dependsOn("lizardMain")
        dependsOn("checkNoCompiledArtifactsInSource")
        dependsOn("checkNoDeadCode")
        dependsOn("pmdStrictMain")
    }

}
