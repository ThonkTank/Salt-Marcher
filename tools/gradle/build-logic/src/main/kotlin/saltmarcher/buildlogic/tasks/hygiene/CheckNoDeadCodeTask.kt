package saltmarcher.buildlogic.tasks.hygiene

import java.io.File
import java.nio.file.Files
import javax.xml.XMLConstants
import javax.xml.stream.XMLInputFactory
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException
import org.objectweb.asm.ClassReader
import org.objectweb.asm.Handle
import org.objectweb.asm.Opcodes
import org.objectweb.asm.Type
import org.objectweb.asm.tree.ClassNode
import org.objectweb.asm.tree.FieldInsnNode
import org.objectweb.asm.tree.FieldNode
import org.objectweb.asm.tree.InvokeDynamicInsnNode
import org.objectweb.asm.tree.LdcInsnNode
import org.objectweb.asm.tree.MethodInsnNode
import org.objectweb.asm.tree.MethodNode
import org.objectweb.asm.tree.MultiANewArrayInsnNode
import org.objectweb.asm.tree.TypeInsnNode

@CacheableTask
abstract class CheckNoDeadCodeTask : DefaultTask() {

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val compiledClassesDirectory: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceRoots: ConfigurableFileCollection

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val resourceRoots: ConfigurableFileCollection

    @get:Optional
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val keepRootsFiles: ConfigurableFileCollection

    @get:OutputFile
    abstract val reportFile: RegularFileProperty

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @TaskAction
    fun check() {
        val compiledRoot = compiledClassesDirectory.get().asFile
        val sourceRootDirs = sourceRoots.files.filter(File::isDirectory).sortedBy(File::invariantSeparatorsPath)
        val resourceRootDirs = resourceRoots.files.filter(File::isDirectory).sortedBy(File::invariantSeparatorsPath)
        val classes = loadClasses(compiledRoot)
        val keepRoots = loadKeepRoots(keepRootsFiles.files.filter(File::isFile))
        val fxmlRoots = loadFxmlRoots(resourceRootDirs)
        val serviceLoaderRoots = loadServiceLoaderRoots(resourceRootDirs)
        val literalReflectionRoots = loadLiteralReflectionRoots(sourceRootDirs)
        val model = DeadCodeModel(
            classes = classes,
            keepRoots = keepRoots,
            fxmlRoots = fxmlRoots,
            serviceLoaderRoots = serviceLoaderRoots,
            literalReflectionRoots = literalReflectionRoots
        )
        val findings = model.findDeadCode()
        writeOutputs(findings)
        if (findings.hasFailures()) {
            throw VerificationException(
                "Dead code remains in production sources. See ${reportFile.get().asFile.invariantSeparatorsPath}."
            )
        }
    }

    private fun writeOutputs(findings: DeadCodeFindings) {
        val reportPath = reportFile.get().asFile.toPath()
        val markerPath = successMarker.get().asFile.toPath()
        Files.createDirectories(reportPath.parent)
        Files.createDirectories(markerPath.parent)
        Files.deleteIfExists(markerPath)
        Files.writeString(reportPath, findings.render())
        if (!findings.hasFailures()) {
            Files.writeString(markerPath, "passed\n")
        }
    }

    private fun loadClasses(compiledRoot: File): Map<String, ClassInfo> {
        val classes = linkedMapOf<String, ClassInfo>()
        compiledRoot.walkTopDown()
            .filter { file -> file.isFile && file.extension == "class" }
            .sortedBy(File::invariantSeparatorsPath)
            .forEach { classFile ->
                val node = ClassNode()
                ClassReader(classFile.readBytes()).accept(node, 0)
                val classInfo = toClassInfo(node)
                classes[classInfo.internalName] = classInfo
            }
        return classes
    }

