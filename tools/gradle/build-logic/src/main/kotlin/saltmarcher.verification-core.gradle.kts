import org.gradle.language.base.plugins.LifecycleBasePlugin

val stagedVerificationSurfaceNames = setOf(
    "production-build",
    "quality-hygiene",
    "architecture",
    "view-topology",
    "docs",
    "metrics-report",
    "desktop-install",
    "production-handoff"
)

val requestedTaskNames = gradle.startParameter.taskNames
    .map { taskName -> taskName.substringAfterLast(":") }
    .toSet()

if (requestedTaskNames.any { taskName -> taskName in stagedVerificationSurfaceNames }) {
    gradle.startParameter.setContinueOnFailure(true)
}

apply(from = layout.projectDirectory.file("tools/quality/enforcement-bundles.gradle.kts"))

val focusedEnforcementBundleMode = extra["saltmarcherFocusedEnforcementBundleMode"] as Boolean
@Suppress("UNCHECKED_CAST")
val activeEnforcementBundleIds = extra["saltmarcherActiveEnforcementBundleIds"] as List<String>
@Suppress("UNCHECKED_CAST")
val rootHostScriptsByBundleId = extra["saltmarcherRootHostScriptsByBundleId"] as Map<String, String>

activeEnforcementBundleIds
    .map(rootHostScriptsByBundleId::getValue)
    .distinct()
    .forEach { scriptPath ->
        apply(from = scriptPath)
    }

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

val productionBuildSurface = registerSurfaceTask(
    "production-build",
    "Run the public staged production-build verification surface.",
    "productionBuild"
)

val qualityHygieneSurface = registerSurfaceTask(
    "quality-hygiene",
    "Run the public staged non-architecture hygiene verification surface.",
    "checkQualityHygiene"
)

val architectureSurface = registerSurfaceTask(
    "architecture",
    "Run the public staged non-view architecture verification surface.",
    "checkArchitecture"
)

val viewTopologySurface = registerSurfaceTask(
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
