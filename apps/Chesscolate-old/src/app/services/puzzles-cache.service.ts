import { Injectable } from '@angular/core';

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

@Injectable({
  providedIn: 'root'
})
export class PuzzlesCacheService {

  isMobile = Capacitor.getPlatform() !== 'web';

  constructor() { }



  getFileNameFromUrl(url: string): string {
    return btoa(url); // codifica en base64 para evitar caracteres raros
  }

  async isFileCached(url: string): Promise<boolean> {
    const key = `chesscolate_puzzles_${url}`;
    return !!localStorage.getItem(key);
  }

  async getCachedPuzzles(url: string): Promise<any[] | null> {
    if (!this.isMobile) { return null; }

    const fileName = this.getFileNameFromUrl(url);
    try {
      const result = await Filesystem.readFile({
        path: fileName,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });
      return JSON.parse(result.data as string);
    } catch {
      return null;
    }
  }

  async cachePuzzles(url: string, puzzles: any[]): Promise<void> {
    const fileName = this.getFileNameFromUrl(url);
    const json = JSON.stringify(puzzles);

    if (this.isMobile) {
      await Filesystem.writeFile({
        path: fileName,
        data: json,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });
    }

    const meta = {
      url,
      fileName,
      date: new Date().toISOString()
    };
    localStorage.setItem(`chesscolate_puzzles_${url}`, JSON.stringify(meta));
  }
}
