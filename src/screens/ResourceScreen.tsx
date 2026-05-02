import React, { useState, useEffect, useRef } from "react";
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
  const mapRef = useRef<MapView>(null);
  const flatListRef = useRef<FlatList>(null); // Added for list focus
  const markerRefs = useRef<{ [key: string]: any }>({}); // For opening bubbles

  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    CATEGORIES[0],
  );
  const [activeResourceId, setActiveResourceId] = useState<string | null>(null);

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

  // Unified function to handle selection from Map OR List
  const focusOnLocation = (item: Resource, fromMap: boolean = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveResourceId(item.id);

    // 1. Move the Map
    mapRef.current?.animateToRegion(
      {
        latitude: item.latitude,
        longitude: item.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      800,
    );

    // 2. Open Info Bubble
    setTimeout(() => {
      markerRefs.current[item.id]?.showCallout();
    }, 900);

    // 3. Scroll List to card (if tapped from Map)
    if (fromMap) {
      const index = resources.findIndex((r) => r.id === item.id);
      if (index !== -1) {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5, // Centers the selected card
        });
      }
    }
  };

  const handleCategorySelect = (category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(category);
    setActiveResourceId(null);
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
    <Pressable
      onPress={() => focusOnLocation(item)}
      style={[styles.card, activeResourceId === item.id && styles.activeCard]}
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
          onPress={() => navigation.goBack()}
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
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            }}
            showsUserLocation={true}
          >
            {resources.map((resource) => {
              const isActive = activeResourceId === resource.id;

              return (
                <Marker
                  // 🟢 Use a stable key now; the custom View handles re-renders better than pinColor
                  key={resource.id}
                  ref={(el) => {
                    markerRefs.current[resource.id] = el;
                  }}
                  coordinate={{
                    latitude: resource.latitude,
                    longitude: resource.longitude,
                  }}
                  onPress={() => focusOnLocation(resource, true)}
                  // 🟢 Optimization: Prevents flickering on iOS
                  tracksViewChanges={Platform.OS === "ios" ? false : true}
                >
                  {/* 🟢 CUSTOM PIN COMPONENT */}
                  <View
                    style={[
                      styles.customPin,
                      { backgroundColor: isActive ? "#FF9F43" : "#55E6C1" },
                    ]}
                  >
                    <View style={styles.pinInnerCore} />
                  </View>

                  <Callout tooltip>
                    <View style={styles.calloutBox}>
                      <Text style={styles.calloutTitle}>{resource.name}</Text>
                      <Text style={styles.calloutDesc}>{resource.address}</Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })}
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
            ref={flatListRef}
            data={resources}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            onScrollToIndexFailed={(info) => {
              // Safety fallback for list scrolling
              flatListRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true,
              });
            }}
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

// ... keep your existing styles block
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
  title: { color: "white", fontSize: 26, fontWeight: "bold", marginBottom: 20 },
  card: {
    backgroundColor: "#34495e",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 5,
    borderWidth: 2,
    borderColor: "transparent",
  },
  activeCard: { borderColor: "#55E6C1" },
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
  customPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "white",
    justifyContent: "center",
    alignItems: "center",
    // Shadow for depth on iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5, // Shadow for Android
  },
  pinInnerCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "white",
  },
});

export default ResourceScreen;
