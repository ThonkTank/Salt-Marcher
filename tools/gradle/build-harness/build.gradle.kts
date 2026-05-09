import java.io.File
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.the
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.tasks.RepoVerificationMainTask

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

val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
val focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode
val activeEnforcementBundleIds = enforcementBundles.activeEnforcementBundleIds

val sourceSets = the<SourceSetContainer>()

fun repoVerificationJavaDirs(relativePath: String): List<String> {
    val root = repoRootDir.resolve("tools/quality")
    if (!root.isDirectory) {
        return emptyList()
    }
    return root.walkTopDown()
        .filter { file -> file.isDirectory && file.relativeTo(repoRootDir).path.replace(File.separatorChar, '/') == relativePath }
        .map(File::getAbsolutePath)
        .toList()
}

sourceSets.named("main") {
    java.setSrcDirs(
        listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath) +
            repoVerificationJavaDirs("tools/quality/documentation-enforcement/build-harness/src/main/java") +
            repoRootDir.resolve("tools/quality")
                .walkTopDown()
                .filter { file ->
                    file.isDirectory &&
                        file.relativeTo(repoRootDir).path.replace(File.separatorChar, '/').endsWith("/build-harness/src/main/java") &&
                        file.relativeTo(repoRootDir).path.replace(File.separatorChar, '/') != "tools/quality/documentation-enforcement/build-harness/src/main/java"
                }
                .map(File::getAbsolutePath)
                .toList()
    )
    resources.setSrcDirs(emptyList<String>())
}
val mainSourceSet = sourceSets["main"]

fun humanizeBundleLabel(bundleId: String): String = bundleId
    .replace(Regex("([a-z0-9])([A-Z])"), "$1 $2")
    .replaceFirstChar(Char::uppercaseChar)

fun repoInputTree(includePatterns: List<String>) = fileTree(repoRootDir) {
    exclude(".git/**")
    exclude(".gradle/**")
    exclude("build/**")
    exclude("**/.gradle/**")
    exclude("**/build/**")
    includePatterns.forEach(::include)
}

fun buildHarnessInputs(taskName: String) = when {
    taskName.endsWith("DocumentationEnforcementCheck") -> repoInputTree(
        listOf(
            "AGENTS.md",
            "docs/**",
            "src/**/DOMAIN.md",
            "tools/quality/**/*.md",
            "tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/**"
        )
    )
    else -> repoInputTree(
        listOf(
            "api/**",
            "bootstrap/**",
            "shell/**",
            "src/**",
            "tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/**"
        )
    )
}

fun activeBuildHarnessArchitectureRuleClasses() = activeEnforcementBundleIds
    .flatMap { bundleId -> enforcementBundles.descriptor(bundleId).buildHarnessArchitectureRuleClasses }
    .distinct()

fun activeBuildHarnessDocumentationRuleClasses() = activeEnforcementBundleIds
    .flatMap { bundleId -> enforcementBundles.descriptor(bundleId).buildHarnessDocumentationRuleClasses }
    .distinct()

fun descriptorBuildHarnessRuleClasses(bundleId: String, taskName: String): List<String> =
    enforcementBundles.descriptor(bundleId).buildHarnessTaskRuleClasses(taskName)

fun registerBuildHarnessTask(
    taskName: String,
    bundleLabel: String,
    mainClassName: String?,
    ruleClasses: List<String>
) {
    val isDocumentationTask = taskName.endsWith("DocumentationEnforcementCheck")
    val description = when {
        isDocumentationTask -> "Run only the $bundleLabel enforcement documentation-coverage rules."
        taskName.endsWith("TopologyCheck") -> "Run only the $bundleLabel build-harness topology rules."
        else -> "Run only the focused $bundleLabel build-harness rules."
    }

    tasks.register<RepoVerificationMainTask>(taskName) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        this.description = description
        dependsOn(tasks.named(mainSourceSet.classesTaskName))
        runtimeClasspath.from(mainSourceSet.output)
        runtimeClasspath.from(mainSourceSet.runtimeClasspath)
        verificationMainClass.set(mainClassName ?: "saltmarcher.architecture.ArchitectureCheckMain")
        repoRootPath.set(repoRootDir.absolutePath)
        if (ruleClasses.isNotEmpty()) {
            verificationArgs.set(listOf("--only-rules") + ruleClasses)
        }
        verificationInputs.from(buildHarnessInputs(taskName))
        successMarker.set(layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
    }
}

activeEnforcementBundleIds.forEach { bundleId ->
    val bundleLabel = humanizeBundleLabel(bundleId)
    val descriptor = enforcementBundles.descriptor(bundleId)
    descriptor.buildHarnessTaskNames()
        .forEach { taskName ->
            registerBuildHarnessTask(
                taskName,
                bundleLabel,
                descriptor.buildHarnessTaskMainClasses[taskName],
                descriptorBuildHarnessRuleClasses(bundleId, taskName)
            )
        }
}

if (!focusedEnforcementBundleMode) {
    registerBuildHarnessTask(
        "documentationEnforcementCheck",
        "documentation",
        null,
        activeBuildHarnessDocumentationRuleClasses()
    )
}

tasks.register<RepoVerificationMainTask>("architectureCheck") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Checks repository layout, package-path alignment, and documented root-entrypoint presence."
    dependsOn(tasks.named(mainSourceSet.classesTaskName))
    runtimeClasspath.from(mainSourceSet.output)
    runtimeClasspath.from(mainSourceSet.runtimeClasspath)
    verificationMainClass.set("saltmarcher.architecture.ArchitectureCheckMain")
    repoRootPath.set(repoRootDir.absolutePath)
    verificationArgs.set(activeBuildHarnessArchitectureRuleClasses())
    verificationInputs.from(
        repoInputTree(
            listOf(
                ".github/workflows/quality-platforms.yml",
                "AGENTS.md",
                "bootstrap/**",
                "docs/project/architecture/verification-core.md",
                "docs/project/verification/**",
                "shell/**",
                "src/**",
                "tools/gradle/**",
                "tools/gradle/build-harness/src/**"
            )
        )
    )
    successMarker.set(layout.buildDirectory.file("verification-markers/architectureCheck/success.marker"))
}

tasks.named("check") {
    dependsOn("architectureCheck")
}
