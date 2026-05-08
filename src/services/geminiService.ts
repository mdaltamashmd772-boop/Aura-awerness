/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { WellnessSeed } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getStressReliefAdvice(feeling: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide a quick (30-second) stress relief exercise or perspective for someone feeling "${feeling}". Make it compassionate, effective, and healthy. Under 40 words.`,
    });
    return response.text || "Breathe deeply. This moment is temporary, but your strength is permanent.";
  } catch (error) {
    return "Close your eyes and take three slow, deep breaths. Exhale the tension.";
  }
}

export async function generateDailySeed(): Promise<WellnessSeed> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate a small, actionable wellness task for today. It should be simple, effective, and improve quality of life. Provide a title, description, category (physical, mental, social, or spiritual), and estimated time (e.g., '5 mins').",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING, enum: ['physical', 'mental', 'social', 'spiritual'] },
            estimatedTime: { type: Type.STRING },
          },
          required: ['title', 'description', 'category', 'estimatedTime'],
        },
      },
    });

    const data = JSON.parse(response.text || '{}');
    return {
      id: Math.random().toString(36).substring(7),
      ...data
    };
  } catch (error) {
    console.error("Error generating wellness seed:", error);
    // Fallback seed
    return {
      id: 'default',
      title: 'Morning Sunlight',
      description: 'Spend 5-10 minutes under the direct morning sun to regulate your circadian rhythm.',
      category: 'physical',
      estimatedTime: '10 mins'
    };
  }
}

export async function getMotivationalQuote(moodScore: number): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a short, powerful, and empathetic motivational quote for someone who rated their mood as ${moodScore} out of 5 today. (1 is low, 5 is high). Keep it under 20 words.`,
    });
    return response.text || "You have everything you need within you.";
  } catch (error) {
    return "The journey of a thousand miles begins with a single step.";
  }
}

export async function generateAffirmation(mood: string): Promise<string> {
  const prompt = `Generate a single, powerful, and elegant wellness affirmation for someone feeling "${mood}". Keep it under 15 words. Elegant and luxurious tone.`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "I am worthy of peace and gentle restoration.";
  } catch (e) {
    return "I am worthy of peace and gentle restoration.";
  }
}
