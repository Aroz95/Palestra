import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base relativo: funziona su GitHub Pages sia come sito utente sia come sito di progetto
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
