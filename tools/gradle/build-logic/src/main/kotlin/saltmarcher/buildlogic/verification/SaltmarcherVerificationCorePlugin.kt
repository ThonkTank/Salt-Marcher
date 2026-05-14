package saltmarcher.buildlogic.verification

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.TaskProvider
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.enforcement.BuildHarnessTaskKind
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
    val verificationHarness = extensions.getByType<VerificationHarnessExtension>()
    val verificationSurfaceCatalog = standardVerificationSurfaceCatalog(enforcementBundles.catalog)
    val verificationLifecycleCatalog = standardVerificationLifecycleCatalog()
    val publicVerificationSurfaceNames = verificationSurfaceCatalog.surfacesInOrder
        .map { surface -> surface.publicTaskName }

    fun descriptor(bundleId: String): EnforcementBundleDescriptor = enforcementBundles.descriptor(bundleId)

    fun defaultBundleDisplayName(bundleId: String): String = bundleId.replaceFirstChar(Char::uppercaseChar)

    val focusedCompileTasksByBundleId = registerFocusedCompileTasksByBundleId(
        activeEnforcementBundleIds.map(::descriptor),
        verificationHarness
    )

    fun registerStandardBundle(bundleId: String) {
        val descriptor = descriptor(bundleId)
        val selectorTaskName = descriptor.selectorTaskName
        val checkerNames = descriptor.errorProneCheckers
        val bundleDisplayName = defaultBundleDisplayName(bundleId)

        val selectedCompileJava = if (descriptor.requiresFocusedCompile()) {
            focusedCompileTasksByBundleId[bundleId]
                ?: error("Missing coalesced focused compile task for enforcement bundle '$bundleId'.")
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

        if (descriptor.buildHarnessTasks.any { task -> task.kind == BuildHarnessTaskKind.TOPOLOGY }) {
            aggregateDependencies.addAll(
                verificationSurfaceCatalog.surfacesForBundle(bundleId)
                    .map { surface -> gradle.includedBuild("build-harness").task(":${surface.buildHarnessTaskName(BuildHarnessTaskKind.TOPOLOGY)}") }
            )
        }

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

    val productionHandoffSurface = verificationLifecycleCatalog.surface("production-handoff")
    tasks.register(productionHandoffSurface.publicTaskName) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = productionHandoffSurface.description
        productionHandoffSurface.dependencyTaskNames.forEach(::dependsOn)
    }

}

private fun registerFocusedCompileTasksByBundleId(
    descriptors: List<EnforcementBundleDescriptor>,
    verificationHarness: VerificationHarnessExtension
): Map<String, TaskProvider<JavaCompile>> = descriptors
    .filter(EnforcementBundleDescriptor::requiresFocusedCompile)
    .groupBy(FocusedVerificationSliceKey::from)
    .flatMap { (sliceKey, sliceDescriptors) ->
        val sliceBundleIds = sliceDescriptors
            .map(EnforcementBundleDescriptor::bundleId)
            .sorted()
        val sliceCheckerNames = sliceDescriptors
            .flatMap(EnforcementBundleDescriptor::errorProneCheckers)
            .distinct()
            .sorted()
        val coalescedCompileTask = verificationHarness.registerFocusedVerificationCompileTask(
            sliceKey,
            sliceCheckerNames,
            focusedCompileDescription(sliceBundleIds, sliceCheckerNames)
        )
        sliceDescriptors.map { descriptor ->
            descriptor.bundleId to coalescedCompileTask
        }
    }
    .toMap()

private fun focusedCompileDescription(
    bundleIds: List<String>,
    checkerNames: List<String>
): String {
    val sliceDisplayName = bundleIds.joinToString(", ")
    return if (checkerNames.isEmpty()) {
        "Compile the coalesced focused verification slice for $sliceDisplayName."
    } else {
        "Compile the coalesced focused verification slice for $sliceDisplayName with the dedicated Error Prone checks enabled."
    }
}
