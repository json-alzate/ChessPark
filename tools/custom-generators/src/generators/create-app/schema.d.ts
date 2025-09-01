export interface CreateAppGeneratorSchema {
  name: string;
  description?: string;
  hasElements?: boolean;
  hasElementsSimple?: boolean;
  hasElementsEnhanced?: boolean;
  hasCapacitor?: boolean;
  hasIonic?: boolean;
  hasTailwind?: boolean;
  hasDaisyUI?: boolean;
  hasNgRx?: boolean;
  hasSwiper?: boolean;
  hasServiceWorker?: boolean;
  hasTests?: boolean;
  hasLint?: boolean;
}
