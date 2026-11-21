# Pantry App

Our team implemented a mobile app for tracking the food in your kitchen. Users can share a pantry with their household, get alerts for food that is expiring or running low, find recipes that use up items they have, and keep a shared shopping list.

---

## Setup
Make sure you install the following before running the app.

### 1. Tailscale

The app's database runs on a private server that can only be reached through Tailscale.

1. Download and install Tailscale: https://tailscale.com/download
2. If you're planning to run the app on your iPhone also install Tailscale from the App Store on your phone.
3. Ask Michael for the project server link. Sign in to Tailscale, then open the link to accept access to the server.

### 2. Node.js

Install Node.js **22.13 or newer**: https://nodejs.org

### 3. Xcode

Install Xcode from the Mac App Store if you want to run the app on an iOS simulator.

### 4. Install the project

From the project folder do:

```bash
npm install
```

This downloads all the project's packages automatically:

`expo`, `react`, `react-dom`, `react-native`, `react-native-web`, `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`, `react-native-screens`, `react-native-safe-area-context`, `@react-native-community/datetimepicker`, `expo-secure-store`, `expo-notifications`, `expo-device`, `expo-constants`, `@expo/vector-icons`, `expo-status-bar`

### 5. Start the app

```bash
npx expo start
```

- **iOS Simulator:** press `i` in the terminal.
- **iPhone:** install **Expo Go** from the App Store, make sure Tailscale is on for your phone, then scan the QR code with the Camera app.

---

## Features

**Accounts**
- Create an account or log in with an email and password
- Stay logged in between sessions

**Pantries**
- Create your own pantry or join someone else's with an invite code
- Share a pantry with other users so everyone sees the same items
- Switch between pantries from the Home screen

**Pantry items**
- Add items with a name, quantity, unit, purchase price, and expiration date (price and date are optional)
- Search your items and hide or show items that are out of stock
- Adjust quantities up or down or delete an item

**Recipes**
- Save your own recipes with ingredients, steps, time, and servings
- Cook a recipe to automatically subtract its ingredients from your pantry

**Home dashboard**
- Recipe suggestions that use ingredients about to expire
- Alerts for items that are expiring soon or low stock

---

## How to use the app

1. **Create an account or log in.** To register for the first time you can click **Need an account? Register**, enter a display name, email, and a password of at least 12 characters, and click **Create account**. Next time you use the app enter your email and password and click **Log in**. Click **Log out** at the top of the screen to sign out.
2. **Choose a pantry.** Click an existing pantry or create one by entering a name and clicking **Create pantry**, or paste an invite code and click **Join pantry**.
3. **Home tab.** Check recipe suggestions and alerts. Click **Change pantry** to switch pantries.
4. **Pantry tab.**
   - Type in the search box to find an item.
   - Click the green **+** button, fill in the form, and click **Add item**. Click **Cancel** to close the form without it saving.
   - Use the quantity controls on an item to add or remove stock.
5. **Shopping tab.** Enter a name, quantity, and unit, then click **Add to shopping list**. Click **Check off** once you have bought something, or **Remove** to delete it.
6. **Recipes tab.**
   - Click a recipe to see its ingredients, steps, and estimated cost.
   - Click **Cook recipe** to use up the ingredients from your pantry.
   - Click the green **+** button to add a recipe. Fill in the title, time, servings, ingredients, and steps, then click **Save recipe**.