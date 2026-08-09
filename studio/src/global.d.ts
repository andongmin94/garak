import type { GarakStudioApi } from './shared/product_api.mts';

declare global {
  interface Window {
    readonly garakStudio: Readonly<GarakStudioApi>;
  }
}

export {};
