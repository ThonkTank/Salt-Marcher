import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.the

val sourceSets = the<SourceSetContainer>()
sourceSets.named("test") {
    java.srcDir("tools/quality/data-persistencecore-enforcement/archunit/src/test/java")
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

val dataPersistencecoreArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the Data Persistencecore-focused architecture test suite."
    dependsOn(tasks.named("compileJava"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    filter {
        includeTestsMatching("architecture.data.persistencecore.DataPersistencecoreArchitectureTest")
    }
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

tasks.register("checkDataPersistencecoreEnforcement") {
    group = "verification"
    description = "Run the dedicated Data Persistencecore enforcement bundle through one root entrypoint."
    dependsOn(dataPersistencecoreArchitectureTest)
    dependsOn(gradle.includedBuild("build-harness").task(":dataPersistencecoreDocumentationEnforcementCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkDataPersistencecoreEnforcement")
}

tasks.named("check") {
    dependsOn("checkDataPersistencecoreEnforcement")
}
