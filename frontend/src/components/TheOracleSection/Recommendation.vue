<script setup>

import { ref } from "vue"



</script>

<template>

<div v-if="recommendations.length">

<div
v-for="item in recommendations"
:key="item.title"
>

<img :src="item.poster" />

<h3>{{ item.title }}</h3>

<p>{{ item.overview }}</p>

</div>

</div>

</template>