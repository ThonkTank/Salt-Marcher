import java.io.File
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.the
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension

plugins {
    java
    id("saltmarcher.enforcement-bundles")
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?.let(::File)
    ?: projectDir.parentFile.parentFile.parentFile

extra["saltmarcherBuildHarnessRepoRootDir"] = repoRootDir.absolutePath

val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
val focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode
val activeEnforcementBundleIds = enforcementBundles.activeEnforcementBundleIds

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.setSrcDirs(
        listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath) +
            activeEnforcementBundleIds.mapNotNull { bundleId -> enforcementBundles.descriptor(bundleId).buildHarnessSourceDir } +
            listOfNotNull(
                repoRootDir.resolve("tools/quality/documentation-enforcement/build-harness/src/main/java")
                    .takeIf { !focusedEnforcementBundleMode }
                    ?.absolutePath
            )
    )
    resources.setSrcDirs(
        listOf(layout.projectDirectory.dir("src/main/resources").asFile.absolutePath) +
            activeEnforcementBundleIds.flatMap { bundleId ->
                enforcementBundles.descriptor(bundleId).buildHarnessResourceDirs
            }
    )
}

fun humanizeBundleLabel(bundleId: String): String = bundleId
    .replace(Regex("([a-z0-9])([A-Z])"), "$1 $2")
    .replaceFirstChar(Char::uppercaseChar)

fun registerBuildHarnessTask(taskName: String, bundleLabel: String, mainClassName: String) {
    val isDocumentationTask = taskName.endsWith("DocumentationEnforcementCheck")
    val description = when {
        isDocumentationTask -> "Run only the $bundleLabel enforcement documentation-coverage rules."
        taskName.endsWith("TopologyCheck") -> "Run only the $bundleLabel build-harness topology rules."
        else -> "Run only the focused $bundleLabel build-harness rules."
    }

    tasks.register<JavaExec>(taskName) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        this.description = description
        outputs.upToDateWhen { false }
        outputs.doNotCacheIf(
            if (isDocumentationTask) {
                "Documentation enforcement diagnostics must be produced by the current invocation."
            } else {
                "Architecture gate diagnostics must be produced by the current invocation."
            }
        ) { true }
        classpath = sourceSets["main"].runtimeClasspath
        mainClass = mainClassName
        args = listOf(repoRootDir.absolutePath)
    }
}

activeEnforcementBundleIds.forEach { bundleId ->
    val bundleLabel = humanizeBundleLabel(bundleId)
    enforcementBundles.descriptor(bundleId).buildHarnessTaskMainClasses.forEach { (taskName, mainClassName) ->
        registerBuildHarnessTask(taskName, bundleLabel, mainClassName)
    }
}

if (!focusedEnforcementBundleMode) {
    registerBuildHarnessTask(
        "documentationEnforcementCheck",
        "documentation",
        "saltmarcher.architecture.documentation.DocumentationEnforcementCheckMain"
    )
}

tasks.register<JavaExec>("architectureCheck") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Checks repository layout, package-path alignment, and documented root-entrypoint presence."
    val repositoryRootDir = repoRootDir
    val successMarker = layout.buildDirectory.file("reports/architecture-check/success.marker")
    inputs.files(
        fileTree(repositoryRootDir) {
            exclude("build/**")
            exclude(".gradle/**")
            exclude(".git/**")
        }
    )
    outputs.file(successMarker)
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "saltmarcher.architecture.ArchitectureCheckMain"
    args = listOf(repositoryRootDir.absolutePath)
    doLast {
        val markerFile = successMarker.get().asFile
        markerFile.parentFile.mkdirs()
        markerFile.writeText("passed\n")
    }
}

tasks.named("check") {
    dependsOn("architectureCheck")
}
