/**
 * System prompts for different grounding types
 */

export const SYSTEM_PROMPTS = {
  default: 'Tu es un assistant utile et serviable.',

  search: 'Tu es un assistant utile avec accès à Google Search. Utilise les résultats de recherche pour fournir des informations à jour et précises.',

  maps: 'Tu es un assistant utile avec accès à Google Maps. Aide les utilisateurs à trouver des lieux, des itinéraires et des informations géographiques.',
} as const;

export type GroundingType = keyof typeof SYSTEM_PROMPTS;

/**
 * Get the system prompt for a given grounding type
 */
export function getSystemPrompt(groundingType?: string): string {
  if (!groundingType || groundingType === 'none') {
    return SYSTEM_PROMPTS.default;
  }

  if (groundingType in SYSTEM_PROMPTS) {
    return SYSTEM_PROMPTS[groundingType as GroundingType];
  }

  return SYSTEM_PROMPTS.default;
}
