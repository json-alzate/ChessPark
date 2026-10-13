/** Licencias bajo las que llega lo que se muestra en la pantalla de créditos. */
export type CreditLicenseId =
  | 'GPL-2.0+'
  | 'MIT'
  | 'Apache-2.0'
  | 'CC0-1.0'
  | 'CC-BY-3.0'
  | 'CC-BY-4.0';

export interface CreditLicense {
  /** Nombre corto, tal como se muestra. */
  label: string;
  url: string;
}

/** Autoría de un set de piezas. */
export interface PieceCredit {
  author: string;
  /** Página del autor o del repositorio del set; no todos tienen una. */
  url?: string;
  license: CreditLicenseId;
}

/** Una pista de la música del directo. */
export interface MusicCredit {
  title: string;
  author: string;
  source: 'ccmixter' | 'commons';
  /** Página de la pista en su fuente. */
  url: string;
  license: CreditLicenseId;
  durationSec: number;
}
