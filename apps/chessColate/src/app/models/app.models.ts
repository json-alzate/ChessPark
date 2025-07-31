export interface AppPuzzleThemesGroup {
    groupName: string;
    themes: AppPuzzlesThemes[];
}


export interface AppPuzzlesThemes {
    nameEs: string;
    descriptionEs: string;
    nameEn: string;
    descriptionEn: string;
    count: number;
    img: string;
    value: string; // Name to send to the DB query
};

export interface Opening {
    nameEn: string;
    descriptionEn: string;
    nameEs: string;
    descriptionEs: string;
    value: string;
    count: number;
}

