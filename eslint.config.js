import js from "@eslint/js";
import globals from "globals";
import prettierConfig from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default [
    // 忽略不需要检查的目录
    {
        ignores: ["node_modules", "dist"],
    },
    // TypeScript 文件配置
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts"],

        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },

        rules: {
            ...js.configs.recommended.rules,
            ...prettierConfig.rules,
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-explicit-any": "off",
            "no-console": "off",
        },
    },
];
