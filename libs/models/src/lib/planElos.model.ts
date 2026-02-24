export interface PlanElos {
    uid: string;
    uidUser: string;
    uidPlan: string;
    themes: {
        [key: string]: number;
    };
    openings: {
        [key: string]: number;
    };
    total: number;
    timesPlayed?: number;
    maxTotal?: number;
    maxThemes?: {
        [key: string]: number;
    };
    maxOpenings?: {
        [key: string]: number;
    };
}
