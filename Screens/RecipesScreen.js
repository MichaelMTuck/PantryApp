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


export default function Recipes() {
  const navigation = useNavigation();
  const { token } = useSession();
  const { selectedPantry } = usePantry();

  const [recipes, setRecipes] = useState([]);;
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

  // Commented out the in line detail view for a selected recipe
  /* if (selectedRecipe) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Button
          title="Back to recipes"
          onPress={() => setSelectedRecipe(null)}
        />

        <Text style={styles.title}>{selectedRecipe.name}</Text>
        <Text>{selectedRecipe.time}</Text>
        <Text>Servings: {selectedRecipe.servings}</Text>

        {selectedRecipe.description ? (
          <Text>{selectedRecipe.description}</Text>
        ) : null}

        <Text style={styles.heading}>Ingredients</Text>

        {selectedRecipe.ingredients.map((ingredient, index) => (
          <Text key={index} style={styles.line}>
            • {ingredient}
          </Text>
        ))}

        <Text style={styles.heading}>Steps</Text>

        {selectedRecipe.steps.map((step, index) => (
          <Text key={index} style={styles.line}>
            {index + 1}. {step}
          </Text>
        ))}
      </ScrollView>
    );
  } */

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
  container: { flexGrow: 1, padding: 16, backgroundColor: "#f5f5f5" },
  title: { fontSize: 24, marginVertical: 12 },
  heading: { fontSize: 18, marginTop: 16, marginBottom: 6 },
  line: { fontSize: 15, marginBottom: 6 },
  error: { color: "#b00020", marginBottom: 12 },
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
    backgroundColor: "#2ecc71",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
    // iOS shadow
    // Adds a little hugh around the button, makes it look nice
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 6,
    // Android shadow
    elevation: 8,
  },
  // Just makes it darker and slightly smaller
  circleButtonPressed: {
    backgroundColor: "#27ae60",
    transform: [{ scale: 0.92 }],
  },
  plus: {
    color: "#fff",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "500",
  },
});