    private fun toClassInfo(node: ClassNode): ClassInfo {
        val sourceRelativePath = sourceRelativePath(node)
        val outerInternalName = node.name.substringBeforeLast('$', "")
            .takeIf { node.name.contains('$') && it.isNotBlank() }
        val recordComponentNames = node.recordComponents.orEmpty().map { it.name }.toSet()
        val methods = linkedMapOf<MemberKey, MethodMember>()
        node.methods.orEmpty().forEach { method ->
            val member = MethodMember(
                ownerInternalName = node.name,
                name = method.name,
                descriptor = method.desc,
                access = method.access,
                sourceRelativePath = sourceRelativePath,
                classReferences = collectMethodClassReferences(method),
                methodInvocations = collectMethodInvocations(method),
                fieldReferences = collectFieldReferences(method),
                reportable = isReportableMethod(node, method, recordComponentNames)
            )
            methods[member.key] = member
        }
        val fields = linkedMapOf<FieldKey, FieldMember>()
        node.fields.orEmpty().forEach { field ->
            val member = FieldMember(
                ownerInternalName = node.name,
                name = field.name,
                descriptor = field.desc,
                access = field.access,
                sourceRelativePath = sourceRelativePath,
                classReferences = collectFieldClassReferences(field),
                reportable = isReportableField(node, field)
            )
            fields[member.key] = member
        }
        return ClassInfo(
            internalName = node.name,
            access = node.access,
            superInternalName = node.superName,
            interfaceInternalNames = node.interfaces.orEmpty(),
            outerInternalName = outerInternalName,
            sourceRelativePath = sourceRelativePath,
            reportable = isReportableType(node),
            methods = methods,
            fields = fields
        )
    }

    private fun sourceRelativePath(node: ClassNode): String {
        val packagePath = node.name.substringBeforeLast('/', "")
        val topLevelInternalName = node.name.substringBefore('$')
        return when {
            node.sourceFile != null && packagePath.isNotBlank() -> "$packagePath/${node.sourceFile}"
            node.sourceFile != null -> node.sourceFile
            else -> "$topLevelInternalName.java"
        }
    }

    private fun collectMethodClassReferences(method: MethodNode): Set<String> {
        val references = linkedSetOf<String>()
        addMethodDescriptorTypes(method.desc, references)
        method.exceptions.orEmpty().forEach(references::add)
        method.instructions?.iterator()?.forEachRemaining { instruction ->
            when (instruction) {
                is MethodInsnNode -> {
                    references += instruction.owner
                    addMethodDescriptorTypes(instruction.desc, references)
                }
                is FieldInsnNode -> {
                    references += instruction.owner
                    addFieldDescriptorTypes(instruction.desc, references)
                }
                is TypeInsnNode -> addInternalNameReference(instruction.desc, references)
                is LdcInsnNode -> {
                    val constant = instruction.cst
                    if (constant is Type) {
                        addTypeReference(constant, references)
                    }
                }
                is MultiANewArrayInsnNode -> addFieldDescriptorTypes(instruction.desc, references)
                is InvokeDynamicInsnNode -> {
                    addMethodDescriptorTypes(instruction.desc, references)
                    addHandleReferences(instruction.bsm, references, mutableSetOf(), mutableSetOf())
                    instruction.bsmArgs.forEach { argument ->
                        when (argument) {
                            is Type -> addTypeReference(argument, references)
                            is Handle -> addHandleReferences(argument, references, mutableSetOf(), mutableSetOf())
                        }
                    }
                }
            }
        }
        return references
    }

    private fun collectMethodInvocations(method: MethodNode): Set<MethodReference> {
        val references = linkedSetOf<MethodReference>()
        method.instructions?.iterator()?.forEachRemaining { instruction ->
            when (instruction) {
                is MethodInsnNode -> {
                    references += MethodReference(
                        ownerInternalName = instruction.owner,
                        name = instruction.name,
                        descriptor = instruction.desc,
                        virtualDispatch = instruction.opcode == Opcodes.INVOKEVIRTUAL
                            || instruction.opcode == Opcodes.INVOKEINTERFACE
                    )
                }
                is InvokeDynamicInsnNode -> {
                    addHandleInvocations(instruction.bsm, references)
                    instruction.bsmArgs.forEach { argument ->
                        if (argument is Handle) {
                            addHandleInvocations(argument, references)
                        }
                    }
                }
            }
        }
        return references
    }

