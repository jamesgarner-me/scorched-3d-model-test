/**
 * `prettier-plugin-tailwindcss` sorts class lists in Tailwind's canonical
 * order, so class ordering is never something to review by hand.
 *
 * @type {import('prettier').Config}
 */
const config = {
  semi: false,
  singleQuote: true,
  printWidth: 100,
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindStylesheet: './src/app/globals.css',
  tailwindFunctions: ['cn', 'cva'],
}

export default config
