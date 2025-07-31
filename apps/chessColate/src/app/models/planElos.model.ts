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
}