    private fun collectFieldReferences(method: MethodNode): Set<FieldReference> {
        val references = linkedSetOf<FieldReference>()
        method.instructions?.iterator()?.forEachRemaining { instruction ->
            if (instruction is FieldInsnNode) {
                references += FieldReference(
                    ownerInternalName = instruction.owner,
                    name = instruction.name,
                    descriptor = instruction.desc
                )
            }
        }
        return references
    }

    private fun collectFieldClassReferences(field: FieldNode): Set<String> {
        val references = linkedSetOf<String>()
        addFieldDescriptorTypes(field.desc, references)
        return references
    }

    private fun addHandleReferences(
        handle: Handle,
        classReferences: MutableSet<String>,
        methodReferences: MutableSet<MethodReference>,
        fieldReferences: MutableSet<FieldReference>
    ) {
        addInternalNameReference(handle.owner, classReferences)
        when (handle.tag) {
            Opcodes.H_GETFIELD,
            Opcodes.H_GETSTATIC,
            Opcodes.H_PUTFIELD,
            Opcodes.H_PUTSTATIC -> {
                addFieldDescriptorTypes(handle.desc, classReferences)
                fieldReferences += FieldReference(handle.owner, handle.name, handle.desc)
            }
            else -> {
                addMethodDescriptorTypes(handle.desc, classReferences)
                methodReferences += MethodReference(
                    ownerInternalName = handle.owner,
                    name = handle.name,
                    descriptor = handle.desc,
                    virtualDispatch = handle.tag == Opcodes.H_INVOKEVIRTUAL || handle.tag == Opcodes.H_INVOKEINTERFACE
                )
            }
        }
    }

    private fun addHandleInvocations(handle: Handle, references: MutableSet<MethodReference>) {
        if (handle.tag in setOf(
                Opcodes.H_INVOKESTATIC,
                Opcodes.H_INVOKESPECIAL,
                Opcodes.H_INVOKEVIRTUAL,
                Opcodes.H_INVOKEINTERFACE,
                Opcodes.H_NEWINVOKESPECIAL
            )
        ) {
            references += MethodReference(
                ownerInternalName = handle.owner,
                name = handle.name,
                descriptor = handle.desc,
                virtualDispatch = handle.tag == Opcodes.H_INVOKEVIRTUAL || handle.tag == Opcodes.H_INVOKEINTERFACE
            )
        }
    }

    private fun addMethodDescriptorTypes(descriptor: String, references: MutableSet<String>) {
        val methodType = Type.getMethodType(descriptor)
        addTypeReference(methodType.returnType, references)
        methodType.argumentTypes.forEach { argument -> addTypeReference(argument, references) }
    }

    private fun addFieldDescriptorTypes(descriptor: String, references: MutableSet<String>) {
        addTypeReference(Type.getType(descriptor), references)
    }

    private fun addTypeReference(type: Type, references: MutableSet<String>) {
        when (type.sort) {
            Type.ARRAY -> addTypeReference(type.elementType, references)
            Type.OBJECT -> addInternalNameReference(type.internalName, references)
            Type.METHOD -> addMethodDescriptorTypes(type.descriptor, references)
        }
    }

    private fun addInternalNameReference(internalName: String?, references: MutableSet<String>) {
        if (internalName == null) {
            return
        }
        if (internalName.startsWith("bootstrap/")
            || internalName.startsWith("shell/")
            || internalName.startsWith("src/")
        ) {
            references += internalName
        }
    }

