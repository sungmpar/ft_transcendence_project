<template>
  <div class="bg-gray-800 absolute top-0 right-0 bottom-0 left-0">
  <div>

<template v-if="this.$store.getters.usernickname">
	<div class="flex flex-col rounded-lg bg-gradient-to-r from-purple-400 via-violet-600  to-purple-700 animate-gradient-x px-8 pt-6 pb-8 mb-4">

  <div class="flex flex-col">

  <table class="table-fixed text-center divide-y divide-gray-200 dark:divide-gray-700" >
  <thead class="">

    <tr>
      <th class="pb-3 font-bold text-xl w-2/12">Avatar</th>
      <th class="pb-3 font-bold text-xl w-2/12">Nickname</th>
    </tr>
  </thead>

  <tbody class="text-center items-center divide-y divide-gray-300">
    <tr>
      <td class="pt-5">
        <template v-if="image">
          <img :src="get_upload_img_url()" class="object-contain w-20 mx-auto"/>
        </template>

        <template v-else>
          <img :src="get_avatar(this.$store.getters.userid)" class="object-contain w-20 mx-auto"/>
        </template>
      </td>
      <td class= "text-white text-xl font-bold pt-4">{{ this.$store.getters.usernickname }}</td>
    </tr>
  </tbody>
  </table>
  </div>
</div>
</template>

<div class="w-full">
<form class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">

  <div class="mb-4">
    <label class="block text-gray-700 text-sm font-bold mb-2" for="username">
          Set Your Nickname (Max 10 characters)
      </label>
    <input maxlength="10" class="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="username" type="text" placeholder="Choose a unique name" input:value="input_text" @input='input_words' v-on:keydown.enter.prevent='nickname_patch' autocomplete='off'>
  </div>

  <div class="flex items-center justify-between">
    <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" type="button" @click="nickname_patch">
      Choose
    </button>
  </div>

  <div v-show="true" class="flex justify-center" style="position: absolute; right: 0px; bottom: 0px;">
      <button class="gray-button" type="button" @click="logout">
        Logout
      </button>
    </div>

</form>
</div>

<div class="w-full">
<form class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">

<form method="post" enctype="multipart/form-data">
      <div>
        <label for="chooseFile" class="block text-gray-700 text-sm font-bold mb-2">
          Upload File (if you don't unpload a file, the default file will be used)
        </label>
      </div>
    <input ref="image" @change="uploadImg()" type="file" id="chooseFile" name="chooseFile" accept="image/jpg, image/jpeg, image/png">
    </form>
      <img :src="image" alt="" class="object-contain h-48 w-48" @error="defaultImage">
</form>
</div>
</div>
<template v-if="this.$store.getters.usernickname">
<div class="flex justify-center">
    <button class="normal-button" type="button" @click="goTomain">
      Go to Main
    </button>
</div>
</template>
</div>
</template>

<script lang="ts">
import axios from 'axios';

import { defineComponent } from "vue";

import store from '../store';

const backendBaseUrl = process.env.VUE_APP_BACKEND_URL || window.location.origin

export default defineComponent({
  methods: {
    defaultImage(event :Event) {
      (event.target as HTMLInputElement).src = require('../assets/white_box.png');
    },

    async goTomain(){
      document.location = `${window.location.origin}/`;
    },

    input_words: function(event:Event) {
      this.input_text = (event.target as HTMLInputElement).value;
    },

    async nickname_patch() {

    await axios.patch('/user/nickname', { nickname: this.input_text })
    .then((response) => {
      console.log(response);
    })
    .catch((error) => {
    if(error.response.status == 400 && error.response.data.message == '닉네임은 10글자를 초과할수 없습니다.') {
      alert('닉네임은 10글자를 초과할수 없습니다.');
    }
    else if(error.response.status == 400 && error.response.data.message == '이미 등록한 닉네임입니다.')
    {
      alert('이미 등록한 닉네임입니다.');
    }
    else if(error.response.status == 400 && error.response.data.message == '닉네임은 2글자 미만일수 없습니다.')
    {
      alert('닉네임은 2글자 미만일수 없습니다.');
    }
    else if(error.response.status == 400 && error.response.data.message == '닉네임은 공백을 포함할수 없습니다.')
    {
      alert('닉네임은 공백을 포함할수 없습니다.');
    }
    else if(error.response.status == 400 && error.response.data.message == '닉네임은 특수문자를 포함할수 없습니다.')
    {
      alert('닉네임은 특수문자를 포함할수 없습니다.');
    }
    });

    await axios.get('/user/me')
    .then(res => { store.commit('setUser', res.data);})
    .catch(error => {console.log(error);});
    },

    async uploadImg() {
      const formData = new FormData();
      var imgFile = this.$refs.image as HTMLInputElement;

      if(imgFile.files !== null)
      {

        if (imgFile.files[0].type !== "image/jpg" && imgFile.files[0].type !== "image/png" && imgFile.files[0].type !== "image/jpeg")
        {
          alert('choose another image type');
        }
        else if (imgFile.files[0].size > 1024 * 1024 * 2)
        {
          alert('choose another image less than 2MB');
        }
        else
        {
          var image = imgFile.files[0];
          const url = URL.createObjectURL(image)
          this.image = url
          formData.append('file', imgFile.files[0]);

          await axios.post('/user/upload', formData)
          .then(res => { console.log(res); })
          .catch(error => { console.log(error); });
        }
      }
    },
    async logout() {
    await axios.get('/auth/logout')
    .then((response) => {
      console.log(response);
    })
    .catch((error) => {
      console.log(error);
    });
    localStorage.removeItem("token");
    this.$router.push("/login");
    },

		get_avatar(id: number) {
			return (`${backendBaseUrl}/user/image/`+ id);
		},
    my_name()
    {
      return store.getters.usernickname;
    },
    get_upload_img_url()
    {
      return this.image;
    },
  },

  data() {
    return {
      input_text: '',
      image : '',
      file : '',
    }
  },
})
</script>
