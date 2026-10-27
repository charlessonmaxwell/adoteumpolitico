import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "data", "site/dist", "bmad"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
