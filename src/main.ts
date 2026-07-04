import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { loadBranding } from '@/branding'
import { router } from '@/router'
import '@/assets/main.css'

// Branding applies before mount so the first paint already wears the
// deployer's colors; failures fall back to the stock brand instantly.
loadBranding().finally(() => {
  createApp(App).use(createPinia()).use(router).mount('#app')
})
