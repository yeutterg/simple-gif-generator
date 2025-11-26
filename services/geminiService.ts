import { GoogleGenAI, Type } from "@google/genai";
import { AiCaptionResult } from "../types";

const GEMINI_API_KEY = process.env.API_KEY || '';

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }

  async generateCaption(imageBlob: Blob): Promise<AiCaptionResult> {
    if (!GEMINI_API_KEY) {
      console.warn("No API Key found for Gemini");
      return { caption: "GifSmith Magic", hashtags: ["#gifsmith"] };
    }

    try {
      // Convert blob to base64
      const base64Data = await this.blobToBase64(imageBlob);

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data
              }
            },
            {
              text: "Analyze this image and generate a funny, witty, short caption (max 6 words) suitable for a GIF. Also provide 3 relevant hashtags."
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              caption: { type: Type.STRING },
              hashtags: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        }
      });

      if (response.text) {
        return JSON.parse(response.text) as AiCaptionResult;
      }
      throw new Error("No response text");

    } catch (error) {
      console.error("Gemini API Error:", error);
      return { caption: "Cool GIF!", hashtags: ["#gif"] };
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data url prefix (e.g. "data:image/jpeg;base64,")
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const geminiService = new GeminiService();
