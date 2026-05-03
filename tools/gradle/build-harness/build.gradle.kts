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
        apply(from = File(scriptPath))
    }
if (!focusedEnforcementBundleMode) {
    apply(from = repoRootDir.resolve("tools/quality/documentation-enforcement/build-harness-host.gradle.kts"))
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
