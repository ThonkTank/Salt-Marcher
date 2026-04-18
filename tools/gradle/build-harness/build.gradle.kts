plugins {
    java
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

tasks.register<JavaExec>("architectureCheck") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Checks repository layout, package-path alignment, and documented root-entrypoint presence."
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "saltmarcher.architecture.ArchitectureCheckMain"
    args = listOf(projectDir.parentFile.absolutePath)
}

tasks.register<JavaExec>("harnessSelfTest") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Runs fixture-based tests for the architecture checker itself."
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "saltmarcher.architecture.HarnessSelfTestMain"
    args = listOf(projectDir.absolutePath)
}

tasks.named("check") {
    dependsOn("architectureCheck", "harnessSelfTest")
}