    private fun isReportableType(node: ClassNode): Boolean {
        if ((node.access and Opcodes.ACC_SYNTHETIC) != 0) {
            return false
        }
        if (node.name.endsWith("/package-info") || node.name.endsWith("/module-info")) {
            return false
        }
        val nestedSimpleName = node.name.substringAfterLast('$', "")
        return nestedSimpleName.isBlank() || nestedSimpleName.firstOrNull()?.isDigit() != true
    }

    private fun isReportableMethod(
        owner: ClassNode,
        method: MethodNode,
        recordComponentNames: Set<String>
    ): Boolean {
        if ((method.access and Opcodes.ACC_SYNTHETIC) != 0 || (method.access and Opcodes.ACC_BRIDGE) != 0) {
            return false
        }
        if (method.name == "<clinit>" || method.name.startsWith("lambda$")) {
            return false
        }
        if ((owner.access and Opcodes.ACC_ENUM) != 0
            && method.name in setOf("values", "valueOf")
        ) {
            return false
        }
        if ((owner.access and Opcodes.ACC_RECORD) != 0
            && method.name in recordComponentNames
            && Type.getMethodType(method.desc).argumentTypes.isEmpty()
        ) {
            return false
        }
        if (method.name in setOf("readObject", "writeObject", "readResolve", "writeReplace")) {
            return false
        }
        return true
    }

    private fun isReportableField(owner: ClassNode, field: FieldNode): Boolean {
        if ((field.access and Opcodes.ACC_SYNTHETIC) != 0) {
            return false
        }
        if ((owner.access and Opcodes.ACC_ENUM) != 0 && (field.access and Opcodes.ACC_ENUM) != 0) {
            return false
        }
        if ((owner.access and Opcodes.ACC_RECORD) != 0) {
            return false
        }
        if (field.name == "serialVersionUID") {
            return false
        }
        val fieldType = Type.getType(field.desc)
        val isCompileTimeConstant = (field.access and (Opcodes.ACC_PUBLIC or Opcodes.ACC_STATIC or Opcodes.ACC_FINAL)) ==
            (Opcodes.ACC_PUBLIC or Opcodes.ACC_STATIC or Opcodes.ACC_FINAL) &&
            (fieldType.sort != Type.OBJECT || field.desc == "Ljava/lang/String;")
        if (isCompileTimeConstant) {
            return false
        }
        return true
    }

    private fun loadKeepRoots(files: List<File>): KeepRoots {
        val typeRoots = linkedSetOf<String>()
        val methodRoots = linkedMapOf<String, MutableSet<String>>()
        val fieldRoots = linkedMapOf<String, MutableSet<String>>()
        files.sortedBy(File::invariantSeparatorsPath).forEach { file ->
            file.readLines()
                .map(String::trim)
                .filter { line -> line.isNotEmpty() && !line.startsWith("#") }
                .forEach { line ->
                    when {
                        line.startsWith("class:") -> typeRoots += line.substringAfter("class:").trim().replace('.', '/')
                        line.startsWith("method:") -> {
                            val raw = line.substringAfter("method:").trim()
                            val owner = raw.substringBefore('#').replace('.', '/')
                            val name = raw.substringAfter('#')
                            methodRoots.getOrPut(owner) { linkedSetOf() } += name
                        }
                        line.startsWith("field:") -> {
                            val raw = line.substringAfter("field:").trim()
                            val owner = raw.substringBefore('#').replace('.', '/')
                            val name = raw.substringAfter('#')
                            fieldRoots.getOrPut(owner) { linkedSetOf() } += name
                        }
                    }
                }
        }
        return KeepRoots(typeRoots, methodRoots, fieldRoots)
    }

