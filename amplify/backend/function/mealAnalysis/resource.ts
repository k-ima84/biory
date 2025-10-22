import { defineFunction } from "@aws-amplify/backend";

export const mealAnalysisFunctionHandler = defineFunction({
  name: "mealAnalysis",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  memoryMB: 512
});