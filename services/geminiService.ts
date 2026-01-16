
import { GoogleGenAI, Type } from "@google/genai";
import { LocationData, AIInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getLocationInsights = async (location: LocationData): Promise<AIInsight> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Berikan analisis singkat tentang lokasi berikut dalam Bahasa Indonesia:
      Latitude: ${location.latitude}
      Longitude: ${location.longitude}
      Akurasi: ${location.accuracy} meter
      Waktu: ${new Date(location.timestamp).toLocaleTimeString()}
      
      Berikan ringkasan situasi, rating keamanan (Aman/Waspada/Bahaya), dan rekomendasi kecil.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            safetyRating: { type: Type.STRING },
            recommendation: { type: Type.STRING },
          },
          required: ["summary", "safetyRating", "recommendation"],
        },
      },
    });

    return JSON.parse(response.text.trim()) as AIInsight;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      summary: "Gagal mendapatkan analisis AI untuk lokasi ini.",
      safetyRating: "Waspada",
      recommendation: "Periksa koneksi internet Anda."
    };
  }
};
