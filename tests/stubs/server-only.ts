// Empty stand-in for the `server-only` marker package, which throws
// when imported outside a React Server Component graph. Tests run in
// plain node and exercise server modules directly, so the marker is
// aliased here via vitest.config.ts.
export {};
