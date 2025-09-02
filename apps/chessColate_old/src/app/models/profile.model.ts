import { User } from './user.model';
import { PiecesStyle, BoardStyle } from './ui.model';


export interface Profile extends User {
    email: string;
    lang: string;
    pieces?: PiecesStyle;
    board?: BoardStyle;
}
