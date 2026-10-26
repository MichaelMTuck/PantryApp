import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import Home from "./Screens/HomeScreen";
import Pantry from "./Screens/PantryScreen";
import RecipesStack from "./Screens/RecipeStack";

const Tab = createBottomTabNavigator();

// Icons we will replace with Ellie's
const icons = { Home: "home", Pantry: "basket", Recipes: "restaurant" };

export default function App() {
  return (
    //https://dev.to/fonyuygita/building-veli-a-complete-react-native-tab-navigation-tutorial-gnm
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={icons[route.name]} size={size} color={color} />
          ),
          tabBarActiveTintColor: "#2e7d32",
        })}
      >
        <Tab.Screen name="Home" component={Home} />
        <Tab.Screen name="Pantry" component={Pantry} />
        <Tab.Screen
          name="Recipes"
          component={RecipesStack}
          options={{ headerShown: false }} // hides the app header, this is because of the way the stack navigator automaitcally draws headers with back buttons
          />
      </Tab.Navigator>
    </NavigationContainer>
  );
}