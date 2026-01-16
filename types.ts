
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  address?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  lastSeen: number;
  status: 'online' | 'offline' | 'moving';
  currentLocation?: LocationData;
}

export interface AIInsight {
  summary: string;
  safetyRating: 'Aman' | 'Waspada' | 'Bahaya';
  recommendation: string;
}
