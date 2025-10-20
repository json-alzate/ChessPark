export interface UserRequestToPlay {
    uidUser: string;
    name: string;
    time: number; // tiempo para el juego ejm: 10 minutes
    timeIncrement: number;
    lang: string;
    elo: number;
    color: 'white' | 'black' | 'random';
    country: string; // 3 characters
    createAt: number;
}


export interface Game {
    uid: string; //(auto generado)
    white: UserRequestToPlay;
    black: UserRequestToPlay;
    uidUserWhite: string;
    uidUserBlack: string;
    timeControl: number; // tiempo para el juego ejm: 10 minutes
    createAt: number;
}

export interface OutClockUpdate {
    uid: string;
    time: number;
    type: 'white' | 'black' | 'whiteCountDown' | 'blackCountDown';
}

export interface EndGame {
    uid: string;
    result: '1-0' | '0-1' | '1/2-1/2' | '*';
    motive?: string;
}
