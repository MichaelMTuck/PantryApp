// Displays detailed information about a specific recipe
import { useEffect, useState } from "react";
import {ActivityIndicator, Button, ScrollView, Text, StyleSheet, View,} from "react-native";

import { cookRecipe, getRecipe } from "../Services/recipeService";
import { useSession } from "../Services/session";
import { usePantry } from "../PantryGate";



export default function RecipeDetails({ route }){
    const { recipeId } = route.params; // This infomration is given from the navigation in the recipe screen
    
    const { token } = useSession();
    const { selectedPantry } = usePantry();

    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const [cooking, setCooking] = useState(false);
    const [cookMessage, setCookMessage] = useState("");

useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");
    setRecipe(null);

    getRecipe(token, selectedPantry.id, recipeId)
      .then((result) => {
        if (active) setRecipe(result);
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
  }, [token, selectedPantry.id, recipeId, retry]);

    async function handleCook() {
        setCooking(true);
        setCookMessage("");

        try {
            const result = await cookRecipe(
            token,
            selectedPantry.id,
            recipeId
            );

            setCookMessage(result.message);
        } catch (err) {
            setCookMessage(err.message);
        } finally {
            setCooking(false);
        }
    }
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading recipe…</Text>
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {error || "Recipe not found."}
        </Text>

        <Button
          title="Try again"
          onPress={() => setRetry((current) => current + 1)}
        />
      </View>
    );
  }

  return (
    // The parent element
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{recipe.name}</Text>
      <Text style={styles.time}>{recipe.time}</Text>
      <Text>Servings: {recipe.servings}</Text>

      {recipe.description ? (
        <Text style={styles.line}>{recipe.description}</Text>
      ) : null}

      <Text style={styles.heading}>Ingredients</Text>

      {recipe.ingredients.map((ingredient, index) => (
        <Text key={index} style={styles.line}>
          • {ingredient}
        </Text>
      ))}

      <Text style={styles.heading}>Steps</Text>

      {recipe.steps.map((step, index) => (
        
        // The index gives each step its displayed number.
        <Text key={index} style={styles.line}>
          {index + 1}. {step}
        </Text>
      ))}

      <View style={{ marginTop: 20 }}>
        <Button
            title={cooking ? "Cooking…" : "Cook recipe"}
            onPress={handleCook}
            disabled={cooking}
        />

        {cookMessage ? (
            <Text style={{ marginTop: 10 }}>{cookMessage}</Text>
        ) : null}
        </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  title: { fontSize: 24 },
  time: {  marginBottom: 16 },
  heading: { fontSize: 18, marginTop: 16, marginBottom: 6 },
  line: { fontSize: 15, marginBottom: 4 },
  error: { color: "red", fontSize: 16 },
});