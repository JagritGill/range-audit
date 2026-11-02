# Dependencies and provenance

The application and tests use Node.js built-in modules only. There are no npm
runtime or development dependencies, downloaded assets, fonts, images, or data.
Node is supplied by the user's environment and is not vendored. Node's own
[license and third-party notices](https://github.com/nodejs/node/blob/v24.4.1/LICENSE)
cover the runtime and its incorporated components, including its type-stripping
implementation. This project does not relicense or redistribute those components.

Native TypeScript support and its lack of static type checking are described in
the official [Node documentation](https://nodejs.org/api/typescript.html). Tests
use the built-in [test runner](https://nodejs.org/api/test.html).

GitHub CI uses external MIT-licensed actions pinned to release commits. Their
notices remain in their respective repositories:

- `actions/checkout` v7.0.1: [license](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/LICENSE)
- `actions/setup-node` v7.1.0: [license](https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/LICENSE)

The original application, tests, examples, SVG styling, and documentation were
created with AI assistance in Codex in a new isolated folder. Every supplied
manifest and fixture is synthetic. No employer/business source, private
repository contents, or third-party application implementations were read or
copied. Interval sweeps are established algorithms; no invention claim is made.

Original project files use the [MIT License](LICENSE). There are no measured
performance, adoption, or production-readiness claims.
