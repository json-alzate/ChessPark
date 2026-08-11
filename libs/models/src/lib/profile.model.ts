import { User } from './user.model';
import { PiecesStyle, BoardStyle } from './ui.model';
import { StreakRecord } from './streak.model';
import { Reto333Record } from './reto333.model';

/**
 * Marcas personales de los modos que no llevan elo (Reto 333 y Racha).
 *
 * Viven dentro del perfil y no en una colección aparte: son cuatro números por
 * usuario, ya viajan con el perfil al iniciar sesión (sin lectura extra) y no
 * necesitan reglas de seguridad nuevas.
 */
export interface UserRecords {
    reto333?: Reto333Record;
    streak?: StreakRecord;
}

export interface Profile extends User {
    email: string;
    lang: string;
    pieces?: PiecesStyle;
    board?: BoardStyle;
    /** Récords sincronizados entre dispositivos. */
    records?: UserRecords;
}
