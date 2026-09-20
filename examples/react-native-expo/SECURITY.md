# Dependency security validation

Validated on 2026-09-20 with Node.js 22.23.2 and npm 10.9.8 on macOS.
The example/package version is unchanged.

## Audit result

Full `npm audit --json` results, including development dependencies:

| Severity | Before (`acae030`) | After remediation |
| --- | ---: | ---: |
| Critical | 0 | 0 |
| High | 15 | 0 |
| Moderate | 4 | 0 |
| Low | 1 | 0 |
| Info | 0 | 0 |
| Total vulnerable packages | 20 | 0 |

These are npm's vulnerable-package counts, including affected parent packages,
not counts of unique advisories. GitHub can report several dependency alerts
for one package. No audit findings are suppressed or omitted.

## Compatible stack

Stay on SDK 55 rather than migrating to another SDK. Expo 55.0.31's published
`bundledNativeModules.json` and `expo-template-blank-typescript@sdk-55` specify
React 19.2.0, React Native 0.83.10, and expo-status-bar ~55.0.6. Screens ~4.23.0
and safe-area-context ~5.6.2 likewise follow Expo's bundled native versions.
See the [SDK 55 release notes](https://expo.dev/changelog/sdk-55) and
[upgrade checks](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

The lockfile refresh selects patched transitive packages within their declared
ranges. The global XML parser and shell-quote overrides are removed: they were
unnecessary and could hold dependencies on vulnerable versions. The web
dependencies and Babel preset are declared directly because this example's
existing commands/configuration require them; they no longer depend on hoisting.

## Remaining override

`xcode@3.0.1 -> uuid@11.1.1` is the only override. The latest published xcode
release remains 3.0.1 and requests UUID ^7.0.3, with no patched release in that
range. Without the override, npm reports nine moderate affected packages through
the Expo configuration chain. Its suggested Expo 46 downgrade is not a
compatible remediation.

UUID 11.1.1 is a patched CommonJS release for
[GHSA-w5hq-g745-h8pq](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq).
This is a deliberate cross-major override limited to xcode. Xcode calls only
`uuid.v4()` without arguments, not the vulnerable buffer-writing methods.
`npm run test:dependencies` verifies the actual UUID resolved by Expo's xcode
consumer, rejection of undersized buffers, and project ID generation plus
project-edit serialization/parsing. Remove the override when xcode/Expo adopt
a compatible patched UUID dependency, then rerun the validation commands.

## Verification and limits

The [README validation commands](README.md#validation) passed: clean strict peer
install, full audit at the low-severity threshold, full dependency-tree check,
Expo version alignment, Expo Doctor 20/20 checks, three dependency regression
tests, TypeScript checking, and Android/iOS/web export. Native exports generated
Hermes bytecode. No force or legacy-peer-deps install flags were used.

No unresolved packages remain in the npm audit. Installation still warns about
upstream deprecated `inflight@1.0.6`, `glob@7.2.3`, and `rimraf@3.0.2`. These are
maintenance risks, not findings in this audit snapshot. Inflight has no fixed
1.x release; replacing these transitive APIs belongs upstream, rather than in
untested blanket major-version overrides.

A browser smoke check confirmed web rendering and revenue-card context capture.
No native compilation, simulator, emulator, or device tests were run.
JavaScript export and Expo Doctor do not prove native runtime behavior.
The workflow enforces the same checks on pull requests and pushes to main.
Audit results are time-specific and should be checked again before release.
