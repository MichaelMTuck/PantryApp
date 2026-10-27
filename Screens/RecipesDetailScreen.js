// Displays detailed information about a specific recipe
import { ScrollView, Text, StyleSheet } from "react-native";
import { RECIPES } from "../data/recipes";

export default function RecipeDetails({ route }){
    const { recipeId } = route.params; // This infomration is given from the navigation in the recipe screen
    const recipe = RECIPES.find((r) => r.id === recipeId) // How we find our proper recipe

    if(!recipe) return <Text>Error: Recipe not found</Text> // Safe gaurd

    return(
        // Our one parrent element 
        <ScrollView contentContainerStyle={styles.container}> 
            <Text style={styles.title}>{recipe.name}</Text>
            <Text style={styles.time}>{recipe.time}</Text>

            <Text style={styles.heading}>Ingredients</Text>
            {recipe.ingredients.map((ingr => (
                // We can use each ingrediant as it's own key in the list
                <Text key={ingr}>*{ingr}</Text>
            )))}

            <Text style={styles.heading}>Steps</Text>
            {recipe.steps.map((step, i) =>
                // Our itterator, i for the steps and "step" for the actual text
                // First pos is the actual item, second is always the itterator
                <Text key={i} style={styles.line}>{i+1}. {step}</Text>
            )}
        </ScrollView>

    );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 24 },
  time: {  marginBottom: 16 },
  heading: { fontSize: 18, marginTop: 16, marginBottom: 6 },
  line: { fontSize: 15, marginBottom: 4 },
});