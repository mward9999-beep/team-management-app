# Team App MVP

Cross-platform mobile starter app built with Expo React Native, TypeScript, and Expo Router.

## What is included

- One codebase for iPhone and Android
- Expo Router navigation in `src/app`
- Home, Schedule, Roster, and Messages tabs
- Reusable UI components in `src/components`
- Mock team data in `src/data`
- Starter service files for future auth, database, API, and push notification work
- Blue, red, and white sports/team-management theme

## Run the app

Install dependencies:

```sh
npm install
```

Start Expo:

```sh
npm start
```

Then press `i` for iPhone Simulator, `a` for Android Emulator, or scan the QR code with Expo Go.

## Folder structure

```txt
src/
  app/             Expo Router screens and tab navigation
  components/      Reusable UI pieces
  constants/       Theme values
  data/            Mock team data
  hooks/           Shared app hooks
  services/        Future auth, API, database, and notification adapters
  types/           Shared TypeScript models
  utils/           Small reusable helpers
```
