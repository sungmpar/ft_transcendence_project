import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import './assets/tailwind.css'
import axios from 'axios';
/* import the fontawesome core */
import { library } from '@fortawesome/fontawesome-svg-core'
/* import font awesome icon component */
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
/* import specific icons */
import {faHandshake, faUserLarge, faLock, faList, faVideoCamera, faHouse, faTableTennisPaddleBall, faComment, faUserGroup, faGear, faCircleNotch, faChevronDown, faChevronRight, faPlus, faSearch, faX, faKey, faSignOut } from '@fortawesome/free-solid-svg-icons'
/* add icons to the library */
library.add(faHandshake, faUserLarge, faLock, faList, faVideoCamera, faHouse, faTableTennisPaddleBall, faComment, faUserGroup, faGear, faCircleNotch, faChevronDown, faChevronRight, faPlus, faSearch, faX, faKey, faSignOut )
const backendBaseUrl = process.env.VUE_APP_BACKEND_URL || window.location.origin
axios.defaults.baseURL = backendBaseUrl

axios.defaults.headers.common['Authorization'] = 'Bearer ' + localStorage.getItem('token');

createApp(App)
.component('font-awesome-icon', FontAwesomeIcon)
.use(store)
.use(router)
.mount('#app')
