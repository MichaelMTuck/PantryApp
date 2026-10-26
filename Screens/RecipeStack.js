import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Recipes from "./RecipesScreen";
import RecipeDetails from "./RecipesDetailScreen";

const Stack = createNativeStackNavigator();

//
export default function RecipeStack(){
    return(
        <Stack.Navigator>
            <Stack.Screen name="RecipesList" component={Recipes} options={{ title: "Recipes" }} />
            <Stack.Screen name="RecipeDetails" component={RecipeDetails} options={{ title: "Recipe" }} />
        </Stack.Navigator>
    );
}