    private fun loadFxmlRoots(resourceRoots: List<File>): FxmlRoots {
        val controllerTypes = linkedSetOf<String>()
        val controllerMethods = linkedMapOf<String, MutableSet<String>>()
        val controllerFields = linkedMapOf<String, MutableSet<String>>()
        val xmlFactory = XMLInputFactory.newFactory().apply {
            setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false)
            setProperty(XMLInputFactory.SUPPORT_DTD, false)
            setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "")
            setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "")
        }
        resourceRoots.forEach { root ->
            root.walkTopDown()
                .filter { file -> file.isFile && file.extension == "fxml" }
                .sortedBy(File::invariantSeparatorsPath)
                .forEach { file ->
                    file.inputStream().use { input ->
                        val reader = xmlFactory.createXMLStreamReader(input)
                        var controllerType: String? = null
                        while (reader.hasNext()) {
                            if (reader.next() != javax.xml.stream.XMLStreamConstants.START_ELEMENT) {
                                continue
                            }
                            for (index in 0 until reader.attributeCount) {
                                val value = reader.getAttributeValue(index) ?: continue
                                val localName = reader.getAttributeLocalName(index)
                                if (reader.getAttributePrefix(index) == "fx" && localName == "controller") {
                                    controllerType = value.replace('.', '/')
                                    controllerTypes += controllerType!!
                                }
                                if (value.startsWith("#") && controllerType != null) {
                                    controllerMethods.getOrPut(controllerType!!) { linkedSetOf() } += value.removePrefix("#")
                                }
                                if (reader.getAttributePrefix(index) == "fx" && localName == "id" && controllerType != null) {
                                    controllerFields.getOrPut(controllerType!!) { linkedSetOf() } += value
                                }
                            }
                        }
                        reader.close()
                    }
                }
        }
        return FxmlRoots(controllerTypes, controllerMethods, controllerFields)
    }

    private fun loadServiceLoaderRoots(resourceRoots: List<File>): ServiceLoaderRoots {
        val providerTypes = linkedSetOf<String>()
        resourceRoots.forEach { root ->
            val servicesDir = root.resolve("META-INF/services")
            if (!servicesDir.isDirectory) {
                return@forEach
            }
            servicesDir.walkTopDown()
                .filter(File::isFile)
                .sortedBy(File::invariantSeparatorsPath)
                .forEach { file ->
                    file.readLines()
                        .map(String::trim)
                        .filter { line -> line.isNotEmpty() && !line.startsWith("#") }
                        .forEach { providerTypes += it.replace('.', '/') }
                }
        }
        return ServiceLoaderRoots(providerTypes)
    }

    private fun loadLiteralReflectionRoots(sourceRoots: List<File>): LiteralReflectionRoots {
        val classRoots = linkedSetOf<String>()
        sourceRoots.forEach { root ->
            root.walkTopDown()
                .filter { file -> file.isFile && file.extension == "java" }
                .sortedBy(File::invariantSeparatorsPath)
                .forEach { file ->
                    val content = file.readText()
                    classForNamePattern.findAll(content).forEach { match ->
                        classRoots += match.groupValues[1].replace('.', '/')
                    }
                }
        }
        return LiteralReflectionRoots(classRoots)
    }

    private companion object {
        val classForNamePattern = Regex("Class\\.forName\\(\\s*\"([A-Za-z0-9_$.]+)\"")
    }
}

