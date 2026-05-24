import type { LayerName, CodePulseConfig } from '../types.js';

export interface LayerBudget {
  layer: LayerName;
  tokens: number;
}

export function allocateBudget(
  totalTokens: number,
  config: CodePulseConfig,
  hasFocusPath: boolean,
  layers: LayerName[],
): LayerBudget[] {
  const weights = { ...config.layerWeights };

  if (!hasFocusPath) {
    // Redistribute focus weight to symbol_table
    const focusWeight = weights.focus;
    delete (weights as Record<string, number>).focus;
    const remaining = layers.filter(l => l !== 'focus');
    const total = remaining.reduce((s, l) => s + (weights[l] ?? 0), 0);
    for (const l of remaining) {
      weights[l] = ((weights[l] ?? 0) / total) * (1 - focusWeight / 1) + (l === 'symbol_table' ? focusWeight : 0);
    }
  }

  const activeLayers = hasFocusPath ? layers : layers.filter(l => l !== 'focus');

  // Normalize weights for active layers
  const activeTotal = activeLayers.reduce((s, l) => s + (weights[l] ?? 0), 0);
  return activeLayers.map(layer => ({
    layer,
    tokens: Math.floor(totalTokens * (weights[layer] ?? 0) / activeTotal),
  }));
}
