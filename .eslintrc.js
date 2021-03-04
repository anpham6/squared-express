module.exports = {
    "env": {
        "commonjs": true,
        "node": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "../squared/config/.eslint-shared"
    ],
    "ignorePatterns": [],
    "rules": {
        "no-console": "off",
        "no-inner-declarations": "off",
        "@typescript-eslint/ban-types": "off",
        "@typescript-eslint/no-misused-promises": "off",
        "@typescript-eslint/no-unnecessary-type-arguments": "off",
        "@typescript-eslint/no-var-requires": "off"
    }
};