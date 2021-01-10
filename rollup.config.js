import { version } from './package.json';
import { terser } from 'rollup-plugin-terser';

export default {
    input: './build/serve.js',
    treeshake: false,
    output: {
        file: './dist/serve.js',
        format: 'iife',
        banner: `/* squared-express ${version}\n   https://github.com/anpham6/squared-express */`
    },
    plugins: [
        terser({ toplevel: true, format: { comments: true } })
    ]
}