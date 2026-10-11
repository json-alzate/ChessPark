import { expect as expectBase, test } from './test';

/**
 * Mismo `test` de support/test.ts (red cortada, fecha fija, semilla) pero con más margen
 * en las esperas de `expect`: la app es pesada en frío y la suite corre varios navegadores
 * a la vez (y a veces otras suites en la misma máquina). 15 s evita falsos fallos sin
 * ocultar nada: una espera que pasa lo hace en cuanto se cumple la condición.
 */
export const expect = expectBase.configure({ timeout: 15_000 });
export { test };
