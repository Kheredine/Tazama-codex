<script setup> 
import Carousel from './Carousel.vue';
import CarouselComponent from './CarouselComponent.vue';
import SiteInfoOrUserGreetings from './SiteInfoOrUserGreetings.vue';
</script>

<template>
        <!-- glow layers -->
        
        <!-- TOP GLOW -->
        <!-- <div class="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-purple-500/30 to-transparent blur-2xl"></div> -->

        <!-- BOTTOM GLOW -->
        <!-- <div class="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-purple-500/30 to-transparent blur-2xl"></div> -->

        <section class="hero_section flex h-120">
            
            <SiteInfoOrUserGreetings />

            <CarouselComponent />

        </section>

        <section class="main">
            
        </section>
</template>

<style></style>