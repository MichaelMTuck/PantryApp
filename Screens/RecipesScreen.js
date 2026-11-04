import { useEffect, useState } from "react";
import {
  View,
  Text,
  Button,
  FlatList,
  ScrollView,
  StyleSheet,
} from "react-native";

import RecipeCard from "../Components/RecipeCard";
import { useSession } from "../Services/session";
import { usePantry } from "../PantryGate";
import { getRecipes } from "../Services/recipeService";

export default function Recipes() {
  const { token } = useSession();
  const { selectedPantry } = usePantry();

  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
  }, [token, selectedPantry.id]);

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

  if (selectedRecipe) {
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
            onPress={() => setSelectedRecipe(item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: "#f5f5f5" },
  title: { fontSize: 24, marginVertical: 12 },
  heading: { fontSize: 18, marginTop: 16, marginBottom: 6 },
  line: { fontSize: 15, marginBottom: 6 },
  error: { color: "#b00020", marginBottom: 12 },
});