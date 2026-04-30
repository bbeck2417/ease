export interface Resource {
  id: string; // Changed to string for Google Place IDs
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: string;
  phone: string;
}

// ⚠️ Insert your Google Places API Key here (from Google Cloud Console)
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export const fetchNearbyResources = async (
  latitude: number,
  longitude: number,
  searchQuery: string,
): Promise<Resource[]> => {
  const url = "https://places.googleapis.com/v1/places:searchText";

  const requestBody = {
    textQuery: searchQuery,
    maxResultCount: 20, // Max number of results to show
    locationBias: {
      circle: {
        center: { latitude, longitude },
        radius: 10000.0, // 10km radius
      },
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        // The FieldMask tells Google EXACTLY what data to return so you don't get overcharged
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // 1. Grab the actual error payload from Google
      const errorData = await response.json();
      // 2. Log the detailed error message
      console.error(
        "Google API Error Details:",
        JSON.stringify(errorData, null, 2),
      );
      return [];
    }

    const data = await response.json();

    if (!data.places) return [];

    // Map Google's raw data directly to your existing Resource interface
    return data.places.map((place: any) => ({
      id: place.id,
      name: place.displayName?.text || "Unknown Location",
      address: place.formattedAddress || "No address provided",
      latitude: place.location?.latitude || 0,
      longitude: place.location?.longitude || 0,
      type: searchQuery, // You can customize this based on the category searched
      phone: place.nationalPhoneNumber || "No phone listed",
    }));
  } catch (error) {
    console.error("Failed to fetch resources:", error);
    return [];
  }
};
