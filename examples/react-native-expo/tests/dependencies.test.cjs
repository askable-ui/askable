const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { test } = require('node:test');

// Resolve through Expo's consumer, not an unrelated hoisted UUID installation.
const requirePlugins = createRequire(require.resolve('@expo/config-plugins/package.json'));
const requireXcode = createRequire(requirePlugins.resolve('xcode/package.json'));
const xcode = requirePlugins('xcode');
const uuid = requireXcode('uuid');
const parser = requireXcode('./lib/parser/pbxproj');

test('xcode resolves the patched CommonJS UUID release', () => {
  assert.equal(requireXcode('uuid/package.json').version, '11.1.1');
  assert.match(uuid.v4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('UUID rejects undersized output buffers without partial writes', () => {
  for (const method of ['v3', 'v5', 'v6']) {
    const buffer = new Uint8Array(8).fill(0xaa);
    const args = method === 'v6' ? [{}] : ['example', uuid[method].DNS];
    assert.throws(() => uuid[method](...args, buffer, 4), RangeError, method);
    assert.deepEqual(buffer, new Uint8Array(8).fill(0xaa), method);
  }
});

test('xcode can generate project IDs and round-trip project edits', () => {
  const project = xcode.project('dependency-test.pbxproj');
  project.hash = {
    project: {
      archiveVersion: 1,
      classes: {},
      objectVersion: 56,
      objects: { PBXGroup: {}, PBXFileReference: {}, PBXBuildFile: {} },
    },
  };

  const ids = new Set();
  for (let i = 0; i < 100; i += 1) {
    const { uuid: id } = project.addPbxGroup(['Example.swift'], `Group${i}`, 'Sources');
    assert.match(id, /^[0-9A-F]{24}$/);
    assert.equal(ids.has(id), false);
    ids.add(id);
  }

  const parsed = parser.parse(project.writeSync());
  const groups = parsed.project.objects.PBXGroup;
  for (const id of ids) {
    assert.equal(groups[id].isa, 'PBXGroup');
    assert.equal(groups[id].children.length, 1);
    assert.ok(parsed.project.objects.PBXFileReference[groups[id].children[0].value]);
  }
});
