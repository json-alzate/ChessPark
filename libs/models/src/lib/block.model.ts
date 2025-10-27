import { Puzzle, UserPuzzle } from '@cpark/models';


export interface Block {
    title?: string;
    description?: string;
    time: number; // in seconds (-1 for infinite)
    puzzlesCount: number; // 0 for infinite (until time is over)
    theme: string;
    openingFamily?: string;
    elo: number;
    color: 'white' | 'black' | 'random';
    puzzleTimes?: {
        warningOn: number; // in seconds, -1 for off
        dangerOn: number; // in seconds, -1 for off
        total: number; // in seconds, -1 for off
    };
    puzzles?: Puzzle[];
    puzzlesPlayed: UserPuzzle[];
    showPuzzleSolution?: boolean;
    nextPuzzleImmediately?: boolean;
    goshPuzzle?: boolean;
    goshPuzzleTime?: number;
};