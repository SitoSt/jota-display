// src/router.js
import { createRouter, createWebHistory } from 'vue-router'
import MainView from './views/MainView.vue'
import WidgetsView from './views/WidgetsView.vue'
import ConfigView from './views/ConfigView.vue'
import EntityBrowser from './components/EntityBrowser.vue'

export const ROUTE_ORDER = ['/config', '/', '/widgets']

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',                component: MainView },
    { path: '/widgets',         component: WidgetsView },
    { path: '/config',          component: ConfigView },
    { path: '/widgets/browser', component: EntityBrowser },
  ],
})
