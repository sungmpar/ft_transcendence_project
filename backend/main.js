// Nest's TypeORM entities need the decorator metadata emitted by `nest build`.
// Run this existing Node entrypoint after the build, rather than transpiling
// src/main.ts in the deployment runtime. Keep dist/shared beside dist/backend.
require('reflect-metadata');
require('./dist/backend/src/main.js');
