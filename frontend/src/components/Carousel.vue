<script setup>
import caroussel_1 from '@/assets/images/caroussel-1.jpg'
import caroussel_2 from '@/assets/images/carousel-2.jfif'
import caroussel_3 from '@/assets/images/carousel-3.avif'

import { computed, reactive } from 'vue';

const carouselItems = reactive([
    {
        title: "How to train your dragon",
        info: ["1h 56min", "Action", "Movie", "2025", "6+"],
        trailerDuration: "2:30",
        trailerUrl: caroussel_1,
        display: true,
        left: 0,
        top: 0,
        z_index: 3,
        height: 500,
    },
    {
        title: "Inception",
        info: ["2h 10min", "Sci-Fi", "Movie", "2024", "PG"],
        trailerDuration: "3:00",
        trailerUrl: caroussel_2,
        display: true,
        left: 90,
        top: 26,
        z_index: 2,
        height: 460,
    },
    {
        title: "Demon Slayer",
        info: ["1h 45min", "Action", "Movie", "2023", "13+"],
        trailerDuration: "2:45",
        trailerUrl: caroussel_3,
        display: true,
        left: 180,
        top: 52,
        z_index: 1,
        height: 420,
    }
]);

const displayedCarouselItems = computed(() => carouselItems.filter(item => item.display));
</script>

<template>
    <div class="carousels relative w-[900px] h-[500px]">

        <div class="carousel-card" :style="{backgroundImage: `url(${carouselItem.trailerUrl})`, left: `${carouselItem.left}px`, top: `${carouselItem.top}px`, zIndex: carouselItem.z_index, height: `${carouselItem.height}px`}" v-for="(carouselItem, index) in displayedCarouselItems" :key="index">
           
            <div class="badges flex gap-2">
                <span class="badge" v-for="(badge, i) in carouselItem.info" :key="i">{{ badge }}</span>
            </div>

            
            <div class="overlay absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent rounded-2xl"></div>


            <div class="trailer_info flex mt-auto items-center text-white z-10">
                <div class="flex gap-2 cursor-pointer items-center">
                    <i class="fa-solid fa-circle-play text-4xl"></i>
                    <div class="trailer_info text-base font-light">
                        <p>{{carouselItem.title}}</p>
                        <span class="text-sm">Play trailer {{carouselItem.trailerDuration}}</span>
                    </div>
                </div>
                
                <div class="watch_later_btn group ml-auto relative" v-if="carouselItem.z_index >= 3">
                    <i class="fa-solid fa-clock cursor-pointer text-4xl ml-auto"></i>
                    <div class="absolute right-0 mt-2 whitespace-nowrap bg-[#7C3AED]/60 text-white text-xs px-3 py-1 rounded-md 
                                opacity-0 group-hover:opacity-100 transition pointer-events-none"> 
                                
                        Add to Watch Later
                    </div>
                </div>
            </div>
        </div>

    </div>
</template>

<style></style>