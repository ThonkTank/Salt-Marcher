plugins {
    java
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

apply(from = "../../quality/viewinputevent-enforcement/build-harness-host.gradle.kts")
apply(from = "../../quality/view-layer-enforcement/build-harness-host.gradle.kts")
apply(from = "../../quality/view-inspector-entry-enforcement/build-harness-host.gradle.kts")
apply(from = "../../quality/viewintenthandler-enforcement/build-harness-host.gradle.kts")
apply(from = "../../quality/view-contributionmodel-enforcement/build-harness-host.gradle.kts")
apply(from = "../../quality/view-content-model-enforcement/build-harness-host.gradle.kts")

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
