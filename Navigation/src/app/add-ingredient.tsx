import { View, Text, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function AddIngredientScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Ingredient</Text>

      <Button
        title="Go to Home"
        onPress={() => router.push('/')}
      />

      <Button
        title="Go to Pantry"
        onPress={() => router.push('/pantry')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
});
