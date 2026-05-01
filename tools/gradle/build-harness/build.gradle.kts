import java.io.File

plugins {
    java
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?.let(::File)
    ?: projectDir.parentFile.parentFile.parentFile

fun repoQualityFile(relativeQualityPath: String): File = repoRootDir.resolve("tools/quality/$relativeQualityPath")

apply(from = repoRootDir.resolve("tools/quality/enforcement-bundles.gradle.kts"))

val focusedEnforcementBundleMode = extra["saltmarcherFocusedEnforcementBundleMode"] as Boolean
@Suppress("UNCHECKED_CAST")
val activeEnforcementBundleIds = extra["saltmarcherActiveEnforcementBundleIds"] as List<String>
@Suppress("UNCHECKED_CAST")
val buildHarnessHostScriptsByBundleId = extra["saltmarcherBuildHarnessHostScriptsByBundleId"] as Map<String, String>

activeEnforcementBundleIds
    .mapNotNull(buildHarnessHostScriptsByBundleId::get)
    .distinct()
    .forEach { scriptPath ->
        apply(from = repoQualityFile(scriptPath.removePrefix("../../quality/")))
    }
if (!focusedEnforcementBundleMode) {
    apply(from = repoQualityFile("documentation-enforcement/build-harness-host.gradle.kts"))
}

tasks.register<JavaExec>("architectureCheck") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Checks repository layout, package-path alignment, and documented root-entrypoint presence."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "saltmarcher.architecture.ArchitectureCheckMain"
    args = listOf(projectDir.parentFile.parentFile.parentFile.absolutePath)
}

tasks.named("check") {
    dependsOn("architectureCheck")
}
