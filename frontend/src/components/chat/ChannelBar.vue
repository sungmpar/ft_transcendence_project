<template>
<div class="channel-bar">
	<div className='channel-block'>
    <h5 className='channel-block-text'>42born2code</h5>
  </div>
	<hr class="channelbar-hr" />
	<div className='channel-container'>
    <ChannelDropdown :selections="store.getters.channels" />
  </div>
	<hr class="channelbar-hr" />
	<div className='channel-container'>
    <UserDropdown :selections="store.getters.users" />
  </div>
</div>
</template>

<script setup lang="ts">
import ChannelDropdown from "./ChannelDropdown.vue"
import UserDropdown from "./UserDropdown.vue"
import store from "@/store"

</script>

