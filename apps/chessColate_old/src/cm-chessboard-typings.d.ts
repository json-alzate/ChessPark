declare module 'cm-chessboard' {
    // Aquí puedes declarar las constantes y clases que estás importando de 'cm-chessboard'.
    // Estoy utilizando 'any' como un tipo comodín, pero puedes especificar los tipos con mayor detalle si los conoces.

    export const COLOR: any;
    export const INPUT_EVENT_TYPE: 'moveInputStarted' | 'validateMoveInput' | 'moveInputCanceled' | 'moveInputIllegal' | 'moveInputDone';
    export const MOVE_INPUT_MODE: any;
    export const SQUARE_SELECT_TYPE: any;
    export const BORDER_TYPE: any;

    export class Chessboard {
        constructor(element: any, options: any);
        // Agrega aquí los métodos de la clase Chessboard que estás utilizando.
        // Por ejemplo, si estás utilizando un método 'setPosition', puedes declararlo así:
        setPosition(position: any): void;
        // Continúa con los demás métodos que utilizas.
    }
}
