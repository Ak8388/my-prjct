
import { GoogleGenAI, Type } from "@google/genai";
import { LocationData, AIInsight } from "../types";

export const getLocationInsights = async (location: LocationData): Promise<AIInsight> => {
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "") {
    console.error("API_KEY is missing. Check your Vercel Environment Variables.");
    return {
      summary: "Analisis lokasi tidak tersedia karena API Key belum dikonfigurasi.",
      safetyRating: "Waspada",
      recommendation: "Mohon masukkan API_KEY di Dashboard Vercel lalu Redeploy."
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
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
          propertyOrdering: ["summary", "safetyRating", "recommendation"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty AI response");

    return JSON.parse(text.trim()) as AIInsight;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      summary: "Gagal mendapatkan analisis dari AI. Pastikan API Key valid.",
      safetyRating: "Waspada",
      recommendation: "Periksa kembali status billing atau kuota di Google AI Studio."
    };
  }
};
