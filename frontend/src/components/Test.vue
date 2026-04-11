<script setup>
import caroussel_1 from '@/assets/images/caroussel-1.jpg'
import caroussel_2 from '@/assets/images/carousel-2.jfif'
import caroussel_3 from '@/assets/images/carousel-3.avif'

const carouselImages = [caroussel_1, caroussel_2, caroussel_3];

</script>




<template>

    <div class="carousel carousel-center bg-neutral rounded-box max-w-md space-x-4 p-4">
        <div class="carousel-item" v-for="(image, index) in carouselImages" :key="index">
            <img
            :src="image"
             alt="Carousel Image"
             class="rounded-box" />
        </div>
    </div>

</template>