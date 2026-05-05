export interface User {
    uid: string;
    name?: string;
    elo: number;
    eloPuzzles?: number;
    numberPuzzlesPlayed?: number;
    scoreCoordinatesW?: number;
    scoreCoordinatesB?: number;
    country?: string;
    elos?: {
        warmupTotal?: number;
        warmup?: {
            [key: string]: number;
        };
        warmupMaxTotal?: number;
        warmupMax?: {
            [key: string]: number;
        };
        plan1Total?: number;
        plan1?: {
            [key: string]: number;
        };
        plan1Openings?: {
            [key: string]: number;
        };
        plan1MaxTotal?: number;
        plan1Max?: {
            [key: string]: number;
        };
        plan1MaxOpenings?: {
            [key: string]: number;
        };
        plan3Total?: number;
        plan3?: {
            [key: string]: number;
        };
        plan3Openings?: {
            [key: string]: number;
        };
        plan3MaxTotal?: number;
        plan3Max?: {
            [key: string]: number;
        };
        plan3MaxOpenings?: {
            [key: string]: number;
        };
        plan5Total?: number;
        plan5?: {
            [key: string]: number;
        };
        plan5Openings?: {
            [key: string]: number;
        };
        plan5MaxTotal?: number;
        plan5Max?: {
            [key: string]: number;
        };
        plan5MaxOpenings?: {
            [key: string]: number;
        };
        plan10Total?: number;
        plan10?: {
            [key: string]: number;
        };
        plan10Openings?: {
            [key: string]: number;
        };
        plan10MaxTotal?: number;
        plan10Max?: {
            [key: string]: number;
        };
        plan10MaxOpenings?: {
            [key: string]: number;
        };
        plan20Total?: number;
        plan20?: {
            [key: string]: number;
        };
        plan20Openings?: {
            [key: string]: number;
        };
        plan20MaxTotal?: number;
        plan20Max?: {
            [key: string]: number;
        };
        plan20MaxOpenings?: {
            [key: string]: number;
        };
        plan30Total?: number;
        plan30?: {
            [key: string]: number;
        };
        plan30Openings?: {
            [key: string]: number;
        };
        plan30MaxTotal?: number;
        plan30Max?: {
            [key: string]: number;
        };
        plan30MaxOpenings?: {
            [key: string]: number;
        };
        backToCalmTotal?: number;
        backToCalm?: {
            [key: string]: number;
        };
        backToCalmMaxTotal?: number;
        backToCalmMax?: {
            [key: string]: number;
        };
        infinityTotal?: number;
        infinity?: {
            [key: string]: number;
        };
        infinityMaxTotal?: number;
        infinityMax?: {
            [key: string]: number;
        };
    };
    createAt: number;
}

