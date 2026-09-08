<template>
  <div class="security-page bg-gray-800">
    <div class=" rounded-lg bg-gradient-to-r from-blue-400 via-amber-200  to-sky-400 animate-gradient-x px-2 pt-2 pb-2 mb-2" v-if="this.$store.getters.userneed2fa == true || this.$store.getters.userid == 0 || this.$store.getters.userneed2fa == undefined">

      <div class="flex justify-center text-2xl" v-show="this.$store.getters.useris2fa == true">
          <p class="drop-shadow-lg font-extrabold text-black-700 ">You can turn&nbsp;</p>
          <p class="drop-shadow-lg font-black font-mono text-blue-700">[on]</p>
          <p class="drop-shadow-lg font-extrabold text-black-700">&nbsp;or&nbsp;</p>
          <p class="drop-shadow-lg font-black font-mono text-red-600">[off]</p>
          <p class="drop-shadow-lg font-extrabold text-black-700">&nbsp;2FA</p>
      </div>

      <div class="flex justify-center text-3xl" v-show="this.$store.getters.userneed2fa == true || this.$store.getters.userid == 0 || this.$store.getters.userneed2fa == undefined">
          <p class="animate-pulse-custom drop-shadow-lg font-black font-mono text-blue-700">[2FA turned on]</p>
      </div>

      <div class="flex justify-center text-3xl" v-show="this.$store.getters.userneed2fa == false && this.$store.getters.userid != 0">
          <p class="font-black font-roboto text-red-600/90">[2fa turned off]</p>
      </div>
    </div>
    <div class=" rounded-lg bg-gradient-to-r from-pink-400 via-pink-100 to-pink-200 animate-gradient-xy px-2 pt-2 pb-2 mb-2" v-else>

  <div class="flex justify-center text-2xl" v-show="this.$store.getters.useris2fa == true">
      <p class="drop-shadow-lg font-extrabold text-purple-800 ">You can turn&nbsp;</p>
      <p class="drop-shadow-lg font-black font-mono text-blue-700">[on]</p>
      <p class="drop-shadow-lg font-extrabold text-purple-800">&nbsp;or&nbsp;</p>
      <p class="drop-shadow-lg font-black font-mono text-red-600">[off]</p>
      <p class="drop-shadow-lg font-extrabold text-purple-800">&nbsp;2FA</p>
  </div>

  <div class="flex justify-center text-3xl" v-show="this.$store.getters.userneed2fa == true || this.$store.getters.userid == 0 || this.$store.getters.userneed2fa == undefined">

      <p class="animate-pulse-custom drop-shadow-lg font-black font-mono text-blue-700">[2FA turned on]</p>

  </div>

  <div class="flex justify-center text-3xl" v-show="this.$store.getters.userneed2fa == false && this.$store.getters.userid != 0">

      <p class="font-bold font-sans text-red-600/90">[2FA turned off]</p>

  </div>

    </div>

    <div class="flex justify-center" v-show="this.$store.getters.userneed2fa == false && this.$store.getters.usernickname != ''">
          <button class="sky-button bg-sky-500/100" type="button" @click="need_tfa_true">
            Turn on 2FA
          </button>
      </div>

      <div class="flex justify-center" v-show="this.$store.getters.userneed2fa == true && this.$store.getters.useris2fa == true">
          <button class="red-button" type="button" @click="need_tfa_false">
            Turn off 2FA
          </button>
      </div>
    <div v-show="(this.$store.getters.userneed2fa == true && this.$store.getters.userid == 0) || this.$store.getters.userneed2fa == undefined || this.$store.getters.usernickname == ''">
    <form class="bg-zinc-300 rounded-lg px-2 pt-2 pb-2 mb-2">
      <div class="flex justify-center">

        <button class="normal-button transition duration-150 ease-in-out focus:outline-none focus:ring-4 ring-offset-1 ring-yellow-500" type="button" @click="send_code">
          Send 2FA code to my intra Email
        </button>
      </div>

      <input class="text-sm text-gray-base w-full mr-3 py-5 px-4 h-2 border border-gray-200 rounded mb-2" id="username" type="text" placeholder=" example@student.42seoul.kr" input:value="input_text" @input='ft_input_id' v-on:keydown.enter.prevent autocomplete='off'>

      <input class="text-sm text-gray-base w-full mr-3 py-5 px-4 h-2 border border-gray-200 rounded mb-2" id="username" type="text" placeholder="type six digits code" input:value="input_text" @input='ft_input_code' v-on:keydown.enter.prevent autocomplete='off'>

      <div class="flex justify-center" v-show="input_id && input_code.length == 6">
          <button class="normal-button" type="button" @click="is_tfa">
            Verify
          </button>
      </div>
    </form>
    </div>
      <div v-show="this.$store.getters.usernickname" class="flex justify-center">
      <button class="normal-button" type="button" @click="goTomain">
        Go to Main
      </button>
      </div>

      <div v-show="true" class="security-exit flex justify-center">
        <button class="gray-button" type="button" @click="logout">
          Logout
        </button>
      </div>
  </div>
  </template>

  <script lang="ts">
    import axios from 'axios';
