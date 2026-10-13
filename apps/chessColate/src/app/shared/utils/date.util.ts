/**
 * Fecha local como 'YYYY-MM-DD'. Es el formato con el que se guarda "hoy" en
 * el dispositivo (último día entrenado, última petición de reseña…), así que
 * se reutiliza en lugar de repetirlo en cada funcionalidad.
 */
export function toLocalISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;
}
