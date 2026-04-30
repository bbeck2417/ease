import React, { useState, useEffect, useRef } from "react"; // 1. Added useRef
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Linking,
  Dimensions,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Callout } from "react-native-maps";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Phone, Navigation, ArrowLeft } from "lucide-react-native";
import { fetchNearbyResources, Resource } from "../data/resources";

const { height } = Dimensions.get("window");

const CATEGORIES = [
  "Crisis Centers",
  "Emergency Shelters",
  "Food Pantries",
  "Warming Centers",
  "Cooling Centers",
  "Community Centers",
];

const ResourceScreen = () => {
  const navigation = useNavigation();
  const mapRef = useRef<MapView>(null); // 2. Created the Map Reference

  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    CATEGORIES[0],
  );
  const [activeResourceId, setActiveResourceId] = useState<string | null>(null); // 3. State to track the highlighted card

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        let currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
      }
    })();
  }, []);

  useEffect(() => {
    if (!location) return;
    const loadData = async () => {
      setIsLoading(true);
      const fetchedData = await fetchNearbyResources(
        location.coords.latitude,
        location.coords.longitude,
        selectedCategory,
      );
      setResources(fetchedData);
      setIsLoading(false);
    };
    loadData();
  }, [location, selectedCategory]);

  // 4. Function to move the map to a specific resource
  const focusOnLocation = (item: Resource) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveResourceId(item.id); // Highlight the card UI

    mapRef.current?.animateToRegion(
      {
        latitude: item.latitude,
        longitude: item.longitude,
        latitudeDelta: 0.01, // Zoom in closer when focusing
        longitudeDelta: 0.01,
      },
      1000,
    ); // 1000ms animation duration
  };

  const handleCategorySelect = (category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(category);
    setActiveResourceId(null); // Reset focus when switching categories
  };

  const openNavigation = (item: Resource) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const query = encodeURIComponent(`${item.name} ${item.address}`);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    if (url) Linking.openURL(url);
  };

  const renderItem = ({ item }: { item: Resource }) => (
    // 5. Wrap the whole card in a Pressable to trigger the focus
    <Pressable
      onPress={() => focusOnLocation(item)}
      style={[
        styles.card,
        activeResourceId === item.id && styles.activeCard, // Apply highlight style
      ]}
    >
      <Text style={styles.resourceName}>{item.name}</Text>
      <Text style={styles.address}>{item.address}</Text>

      <View style={styles.actionRow}>
        <Pressable
          style={[
            styles.callButton,
            item.phone === "No phone listed" && { opacity: 0.5 },
          ]}
          onPress={() => {
            if (item.phone !== "No phone listed") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Linking.openURL(`tel:${item.phone}`);
            }
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
    </Pressable>
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

      <View style={styles.categoryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((category) => (
            <Pressable
              key={category}
              style={[
                styles.categoryPill,
                selectedCategory === category && styles.categoryPillActive,
              ]}
              onPress={() => handleCategorySelect(category)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category && styles.categoryTextActive,
                ]}
              >
                {category}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.mapContainer}>
        {location ? (
          <MapView
            ref={mapRef} // 6. Attached the ref to the MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              // Changed from 'region' to 'initialRegion' so manual animations work smoothly
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            }}
            showsUserLocation={true}
          >
            {resources.map((resource) => (
              <Marker
                key={resource.id}
                coordinate={{
                  latitude: resource.latitude,
                  longitude: resource.longitude,
                }}
                title={resource.name}
                description={resource.address}
                pinColor={
                  activeResourceId === resource.id ? "#FF9F43" : "#55E6C1"
                } // Highlight marker if selected
              >
                <Callout tooltip>
                  <View style={styles.calloutBox}>
                    <Text style={styles.calloutTitle}>{resource.name}</Text>
                    <Text style={styles.calloutDesc}>{resource.address}</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
        ) : (
          <View style={[styles.map, styles.loadingCenter]}>
            <ActivityIndicator size="large" color="#55E6C1" />
          </View>
        )}
      </View>

      <View style={styles.listSection}>
        <Text style={styles.title}>{selectedCategory} Nearby</Text>
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color="#55E6C1"
            style={{ marginTop: 40 }}
          />
        ) : (
          <FlatList
            data={resources}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No {selectedCategory.toLowerCase()} found.
              </Text>
            }
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#2D3436" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: "#2D3436",
  },
  backButton: { marginRight: 15, padding: 5 },
  headerTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  categoryContainer: { backgroundColor: "#2D3436", paddingBottom: 15 },
  categoryScroll: { paddingHorizontal: 15, gap: 10 },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#34495e",
    borderWidth: 1,
    borderColor: "#4b6584",
  },
  categoryPillActive: { backgroundColor: "#55E6C1", borderColor: "#55E6C1" },
  categoryText: {
    color: "#B2BEC3",
    fontFamily: "Quicksand-Bold",
    fontSize: 14,
  },
  categoryTextActive: { color: "#2D3436" },
  mapContainer: { height: height * 0.35, width: "100%" },
  map: { ...StyleSheet.absoluteFillObject },
  loadingCenter: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#34495e",
  },
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
  title: { color: "white", fontSize: 22, fontWeight: "bold", marginBottom: 15 },
  card: {
    backgroundColor: "#34495e",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 5,
    borderWidth: 2,
    borderColor: "transparent",
  },
  activeCard: { borderColor: "#55E6C1" }, // Border color for highlighted item
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
  emptyText: {
    color: "#B2BEC3",
    textAlign: "center",
    fontFamily: "Quicksand-Regular",
    marginTop: 20,
  },
});

export default ResourceScreen;
