import { Injectable } from '@angular/core';

import { CHESSBOARD_ASSETS_URL, PIECES_FILES, getChessboardAppearance } from '@chesspark/board';
import { PiecesStyle } from '@chesspark/models';

/** Las doce piezas del set elegido: cada una como imagen para el lienzo y como URL para las plantillas. */
export interface RunnerPieceSet {
  images: ReadonlyMap<string, CanvasImageSource>;
  urls: ReadonlyMap<string, string>;
}

const PIECE_KEYS = ['wk', 'wq', 'wr', 'wb', 'wn', 'wp', 'bk', 'bq', 'br', 'bb', 'bn', 'bp'];
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/**
 * Las piezas del Chess Runner son las del set que el usuario eligió en Ajustes, las mismas del tablero.
 * El set viene en un solo SVG (el sprite de cm-chessboard, con un `<g id="wk">` por pieza): aquí se parte
 * en doce imágenes sueltas. Cada set se descarga una vez; las carreras siguientes lo reutilizan.
 */
@Injectable({ providedIn: 'root' })
export class RunnerPiecesService {
  private cache = new Map<PiecesStyle, Promise<RunnerPieceSet>>();

  /** El set que el usuario tiene elegido ahora. */
  load(style: PiecesStyle = getChessboardAppearance().pieces): Promise<RunnerPieceSet> {
    let loading = this.cache.get(style);
    if (!loading) {
      loading = this.fetchSet(style).catch((error) => {
        // Un fallo de red no deja el set fallado para siempre: la próxima vez se reintenta
        this.cache.delete(style);
        throw error;
      });
      this.cache.set(style, loading);
    }
    return loading;
  }

  private async fetchSet(style: PiecesStyle): Promise<RunnerPieceSet> {
    const response = await fetch(CHESSBOARD_ASSETS_URL + PIECES_FILES[style]);
    if (!response.ok) {
      throw new Error(`No se pudo cargar el set de piezas ${style} (${response.status})`);
    }
    const sprite = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');

    const urls = new Map<string, string>();
    for (const key of PIECE_KEYS) {
      const svg = this.pieceSvg(sprite, key);
      urls.set(key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    }
    const images = new Map<string, CanvasImageSource>();
    await Promise.all(
      [...urls].map(async ([key, url]) => {
        images.set(key, await this.loadImage(url));
      })
    );
    return { images, urls };
  }

  /**
   * El SVG suelto de una pieza. Se conservan los `<g>` de alrededor (algunos sets ponen ahí el trazo, el
   * relleno o un desplazamiento que heredan las piezas).
   */
  private pieceSvg(sprite: Document, key: string): string {
    const piece = sprite.getElementById(key);
    if (!piece) {
      throw new Error(`Al set de piezas le falta la pieza ${key}`);
    }
    const serializer = new XMLSerializer();
    const clone = piece.cloneNode(true) as Element;
    clone.removeAttribute('id');
    let markup = serializer.serializeToString(clone);
    for (let parent = piece.parentElement; parent && parent !== sprite.documentElement; parent = parent.parentElement) {
      const wrapper = parent.cloneNode(false) as Element;
      wrapper.removeAttribute('id');
      const open = serializer.serializeToString(wrapper).replace(/\/>$/, '>');
      markup = `${open}${markup}</${wrapper.localName}>`;
    }
    return `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}" width="40" height="40" viewBox="0 0 40 40">${markup}</svg>`;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo dibujar una pieza del set'));
      image.src = src;
    });
  }
}
