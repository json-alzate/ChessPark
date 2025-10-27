export interface PuzzleThemesGroup {
    groupName: string;
    themes: PuzzleThemes[];
}


export interface PuzzleThemes {
    nameEs: string;
    descriptionEs: string;
    nameEn: string;
    descriptionEn: string;
    count: number;
    img: string;
    value: string;
};