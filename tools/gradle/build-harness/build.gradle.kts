plugins {
    java
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

apply(from = "../../quality/enforcement-bundles.gradle.kts")

val focusedEnforcementBundleMode = extra["saltmarcherFocusedEnforcementBundleMode"] as Boolean
@Suppress("UNCHECKED_CAST")
val activeEnforcementBundleIds = extra["saltmarcherActiveEnforcementBundleIds"] as List<String>
@Suppress("UNCHECKED_CAST")
val buildHarnessHostScriptsByBundleId = extra["saltmarcherBuildHarnessHostScriptsByBundleId"] as Map<String, String>

activeEnforcementBundleIds
    .mapNotNull(buildHarnessHostScriptsByBundleId::get)
    .forEach { scriptPath ->
        apply(from = scriptPath)
    }
if (!focusedEnforcementBundleMode) {
    apply(from = "../../quality/documentation-enforcement/build-harness-host.gradle.kts")
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
