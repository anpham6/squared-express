import { terser } from 'rollup-plugin-terser';

export default {
    input: './build/serve.js',
    treeshake: false,
    output: {
        file: './dist/serve.js',
        format: 'iife'
    },
    plugins: [
        terser({ toplevel: true })
    ]
}