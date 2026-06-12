// Stub for the `server-only` package in the Node test environment. The real
// package throws on import outside a React Server Component build; aliasing it
// here lets integration tests import server modules (env.server, the service
// client, the notification dispatcher) directly.
export {};
