import { Injectable, signal } from '@angular/core';
import { BotMoveResult, BotProfile, BotStatus, OpeningBook } from './types/bot.types';
import { OpeningBookService } from './opening-book.service';
import { encodeFen } from './board-encoder';
import { buildLegalMask, indexToUci } from './move-encoder';

// @tensorflow/tfjs must be installed separately: npm install @tensorflow/tfjs
// Imported dynamically to avoid bundling it when the library is not used.
type TfModule = typeof import('@tensorflow/tfjs');
type GraphModel = import('@tensorflow/tfjs').GraphModel;

/**
 * Confidence threshold: if the neural network's best legal move probability
 * falls below this value, Stockfish is used as a fallback.
 */
const CONFIDENCE_THRESHOLD = 0.04;

/**
 * Sampling temperature: 0.8 gives variety without being too random.
 * Lower = more deterministic, higher = more surprising.
 */
const SAMPLING_TEMPERATURE = 0.8;

@Injectable({ providedIn: 'root' })
export class BotEngineService {
  readonly status = signal<BotStatus>(BotStatus.Unloaded);
  readonly currentBot = signal<BotProfile | null>(null);

  private tf: TfModule | null = null;
  private model: GraphModel | null = null;
  private assetsBasePath = '';

  constructor(private openingBook: OpeningBookService) {}

  /**
   * Loads a bot from its asset bundle.
   * @param profileUrl - URL to bot_profile.json
   * @param assetsBase - Base URL where model/ and opening_book.json live
   */
  async loadBot(profileUrl: string, assetsBase: string): Promise<void> {
    this.status.set(BotStatus.Loading);
    this.assetsBasePath = assetsBase;

    try {
      this.tf = await import('@tensorflow/tfjs');
      await this.tf.ready();

      const profile: BotProfile = await fetch(profileUrl).then(r => r.json());
      this.currentBot.set(profile);

      const modelUrl = `${assetsBase}/${profile.model.path}`;
      this.model = await this.tf.loadGraphModel(modelUrl);

      const bookData: OpeningBook = await fetch(`${assetsBase}/${profile.openingBook.path}`).then(r => r.json());
      this.openingBook.load(bookData);

      this.status.set(BotStatus.Ready);
    } catch (err) {
      this.status.set(BotStatus.Error);
      throw err;
    }
  }

  /**
   * Returns the bot's chosen move for the current position.
   *
   * Priority:
   *  1. Opening book (exact FEN lookup, frequency-weighted)
   *  2. Neural network (masked softmax with temperature sampling)
   *  3. Stockfish fallback via callback (when network confidence is low)
   *
   * @param fen - Current board position in FEN notation
   * @param legalMoves - Legal moves in UCI format (e.g. ['e2e4', 'g1f3'])
   * @param stockfishFallback - Called when the network has low confidence; should return a UCI move
   */
  async getMove(
    fen: string,
    legalMoves: string[],
    stockfishFallback: () => Promise<string>
  ): Promise<BotMoveResult> {
    if (this.status() !== BotStatus.Ready) {
      throw new Error('Bot is not ready. Call loadBot() first.');
    }

    this.status.set(BotStatus.Thinking);

    try {
      // 1. Opening book
      const bookMove = this.openingBook.lookup(fen);
      if (bookMove && legalMoves.includes(bookMove)) {
        this.status.set(BotStatus.Ready);
        return { move: bookMove, source: 'opening_book', confidence: 1.0 };
      }

      // 2. Neural network
      const result = await this.runInference(fen, legalMoves);

      if (result.confidence !== undefined && result.confidence < CONFIDENCE_THRESHOLD) {
        // 3. Stockfish fallback — network is not confident enough
        const sfMove = await stockfishFallback();
        this.status.set(BotStatus.Ready);
        return { move: sfMove, source: 'stockfish_fallback' };
      }

      this.status.set(BotStatus.Ready);
      return result;
    } catch (err) {
      this.status.set(BotStatus.Ready);
      throw err;
    }
  }

  unloadBot(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.openingBook.unload();
    this.currentBot.set(null);
    this.status.set(BotStatus.Unloaded);
  }

  private async runInference(fen: string, legalMoves: string[]): Promise<BotMoveResult> {
    if (!this.tf || !this.model) throw new Error('Model not loaded');

    const tf = this.tf;

    const encoded = encodeFen(fen);
    const inputTensor = tf.tensor4d([encoded], [1, 8, 8, 20]);

    const output = this.model.predict(inputTensor) as import('@tensorflow/tfjs').Tensor;
    // Model outputs [policyLogits (1×4096), valueLogit (1×1)]
    const policyTensor = Array.isArray(output) ? output[0] : output;
    const logits = await policyTensor.squeeze().data() as Float32Array;

    tf.dispose([inputTensor, ...(Array.isArray(output) ? output : [output])]);

    // Apply legal move mask
    const legalMask = buildLegalMask(legalMoves);
    const maskedLogits = new Float32Array(4096);
    let maxLogit = -Infinity;

    for (let i = 0; i < 4096; i++) {
      if (legalMask[i] === 1) {
        maskedLogits[i] = logits[i];
        if (logits[i] > maxLogit) maxLogit = logits[i];
      } else {
        maskedLogits[i] = -Infinity;
      }
    }

    // Softmax with temperature over legal moves only
    const probs = this.softmaxWithTemperature(maskedLogits, legalMask, SAMPLING_TEMPERATURE);
    const maxConfidence = Math.max(...Array.from(probs).filter((_, i) => legalMask[i] === 1));

    const moveIndex = this.sampleFromDistribution(probs);
    const move = indexToUci(moveIndex);

    return { move, source: 'neural_network', confidence: maxConfidence };
  }

  private softmaxWithTemperature(
    logits: Float32Array,
    mask: Float32Array,
    temperature: number
  ): Float32Array {
    const scaled = new Float32Array(4096);
    let maxVal = -Infinity;

    for (let i = 0; i < 4096; i++) {
      if (mask[i] === 1) {
        scaled[i] = logits[i] / temperature;
        if (scaled[i] > maxVal) maxVal = scaled[i];
      }
    }

    let sumExp = 0;
    const exp = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) {
      if (mask[i] === 1) {
        exp[i] = Math.exp(scaled[i] - maxVal);
        sumExp += exp[i];
      }
    }

    const probs = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) {
      probs[i] = mask[i] === 1 ? exp[i] / sumExp : 0;
    }

    return probs;
  }

  private sampleFromDistribution(probs: Float32Array): number {
    let rand = Math.random();
    for (let i = 0; i < probs.length; i++) {
      rand -= probs[i];
      if (rand <= 0) return i;
    }
    // Fallback: return highest probability move
    let maxIdx = 0;
    for (let i = 1; i < probs.length; i++) {
      if (probs[i] > probs[maxIdx]) maxIdx = i;
    }
    return maxIdx;
  }

  /** Maps player ELO to Stockfish skill level 0-20 */
  eloToSkillLevel(elo: number): number {
    const clamped = Math.max(800, Math.min(2800, elo));
    return Math.round(((clamped - 800) / 2000) * 20);
  }
}
