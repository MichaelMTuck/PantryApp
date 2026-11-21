import { useCallback, useState, useEffect } from "react";
import {
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";

import {
  View,
  Text,
  Button,
  FlatList,
  ScrollView,
  StyleSheet,
  Pressable
} from "react-native";

import RecipeCard from "../Components/RecipeCard";
import { useSession } from "../Services/session";
import { usePantry } from "../PantryGate";
import { getRecipes } from "../Services/recipeService";
import { COLORS } from "../data/theme";


export default function Recipes() {
  const navigation = useNavigation();
  const { token } = useSession();
  const { selectedPantry } = usePantry();

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Reload the recipes list when coming back from detail or add recipe screen
  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setError("");

      getRecipes(token, selectedPantry.id)
        .then((result) => {
          if (active) setRecipes(result);
        })
        .catch((err) => {
          if (active) setError(err.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [token, selectedPantry.id])
  );

  async function refreshRecipes() {
    setLoading(true);
    setError("");

    try {
      const result = await getRecipes(token, selectedPantry.id);
      setRecipes(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }


  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={recipes}
        keyExtractor={(item) => String(item.id)} // Unique id
        refreshing={loading}
        onRefresh={refreshRecipes}
        ListEmptyComponent={
          <Text>
            {loading ? "Loading recipes…" : "No saved recipes in this pantry."}
          </Text>
        }
        // This maps each item to the card component we defined
        renderItem={({ item }) => (
          <RecipeCard
            name={item.name}
            time={item.time}
            
            // Display details returned by the database API.
            onPress={() => navigation.navigate("RecipeDetails", {recipeId: item.id,})}
          />
        )}
      />

      <View style={styles.fabWrapper} pointerEvents="box-none"> 
        
        <Pressable
          // pointerEvents="box-none", it makes it so you can only touch it's children componenets
          onPress={() => navigation.navigate("RecipeAdd")}
          hitSlop={8}
          style={({ pressed }) => [
            styles.circleButton,
            pressed && styles.circleButtonPressed,
          ]}
        >
          <Text style={styles.plus}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: COLORS.background },
  title: { fontSize: 24, marginVertical: 12 },
  heading: { fontSize: 18, marginTop: 16, marginBottom: 6 },
  line: { fontSize: 15, marginBottom: 6 },
  error: { color: COLORS.red, marginBottom: 12 },
  // For moving our circle to the bottom
  fabWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: "center",
  },
  circleButton: {
    // Feel free to change this, it just needs to have it 
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.green,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: COLORS.background,
    // iOS shadow
    // Adds a shadow around the button
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    // Android shadow
    elevation: 8,
  },
  // Just makes it darker and slightly smaller
  circleButtonPressed: {
    backgroundColor: COLORS.greenDark,
    transform: [{ scale: 0.92 }],
  },
  plus: {
    color: COLORS.white,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "400",
  },
});