import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import Home from "./Screens/HomeScreen";
import Pantry from "./Screens/PantryScreen";
import Recipes from "./Screens/RecipesScreen";
import AuthGate from "./AuthGate";

const Tab = createBottomTabNavigator();

// Icons we will replace with Ellie's
const icons = { Home: "home", Pantry: "basket", Recipes: "restaurant" };

export default function App() {
  return (
    <AuthGate>
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
          <Tab.Screen name="Recipes" component={Recipes} />
        </Tab.Navigator>
      </NavigationContainer>
    </AuthGate>
  );
}