import { logoutSession } from '@/arcade/auth-session';
import { readLoginIntent } from '@/arcade/login-intent';

    import { defineComponent } from "vue";

    import store from '../store';

    export default defineComponent({
      methods: {

      ft_input_id: function(event:Event) {
      this.input_id = (event.target as HTMLInputElement).value;
      },
      ft_input_code: function(event:Event) {
      this.input_code = (event.target as HTMLInputElement).value;
      },

      async goTomain(){
        await this.$router.push('/');
      },

      async send_code() {
        await axios.get('/auth/email')
        .then((response) => {
          console.log(response);
        })
        .catch((error) => {
          console.log(error);
        });
        await axios.get('/user/me')
        .then(res => { store.commit('setUser', res.data);})
        .catch((error) => {
          console.log(error);
        });
      },
      async is_tfa() {
        await axios.get('/auth/email/verify', { params: {email : this.input_id, code: this.input_code }} )
        .then(res => { store.commit('setUser', res.data);})
        .catch(error => {console.log(error);});

        await axios.get('/user/me')
        .then(res => { store.commit('setUser', res.data); if (readLoginIntent()) this.$router.replace('/'); })
        .catch(error => {
        if(error.response.status == 401)
        {
          this.$router.push('/login');
        }
        else if(error.response.status == 403)
        {
          store.commit('setUser', {id: 0, need2fa: true, is2fa: false});
          alert('wrong email or code');
        }
        });
      },

      async need_tfa_true() {
        await axios.patch('user/need2fa', { value: true })
        .then((response) => {
          console.log(response);
        })
        .catch((error) => {
          console.log(error);
        });

        await axios.get('/user/me')
        .then(res => { store.commit('setUser', res.data);})
        .catch(error => {
        if(error.response.status == 401)
        {
          this.$router.push('/login');
        }
        else if(error.response.status == 403)
        {
          store.commit('setUser', {id: 0, need2fa: true, is2fa: false});
          console.log(error);
        }
        });
      },

      async need_tfa_false() {
        await axios.patch('user/need2fa', { value: false })
        .then((response) => {
          console.log(response);
        })
        .catch((error) => {
          console.log(error);
        });
        await axios.get('/user/me')
        .then(res => { store.commit('setUser', res.data);})
        .catch(error => {console.log(error);});
      },

      async logout() {
      const { serverConfirmed } = await logoutSession();
      this.$router.replace(serverConfirmed ? '/login' : '/login?logout=unconfirmed');
      },

    },
      data() {
        return {
          input_id: "",
          input_code: "",
        }
      },
    })
  </script>

<style scoped>
.security-page { min-width: 0; min-height: 100vh; display: flex; flex-direction: column; padding-bottom: 24px; }
.security-page .flex { flex-wrap: wrap; }
.security-page button { max-width: 100%; white-space: normal; }
.security-exit { margin-top: auto; padding-top: 24px; }
</style>
