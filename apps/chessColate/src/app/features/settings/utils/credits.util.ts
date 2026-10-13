import type { CreditLicenseId, MusicCredit } from '../models/credits.model';

/** Orden en que se muestran las licencias de la música: primero las que exigen atribución. */
export const MUSIC_LICENSE_ORDER: readonly CreditLicenseId[] = ['CC-BY-3.0', 'CC-BY-4.0', 'CC0-1.0'];

export interface MusicLicenseGroup {
  license: CreditLicenseId;
  tracks: readonly MusicCredit[];
}

/** Agrupa las pistas por licencia, en `MUSIC_LICENSE_ORDER`, sin grupos vacíos. */
export function groupMusicByLicense(tracks: readonly MusicCredit[]): MusicLicenseGroup[] {
  return MUSIC_LICENSE_ORDER.map((license) => ({
    license,
    tracks: tracks.filter((track) => track.license === license),
  })).filter((group) => group.tracks.length > 0);
}

/** Cantidad de autores distintos. */
export function countAuthors(tracks: readonly MusicCredit[]): number {
  return new Set(tracks.map((track) => track.author)).size;
}

/** `225` → `3:45`. */
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
