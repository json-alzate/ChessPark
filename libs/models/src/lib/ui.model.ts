export type PiecesStyle =
    | 'cburnett'
    | 'fantasy'
    | 'staunty'
    | 'spatial'
    | 'celtic'
    | 'chessnut'
    | 'rhosgfx'
    | 'kiwen-suwi'
    | 'firi'
    | 'totoy'
    | 'papercut';
export type BoardStyle =
    | 'default'
    | 'default-contrast'
    | 'blue'
    | 'green'
    | 'chess-club'
    | 'chessboard-js'
    | 'black-and-white'
    | 'blue-classic'
    | 'green-classic'
    | 'royal'
    | 'purple'
    | 'sage';

/**
 * Temas de DaisyUI que se pueden elegir para toda la app. El primero es el de siempre;
 * después van los oscuros y luego los claros, cada grupo en orden alfabético.
 */
export const APP_THEMES = [
    'halloween',
    'abyss', 'aqua', 'black', 'business', 'coffee', 'dark', 'dim', 'dracula', 'forest',
    'luxury', 'night', 'sunset', 'synthwave',
    'acid', 'autumn', 'bumblebee', 'caramellatte', 'cmyk', 'corporate', 'cupcake', 'cyberpunk',
    'emerald', 'fantasy', 'garden', 'lemonade', 'light', 'lofi', 'nord', 'pastel', 'retro',
    'silk', 'valentine', 'winter', 'wireframe',
] as const;
export type AppTheme = (typeof APP_THEMES)[number];

/** Tema con el que la app arranca y al que se vuelve si el guardado ya no existe. */
export const DEFAULT_APP_THEME: AppTheme = 'halloween';

/** Temas de `APP_THEMES` con fondo oscuro (el resto son claros). */
export const DARK_APP_THEMES: readonly AppTheme[] = APP_THEMES.slice(0, 14);
