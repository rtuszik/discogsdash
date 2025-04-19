import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Add custom rule configuration
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error", // Keep the rule enabled as an error
        {
          "argsIgnorePattern": "^_", // Ignore arguments starting with _
          "varsIgnorePattern": "^_", // Ignore variables starting with _
          "caughtErrorsIgnorePattern": "^_" // Ignore caught error variables starting with _
        }
      ]
    }
  }
];

export default eslintConfig;
