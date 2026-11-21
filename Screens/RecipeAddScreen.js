import React, { useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import { useSession } from "../Services/session";
import { usePantry } from "../PantryGate";
import { addRecipe } from "../Services/recipeService";
import { COLORS } from "../data/theme";

// Screen for adding new recipes to the app
let nextStepId = 1;
let nextIngrId = 1;
const makeStep = () => ({ id: nextStepId++, text: "" });
const makeIngr = () => ({id: nextIngrId++, text: "" })

export default function RecipeAdd(){
    const navigation = useNavigation();
    const { token } = useSession();
    const { selectedPantry } = usePantry();

    // Hide header back arrow
    useLayoutEffect(() => {
        navigation.setOptions({
            headerBackVisible: false,
            headerLeft: () => null,
        });
    }, [navigation]);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    
    const [title, setTitle] = useState('');
    const [time, setTime] = useState('');
    const [ingredients, setIngredients] = useState(() => [makeIngr()]);
    const [servings, setServings] = useState('');

    const [steps, setSteps] = useState(() => [makeStep()]);

    const updateIngredients = (id, text) => {
        const clean = text.replace(/;/g, ",");
        setIngredients((prev) => prev.map((s) => (s.id === id ? { ...s, text: clean } : s)));
    };

    const updateStep = (id, text) => {
        // Strip ";" so it can't break the delimiter when we join the steps
        // Just an ensurance thing so we don't break it up in the sql code
        const clean = text.replace(/;/g, ",");
        // { ...s, text: clean } only returns when s.id === id is true
        setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, text: clean } : s)));
    };

    const addIngredient = () => {
        const ing = makeIngr();
        setIngredients((prev) => [...prev, ing]);
    };

    const addStep = () => {
        const step = makeStep();
        setSteps((prev) => [...prev, step]);
        // Focus after the new input has rendered, sloppy work around for rendering time
        // TODO: Find better work around for rendering steps
    };

    const removeIngredient = (id) => {
        setIngredients((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
    }

    const removeStep = (id) => {
        setSteps((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
    };

    // Resest form function
    const resetForm = () => {
        setTitle("");
        setTime("");
        setSteps([makeStep()]);
        setServings('');
        setIngredients([makeIngr()])
        setError("");
    };

    // Makes sure the form is filled out before trying to submit
    const validate = () => {
        if (!title.trim()) return "Give your recipe a title.";
        const minutes = Number(time);

        if (!time.trim() || !Number.isInteger(minutes) || minutes <= 0) {
        return "Enter the time in whole minutes, like 45.";
        }

        if (!steps.some((s) => s.text.trim())) return "Add at least one step.";
        if (!ingredients.some((s) => s.text.trim())) return "Add at least ingredient.";
        
        // Reject empty input for servings and 0
        const servingCount = Number(servings);
        if (
          !servings.trim() ||
          !Number.isFinite(servingCount) ||
          servingCount <= 0
        ) {
          return "Enter a number of servings greater than 0.";
        }

        return "";
    };

    // Submit function
    const handleSubmit = async () => {
        if(submitting) return; // Prevent duplicate calls

        // Check for error
        const prob = validate();
        if(prob) {
            setError(prob);
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            // Turn the steps from a list to a string for the server
            /* 
            {
                id: 12,
                name: "Pancakes",
                time: "20 min",
                servings: 4,
                ingredients: ["2 cups Flour", "1 cup Milk"],
                steps: ["Mix ingredients.", "Cook on a hot pan."]
                }
            */
            const recipe = {
              name: title.trim(),
              time: Number(time),
              servings: Number(servings),

              ingredients: ingredients
                .map((ingredient) => ingredient.text.trim())
                .filter(Boolean)
                .join(";"),

              steps: steps
                .map((step) => step.text.trim())
                .filter(Boolean)
                .join(";"),
            };

            await addRecipe(token, selectedPantry.id, recipe);

            resetForm();
            navigation.goBack();
            
        } catch (err) {
            setError(err.message || "Couldn't save the recipe. Try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return(
   <KeyboardAvoidingView
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.addHeader}>
          <Text style={styles.heading}>Add your recipe</Text>
          <Pressable
            onPress={() => navigation.goBack()}
            disabled={submitting}
            hitSlop={12} // Increase hit box
          >
            <Text style={styles.cancelButton}>Cancel</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Grandma's pecan pie"
          placeholderTextColor={COLORS.placeholder}
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
        />

        <Text style={styles.label}>Time (minutes)</Text>
        <TextInput
          style={styles.input}
          placeholder="45"
          placeholderTextColor={COLORS.placeholder}
          value={time}
          // Digits only, standard copy and paste code for clean up
          onChangeText={(v) => setTime(v.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad" // Makes it so it only shows the number pad, makes it easier
        />
        <Text style={styles.label}>Servings</Text>
        <TextInput
          style={styles.input}
          placeholder="4"
          placeholderTextColor={COLORS.placeholder}
          value={servings}
          // Digits only, standard copy and paste code for clean up
          onChangeText={(v) => setServings(v.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad" // Makes it so it only shows the number pad, makes it easier
        />


        <Text style={styles.label}>Ingredients</Text>
        {ingredients.map((ingredient, index) => (
            <View key={ingredient.id} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{index + 1}.</Text>

            <TextInput
              style={[styles.input, styles.stepInput]}
              placeholder="2 Cups of Flower"
              placeholderTextColor={COLORS.placeholder}
              value={ingredient.text}
              onChangeText={(v) => updateIngredients(ingredient.id, v)}
              multiline // Lets the text scroll down
            />
            {ingredients.length > 1 && ( // If the step is bigger than one, show a remove step button
              <Pressable
                onPress={() => removeIngredient(ingredient.id)}
                hitSlop={8} // Increase hit box
              >
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            )}
          </View>
        ))}

        <Pressable
          onPress={addIngredient}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Add Ingredient</Text>
        </Pressable>

        <Text style={styles.label}>Steps</Text>

        {steps.map((step, index) => (
          <View key={step.id} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{index + 1}.</Text>

            <TextInput
              style={[styles.input, styles.stepInput]}
              placeholder="Describe this step"
              placeholderTextColor={COLORS.placeholder}
              value={step.text}
              onChangeText={(v) => updateStep(step.id, v)}
              multiline // Lets the text scroll down
            />
            {steps.length > 1 && ( // If the step is bigger than one, show a remove step button
              <Pressable
              
                onPress={() => removeStep(step.id)}
                hitSlop={8} // Increase hit box
              >
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            )}
          </View>
        ))}

        <Pressable
          onPress={addStep}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Add step</Text>
        </Pressable>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          // If submititng is true, turn opacity down a bit
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            submitting && styles.disabled,
          ]}
        >
          {submitting ? ( // If submitting, show the spinning wheel, if not show the text
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Save recipe</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 20, paddingBottom: 48 },
  // Title on the left, Cancel on right
  addHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  heading: { fontSize: 24, fontWeight: "700", color: COLORS.greenDark },
  cancelButton: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.red,
    marginRight: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 6,
    color: COLORS.text,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.inputBg,
  },
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  stepNumber: { width: 24, paddingTop: 11, fontSize: 16, color: COLORS.textMuted },
  stepInput: { flex: 1, minHeight: 44 },
  remove: { paddingTop: 11, paddingLeft: 10, color: COLORS.red, fontSize: 14 },
  // Add ingredient, add step
  secondaryButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.blue,
    borderRadius: 8,
    marginTop: 4,
  },
  secondaryButtonPressed: { backgroundColor: COLORS.blueDark },
  secondaryButtonText: { color: COLORS.blueText, fontWeight: "600" },
  error: { color: COLORS.red, marginTop: 16 },
  // Save button
  primaryButton: {
    backgroundColor: COLORS.green,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  primaryButtonPressed: { backgroundColor: COLORS.greenDark },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
