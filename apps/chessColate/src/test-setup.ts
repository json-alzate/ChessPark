import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

// jsdom no trae fetch/Headers/Response/Request y la build "node" de Firebase Auth
// (la que carga Jest) los lee al importarse: sin esto, cualquier archivo que
// importe `firebase/auth` (AuthService, el plugin de Capacitor...) revienta con
// "fetch is not defined". Son solo marcadores: ninguna prueba usa red y un fetch
// real falla a propósito. Una prueba que necesite fetch lo sobrescribe
// (`global.fetch = jest.fn()`).
const testGlobals = globalThis as Record<string, unknown>;
testGlobals['fetch'] ??= () => Promise.reject(new Error('fetch no está disponible en las pruebas'));
for (const name of ['Headers', 'Request', 'Response']) {
  testGlobals[name] ??= class {};
}
