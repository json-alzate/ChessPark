/**
 * Helper para serializar datos de Firestore y evitar problemas con objetos congelados
 * (los documentos llegan con prototipos/objetos no clonables al store de NgRx).
 * Lo comparten PublicPlanRepository y PlanInteractionRepository.
 */
export function serializeFirestoreData<T>(data: any): T {
  try {
    return JSON.parse(JSON.stringify(data)) as T;
  } catch (e) {
    console.error('Error serializing Firestore data:', e);
    // Fallback: crear copia manual
    if (data === null || data === undefined) {
      return data as T;
    }
    if (typeof data !== 'object') {
      return data as T;
    }
    if (Array.isArray(data)) {
      return data.map(item => serializeFirestoreData(item)) as T;
    }
    const copy: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        try {
          copy[key] = serializeFirestoreData(data[key]);
        } catch (err) {
          // Omitir propiedades problemáticas
          continue;
        }
      }
    }
    return copy as T;
  }
}
