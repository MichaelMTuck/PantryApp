import { View, FlatList, StyleSheet } from "react-native";
import RecipeCard from "../Components/RecipeCard";
import { RECIPES } from "../data/recipes";

export default function Recipes({ navigation }){
  return(
    <View style={styles.container}>
      <FlatList
        data={RECIPES}
        keyExtractor={(item) => item.id} // Unique id
        // This maps each item to the card component we defined
        renderItem={({ item }) => (
          <RecipeCard
            name={item.name}
            time={item.time}
            // This pressable is how it navigates to the detail screen
            // It just sends the unique ID over in the route and then it renders it
            // Over on the details screen
            onPress={() => navigation.navigate("RecipeDetails", { recipeId: item.id })}
          />
        )}
      >
      </FlatList>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f5f5" },
});