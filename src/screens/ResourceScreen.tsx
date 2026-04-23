import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Linking,
  Dimensions,
  Platform,
} from "react-native";
// Added 'Callout' to the imports
import MapView, { Marker, PROVIDER_GOOGLE, Callout } from "react-native-maps";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Phone, Navigation, ArrowLeft } from "lucide-react-native";
import { localResources, Resource } from "../data/resources";

const { height } = Dimensions.get("window");

const ResourceScreen = () => {
  const navigation = useNavigation();
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        let currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
      }
    })();
  }, []);

  const openNavigation = (item: Resource) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const query = encodeURIComponent(`${item.name} ${item.address}`);

    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      // FIXED: Use the official Google Maps Search intent
      android: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });

    if (url) Linking.openURL(url);
  };

  const renderItem = ({ item }: { item: Resource }) => (
    <View style={styles.card}>
      <Text style={styles.resourceName}>{item.name}</Text>
      <Text style={styles.address}>{item.address}</Text>

      <View style={styles.actionRow}>
        <Pressable
          style={styles.callButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Linking.openURL(`tel:${item.phone}`);
          }}
        >
          <Phone color="white" size={20} />
          <Text style={styles.buttonText}>Call</Text>
        </Pressable>

        <Pressable style={styles.goButton} onPress={() => openNavigation(item)}>
          <Navigation color="#2D3436" size={20} />
          <Text style={[styles.buttonText, { color: "#2D3436" }]}>Go</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <ArrowLeft color="#55E6C1" size={28} />
        </Pressable>
        <Text style={styles.headerTitle}>Resources</Text>
      </View>
      <View style={styles.mapContainer}>
        {location && (
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={true}
          >
            {localResources.map((resource) => (
              <Marker
                key={resource.id}
                coordinate={{
                  latitude: resource.latitude,
                  longitude: resource.longitude,
                }}
                // CRITICAL FOR ANDROID: These props force the name/address over the coordinates
                title={resource.name}
                description={resource.address}
                pinColor={resource.type === "Crisis" ? "#D63031" : "#55E6C1"}
              >
                {/* Optional: The custom Callout provides the white bubble UI you saw earlier */}
                <Callout tooltip>
                  <View style={styles.calloutBox}>
                    <Text style={styles.calloutTitle}>{resource.name}</Text>
                    <Text style={styles.calloutDesc}>{resource.address}</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
        )}
      </View>

      <View style={styles.listSection}>
        <Text style={styles.title}>Nearby Help</Text>
        <FlatList
          data={localResources}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#2D3436" },
  mapContainer: { height: height * 0.35, width: "100%" },
  map: { ...StyleSheet.absoluteFillObject },

  // Custom Callout Styling
  calloutBox: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    width: 200,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  calloutTitle: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#2D3436",
    fontFamily: "Quicksand-Bold",
  },
  calloutDesc: {
    fontSize: 12,
    color: "#636e72",
    marginTop: 4,
    fontFamily: "Quicksand-Bold",
  },

  listSection: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  title: { color: "white", fontSize: 26, fontWeight: "bold", marginBottom: 20 },
  card: {
    backgroundColor: "#34495e",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 5,
  },
  resourceName: { color: "white", fontSize: 18, fontWeight: "bold" },
  address: {
    color: "#B2BEC3",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 20,
    fontFamily: "Quicksand-Regular",
  },
  actionRow: { flexDirection: "row", gap: 12 },
  callButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#4b6584",
    paddingVertical: 16,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  goButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#55E6C1",
    paddingVertical: 16,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40, // Adjusts for status bar
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: "#2D3436",
  },
  backButton: {
    marginRight: 15,
    padding: 5,
  },
  headerTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
});

export default ResourceScreen;