private data class DeadCodeModel(
    val classes: Map<String, ClassInfo>,
    val keepRoots: KeepRoots,
    val fxmlRoots: FxmlRoots,
    val serviceLoaderRoots: ServiceLoaderRoots,
    val literalReflectionRoots: LiteralReflectionRoots
) {
    private val reachableClasses = linkedSetOf<String>()
    private val reachableMethods = linkedSetOf<MemberKey>()
    private val reachableFields = linkedSetOf<FieldKey>()
    private val pendingClasses = ArrayDeque<String>()
    private val pendingMethods = ArrayDeque<MemberKey>()
    private val pendingFields = ArrayDeque<FieldKey>()

    fun findDeadCode(): DeadCodeFindings {
        seedRoots()
        traverse()
        val deadTypes = classes.values
            .filter { info -> info.reportable && info.internalName !in reachableClasses }
            .sortedWith(compareBy(ClassInfo::sourceRelativePath, ClassInfo::binaryName))
        val deadMethods = classes.values
            .flatMap { info -> info.methods.values }
            .filter { method -> method.reportable && method.key !in reachableMethods }
            .sortedWith(compareBy(MethodMember::sourceRelativePath, MethodMember::renderedName))
        val deadFields = classes.values
            .flatMap { info -> info.fields.values }
            .filter { field -> field.reportable && field.key !in reachableFields }
            .sortedWith(compareBy(FieldMember::sourceRelativePath, FieldMember::renderedName))
        val deadFiles = classes.values
            .filter(ClassInfo::reportable)
            .groupBy(ClassInfo::sourceRelativePath)
            .filter { (_, fileClasses) -> fileClasses.all { it.internalName !in reachableClasses } }
            .keys
            .sorted()
        return DeadCodeFindings(deadFiles, deadTypes, deadMethods, deadFields)
    }

    private fun seedRoots() {
        classes.values.forEach { info ->
            if (isJavaFxRoot(info) || isShellContributionRoot(info) || isServiceContributionRoot(info)) {
                markClass(info.internalName)
                markNoArgConstructors(info.internalName)
            }
            if (isJavaFxRoot(info)) {
                markNamedMethods(info.internalName, setOf("main", "init", "start", "stop", "handleApplicationNotification", "handleStateChangeNotification"))
            }
            if (isShellContributionRoot(info)) {
                markNamedMethods(info.internalName, setOf("registrationSpec", "bind"))
            }
            if (isServiceContributionRoot(info)) {
                markNamedMethods(info.internalName, setOf("register"))
            }
        }

        keepRoots.typeRoots.forEach(::markClass)
        keepRoots.methodRoots.forEach { (owner, names) -> markNamedMethods(owner, names) }
        keepRoots.fieldRoots.forEach { (owner, names) -> markNamedFields(owner, names) }

        fxmlRoots.controllerTypes.forEach { owner ->
            markClass(owner)
            markNoArgConstructors(owner)
            markNamedMethods(owner, setOf("initialize") + fxmlRoots.controllerMethods[owner].orEmpty())
            markNamedFields(owner, fxmlRoots.controllerFields[owner].orEmpty())
        }

        serviceLoaderRoots.providerTypes.forEach { owner ->
            markClass(owner)
            markNoArgConstructors(owner)
        }

        literalReflectionRoots.classRoots.forEach(::markClass)
    }

    private fun traverse() {
        while (pendingClasses.isNotEmpty() || pendingMethods.isNotEmpty() || pendingFields.isNotEmpty()) {
            while (pendingClasses.isNotEmpty()) {
                val className = pendingClasses.removeFirst()
                val classInfo = classes[className] ?: continue
                classInfo.superInternalName?.let(::markClass)
                classInfo.interfaceInternalNames.forEach(::markClass)
                classInfo.outerInternalName?.let(::markClass)
            }
            while (pendingMethods.isNotEmpty()) {
                val methodKey = pendingMethods.removeFirst()
                val method = classes[methodKey.ownerInternalName]?.methods?.get(methodKey) ?: continue
                markClass(method.ownerInternalName)
                method.classReferences.forEach(::markClass)
                method.fieldReferences.forEach(::markField)
                method.methodInvocations.forEach(::markInvocation)
            }
            while (pendingFields.isNotEmpty()) {
                val fieldKey = pendingFields.removeFirst()
                val field = classes[fieldKey.ownerInternalName]?.fields?.get(fieldKey) ?: continue
                markClass(field.ownerInternalName)
                field.classReferences.forEach(::markClass)
            }
        }
    }

    private fun markInvocation(reference: MethodReference) {
        if (!reference.virtualDispatch && reference.name == "<init>") {
            markMethod(MemberKey(reference.ownerInternalName, reference.name, reference.descriptor))
            return
        }
        if (reference.virtualDispatch) {
            classes.values
                .asSequence()
                .filter { info -> info.isSubtypeOf(reference.ownerInternalName, classes) }
                .mapNotNull { info -> info.resolveMethod(reference.name, reference.descriptor, classes) }
                .forEach(::markMethod)
            return
        }
        val exact = MemberKey(reference.ownerInternalName, reference.name, reference.descriptor)
        if (classes[reference.ownerInternalName]?.methods?.containsKey(exact) == true) {
            markMethod(exact)
        }
    }

    private fun markNoArgConstructors(owner: String) {
        classes[owner]?.methods?.keys
            ?.filter { key -> key.name == "<init>" && key.descriptor == "()V" }
            ?.forEach(::markMethod)
    }

    private fun markNamedMethods(owner: String, names: Set<String>) {
        if (names.isEmpty()) {
            return
        }
        classes[owner]?.methods?.keys
            ?.filter { key -> key.name in names }
            ?.forEach(::markMethod)
    }

    private fun markNamedFields(owner: String, names: Set<String>) {
        if (names.isEmpty()) {
            return
        }
        classes[owner]?.fields?.keys
            ?.filter { key -> key.name in names }
            ?.forEach(::markFieldKey)
    }

    private fun markClass(internalName: String) {
        if (classes.containsKey(internalName) && reachableClasses.add(internalName)) {
            pendingClasses += internalName
        }
    }

    private fun markMethod(key: MemberKey) {
        if (classes[key.ownerInternalName]?.methods?.containsKey(key) == true && reachableMethods.add(key)) {
            pendingMethods += key
            markClass(key.ownerInternalName)
        }
    }

    private fun markField(reference: FieldReference) {
        val key = FieldKey(reference.ownerInternalName, reference.name, reference.descriptor)
        markFieldKey(key)
    }

    private fun markFieldKey(key: FieldKey) {
        if (classes[key.ownerInternalName]?.fields?.containsKey(key) == true && reachableFields.add(key)) {
            pendingFields += key
            markClass(key.ownerInternalName)
        }
    }

    private fun isJavaFxRoot(info: ClassInfo): Boolean =
        info.isSubtypeOf("javafx/application/Application", classes) || info.isSubtypeOf("javafx/application/Preloader", classes)

    private fun isShellContributionRoot(info: ClassInfo): Boolean =
        !info.internalName.contains('$')
            && info.sourceRelativePath.matches(Regex("""src/view/(leftbartabs|statetabs|dropdowns)/[^/]+/[^/]+Contribution\.java"""))
            && info.isSubtypeOf("shell/api/ShellContribution", classes)

    private fun isServiceContributionRoot(info: ClassInfo): Boolean =
        !info.internalName.contains('$')
            && info.sourceRelativePath.matches(Regex("""src/data/[^/]+/[^/]+ServiceContribution\.java"""))
            && info.isSubtypeOf("shell/api/ServiceContribution", classes)
}

