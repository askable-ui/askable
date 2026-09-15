import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import ts from 'typescript';

export function assertStandaloneClassicScript(code, filename) {
  // Script parsing rejects static import/export, import.meta, and top-level await.
  new Script(code, { filename });
  const ast = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword,
        `${filename} must not contain dynamic imports`);
      if (ts.isIdentifier(node.expression)) {
        assert.ok(!['require', 'importScripts'].includes(node.expression.text),
          `${filename} must not load external scripts`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
