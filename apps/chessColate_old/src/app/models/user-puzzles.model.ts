import { Puzzle } from '@models/puzzle.model';


export interface UserPuzzle {
    uid: string;
    uidUser: string;
    uidPuzzle: string;
    date: number;
    resolved: boolean;
    failByTime: boolean;
    resolvedTime: number;
    currentEloUser: number;
    eloPuzzle: number;
    themes: string[];
    openingFamily?: string;
    openingVariation?: string;
    fenPuzzle?: string;
    fenStartUserPuzzle?: string;
    firstMoveSquaresHighlight?: string[];
    rawPuzzle?: Puzzle;
}
