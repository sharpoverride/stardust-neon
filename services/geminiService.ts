import { GoogleGenAI, Type, SchemaType } from "@google/genai";
import { MissionData } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found. Using fallback data.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateMission = async (wave: number): Promise<MissionData> => {
  const ai = getClient();

  if (!ai) {
    return {
      title: `SECTOR ${wave}-ALPHA`,
      briefing: "WARNING: UNAUTHORIZED SECTOR ENTRY. MULTIPLE HOSTILES DETECTED ON RADAR. ENGAGE AT WILL.",
      themeColor: "#00ffff",
      enemyDensity: 0.5,
      speedModifier: 1.0
    };
  }

  try {
    const model = 'gemini-3-flash-preview';
    const prompt = `
      Generate a mission briefing for a synthwave/cyberpunk rail shooter game.
      Wave Level: ${wave}.
      The player is a pilot of the 'Vector Vanguard'.
      The briefing should be technical, urgent, and military-styled.
      Also provide visual theme parameters.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Mission codename (e.g., OPERATION NEON RAIN)" },
            briefing: { type: Type.STRING, description: "Short mission text, max 2 sentences." },
            themeColor: { type: Type.STRING, description: "Hex color for the level (neon aesthetics)" },
            enemyDensity: { type: Type.NUMBER, description: "Float 0.3 to 1.0" },
            speedModifier: { type: Type.NUMBER, description: "Float 0.8 to 1.5" }
          },
          required: ["title", "briefing", "themeColor", "enemyDensity", "speedModifier"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No text response");
    
    return JSON.parse(text) as MissionData;

  } catch (error) {
    console.error("Gemini Generation Failed:", error);
    // Fallback
    return {
      title: `PROTOCOL ${wave}-BACKUP`,
      briefing: "COMMUNICATION LINK UNSTABLE. PROCEED WITH CAUTION. MANUAL OVERRIDE ENGAGED.",
      themeColor: "#ff00ff",
      enemyDensity: 0.4 + (wave * 0.1),
      speedModifier: 1.0 + (wave * 0.05)
    };
  }
};
