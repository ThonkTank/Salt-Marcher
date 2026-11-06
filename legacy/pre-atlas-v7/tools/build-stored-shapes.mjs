import ts from 'typescript';
import fs from 'node:fs';

const input = 'src/app/storage/stored-shapes.ts',
  output = 'src/app/storage/stored-shapes.json';
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
const program = ts.createProgram([input], parsed.options),
  checker = program.getTypeChecker();
const source = program.getSourceFile(input);
const declaration = source.statements.find(
  (s) => ts.isInterfaceDeclaration(s) && s.name.text === 'StoredShapes',
);
const nodes = [],
  seen = new Map();
function build(type) {
  if (type.flags & ts.TypeFlags.Undefined) return { union: [] };
  if (type.flags & ts.TypeFlags.Null) return { literal: null };
  if (type.isStringLiteral() || type.isNumberLiteral()) return { literal: type.value };
  if (type.flags & ts.TypeFlags.BooleanLiteral) return { literal: type.intrinsicName === 'true' };
  if (
    type.flags & (ts.TypeFlags.String | ts.TypeFlags.TemplateLiteral) ||
    (type.isIntersection() && type.types.some((t) => t.flags & ts.TypeFlags.String))
  )
    return { scalar: 'string' };
  if (type.flags & ts.TypeFlags.Number) return { scalar: 'number' };
  if (type.flags & ts.TypeFlags.Boolean) return { scalar: 'boolean' };
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return { unknown: true };
  if (type.isUnion())
    return { union: type.types.filter((t) => !(t.flags & ts.TypeFlags.Undefined)).map(build) };
  if (checker.isArrayType(type) || checker.isTupleType(type))
    return { array: build(checker.getIndexTypeOfType(type, ts.IndexKind.Number)) };
  if (seen.has(type)) return { node: seen.get(type) };
  const index = nodes.length,
    node = { fields: {}, required: [] };
  seen.set(type, index);
  nodes.push(node);
  for (const property of checker.getPropertiesOfType(type)) {
    const at = property.valueDeclaration ?? property.declarations?.[0] ?? declaration;
    const propertyType = checker.getTypeOfSymbolAtLocation(property, at);
    node.fields[property.name] = build(propertyType);
    if (
      !(property.flags & ts.SymbolFlags.Optional) &&
      !(propertyType.flags & ts.TypeFlags.Undefined) &&
      !(propertyType.isUnion() && propertyType.types.some((t) => t.flags & ts.TypeFlags.Undefined))
    )
      node.required.push(property.name);
  }
  const values = checker.getIndexTypeOfType(type, ts.IndexKind.String);
  if (values) node.values = build(values);
  return { node: index };
}
const roots = Object.fromEntries(
  declaration.members.map((member) => [member.name.text, build(checker.getTypeAtLocation(member))]),
);
const content = JSON.stringify({ roots, nodes }, null, 1) + '\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(output, 'utf8') !== content)
    throw Error('Stored shape graph is stale; run node tools/build-stored-shapes.mjs');
} else fs.writeFileSync(output, content);