private data class DeadCodeFindings(
    val deadFiles: List<String>,
    val deadTypes: List<ClassInfo>,
    val deadMethods: List<MethodMember>,
    val deadFields: List<FieldMember>
) {
    fun hasFailures(): Boolean =
        deadFiles.isNotEmpty() || deadTypes.isNotEmpty() || deadMethods.isNotEmpty() || deadFields.isNotEmpty()

    fun render(): String = buildString {
        appendLine("# Dead Code Report")
        appendLine()
        appendLine("Files: ${deadFiles.size}")
        appendLine("Types: ${deadTypes.size}")
        appendLine("Methods: ${deadMethods.size}")
        appendLine("Fields: ${deadFields.size}")
        appendLine()
        appendSection("Dead Files", deadFiles)
        appendSection("Dead Types", deadTypes.map { "${it.sourceRelativePath} :: ${it.binaryName}" })
        appendSection("Dead Methods", deadMethods.map { "${it.sourceRelativePath} :: ${it.renderedName}" })
        appendSection("Dead Fields", deadFields.map { "${it.sourceRelativePath} :: ${it.renderedName}" })
    }

    private fun StringBuilder.appendSection(title: String, items: List<String>) {
        appendLine("## $title")
        if (items.isEmpty()) {
            appendLine("none")
        } else {
            items.forEach { item -> appendLine(item) }
        }
        appendLine()
    }
}

