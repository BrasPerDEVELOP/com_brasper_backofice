<script setup lang="ts">
import { RouterView } from 'vue-router'
import { provideAppUpdates } from '@/interface/presentation/use_app_updates'

provideAppUpdates()
</script>

<template>
  <RouterView />
</template>
