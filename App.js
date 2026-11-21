import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import Home from "./Screens/HomeScreen";
import Pantry from "./Screens/PantryScreen";
import RecipeStack from "./Screens/RecipeStack";
import ShoppingListScreen from "./Screens/ShoppingListScreen";
import AuthGate from "./AuthGate";
import PantryGate from "./PantryGate";
import PushRegistrar from "./Components/PushRegistrar";

const Tab = createBottomTabNavigator();

// Icons we will replace with Ellie's
const icons = { Home: "home", Pantry: "basket", Recipes: "restaurant", Shopping: "cart" };

export default function App() {
  return (
    <AuthGate>
      <PushRegistrar />
      <PantryGate>
        {/* https://dev.to/fonyuygita/building-veli-a-complete-react-native-tab-navigation-tutorial-gnm */}
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
          <Tab.Screen name="Shopping" component={ShoppingListScreen} />
          <Tab.Screen
            name="Recipes"
            component={RecipeStack} //  Provide the entire Stack as the tab component
            options={{ headerShown: false }} // Hides the double header issue
          />
        </Tab.Navigator>
        </NavigationContainer>
      </PantryGate>
    </AuthGate>
  );
}