private data class ClassInfo(
    val internalName: String,
    val access: Int,
    val superInternalName: String?,
    val interfaceInternalNames: List<String>,
    val outerInternalName: String?,
    val sourceRelativePath: String,
    val reportable: Boolean,
    val methods: MutableMap<MemberKey, MethodMember>,
    val fields: MutableMap<FieldKey, FieldMember>
) {
    val binaryName: String = internalName.replace('/', '.')

    fun isSubtypeOf(targetInternalName: String, classes: Map<String, ClassInfo>): Boolean {
        if (internalName == targetInternalName) {
            return true
        }
        if (superInternalName == targetInternalName || interfaceInternalNames.contains(targetInternalName)) {
            return true
        }
        val directParents = listOfNotNull(superInternalName) + interfaceInternalNames
        return directParents.any { parent ->
            classes[parent]?.isSubtypeOf(targetInternalName, classes) == true
        }
    }

    fun resolveMethod(
        name: String,
        descriptor: String,
        classes: Map<String, ClassInfo>
    ): MemberKey? {
        val direct = MemberKey(internalName, name, descriptor)
        if (methods.containsKey(direct)) {
            return direct
        }
        val directParents = listOfNotNull(superInternalName) + interfaceInternalNames
        return directParents.firstNotNullOfOrNull { parent ->
            classes[parent]?.resolveMethod(name, descriptor, classes)
        }
    }
}

private data class MethodMember(
    val ownerInternalName: String,
    val name: String,
    val descriptor: String,
    val access: Int,
    val sourceRelativePath: String,
    val classReferences: Set<String>,
    val methodInvocations: Set<MethodReference>,
    val fieldReferences: Set<FieldReference>,
    val reportable: Boolean
) {
    val key: MemberKey = MemberKey(ownerInternalName, name, descriptor)
    val renderedName: String = "${ownerInternalName.replace('/', '.')}#$name$descriptor"
}

private data class FieldMember(
    val ownerInternalName: String,
    val name: String,
    val descriptor: String,
    val access: Int,
    val sourceRelativePath: String,
    val classReferences: Set<String>,
    val reportable: Boolean
) {
    val key: FieldKey = FieldKey(ownerInternalName, name, descriptor)
    val renderedName: String = "${ownerInternalName.replace('/', '.')}#$name:$descriptor"
}

private data class MethodReference(
    val ownerInternalName: String,
    val name: String,
    val descriptor: String,
    val virtualDispatch: Boolean
)

private data class FieldReference(
    val ownerInternalName: String,
    val name: String,
    val descriptor: String
)

private data class MemberKey(
    val ownerInternalName: String,
    val name: String,
    val descriptor: String
)

private data class FieldKey(
    val ownerInternalName: String,
    val name: String,
    val descriptor: String
)

private data class KeepRoots(
    val typeRoots: Set<String>,
    val methodRoots: Map<String, Set<String>>,
    val fieldRoots: Map<String, Set<String>>
)

private data class FxmlRoots(
    val controllerTypes: Set<String>,
    val controllerMethods: Map<String, Set<String>>,
    val controllerFields: Map<String, Set<String>>
)

private data class ServiceLoaderRoots(
    val providerTypes: Set<String>
)

private data class LiteralReflectionRoots(
    val classRoots: Set<String>
)
