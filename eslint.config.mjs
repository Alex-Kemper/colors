import js from "@eslint/js";
import globals from "globals";

export default [
  // md5.js is the third-party blueimp library, not our code
  { ignores: ["public/js/md5.js"] },
  js.configs.recommended,
  {
    files: ["public/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: {
        ...globals.browser,
        md5: "readonly",
      },
    },
    rules: {
      // Top-level functions are called from onclick handlers in the HTML
      "no-unused-vars": ["error", { vars: "local" }],
      eqeqeq: "error",
      "no-var": "error",
      "prefer-const": "error",
    },
  },
];
