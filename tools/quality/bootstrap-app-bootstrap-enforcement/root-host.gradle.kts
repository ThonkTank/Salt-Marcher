import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.the
import org.gradle.kotlin.dsl.withType

val sourceSets = the<SourceSetContainer>()
sourceSets.named("test") {
    java.srcDir("tools/quality/bootstrap-app-bootstrap-enforcement/archunit/src/test/java")
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

val bootstrapAppBootstrapArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the AppBootstrap-focused architecture test suite."
    dependsOn(tasks.named("compileJava"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    filter {
        includeTestsMatching("architecture.bootstrap.appbootstrap.AppBootstrapArchitectureTest")
    }
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

tasks.withType<Test>().matching { it.name == "architectureTest" }.configureEach {
    exclude("architecture/bootstrap/appbootstrap/**")
}

tasks.register("checkBootstrapAppBootstrapEnforcement") {
    group = "verification"
    description = "Run the dedicated AppBootstrap enforcement bundle through one root entrypoint."
    dependsOn(bootstrapAppBootstrapArchitectureTest)
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkBootstrapAppBootstrapEnforcement")
}

tasks.named("check") {
    dependsOn("checkBootstrapAppBootstrapEnforcement")
}
