// The main dashboard screen for the app
import { ScrollView, Text, Button, View } from "react-native";

import { usePantry } from "../PantryGate";
import HouseholdPanel from "../Components/HouseholdPanel";
import PantryNotifications from "../Components/PantryNotifications";

import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useSession } from "../Services/session";
import { getRecommendedRecipes } from "../Services/recipeService";

export default function Home({ navigation }) {
  const { selectedPantry, changePantry } = usePantry();

  const { token } = useSession();
  const pantryId = selectedPantry.id;
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationStatus, setRecommendationStatus] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setRecommendations([]);
      setRecommendationStatus("Loading recommendations…");

      getRecommendedRecipes(token, pantryId)
        .then((rows) => {
          if (!active) return;
          setRecommendations(rows);
          setRecommendationStatus(
            rows.length ? "" : "No saved recipes match ingredients expiring soon."
          );
        })
        .catch((err) => {
          if (active) setRecommendationStatus(err.message);
        });

      return () => {
        active = false;
      };
    }, [token, pantryId])
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 24, marginBottom: 12 }}>My Home</Text>

      {/* Pantry switcher only on Home screen */}
      <View style={{ marginBottom: 16 }}>
        <Text>Pantry: {selectedPantry.name}</Text>
        <Button title="Change pantry" onPress={changePantry} />
      </View>

      <View style={{ marginBottom: 16 }}>
  <Text style={{ fontSize: 18 }}>Use up expiring ingredients</Text>

  {recommendationStatus ? <Text>{recommendationStatus}</Text> : null}

  {recommendations.map((recipe) => (
    <View key={recipe.id} style={{ marginTop: 8 }}>
      <Button
        title={recipe.name}
        onPress={() =>
          navigation.navigate("Recipes", {
            screen: "RecipeDetails",
            params: { recipeId: recipe.id },
          })
        }
      />
      <Text>
        Uses {recipe.ingredients.join(", ")} · earliest expiration: {recipe.earliest}
      </Text>
    </View>
  ))}
</View>


      {/* Low stock, expiration alerts. Key resets state when pantry changes */}
      <PantryNotifications
        key={`notifications-${selectedPantry.id}`}
        pantry={selectedPantry}
      />

      <HouseholdPanel
        key={`household-${selectedPantry.id}`}
        pantry={selectedPantry}
      />
    </ScrollView>
  );
}
