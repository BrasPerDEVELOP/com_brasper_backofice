<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from 'vue'
import { watchAppUpdates } from '@/interface/infrastructure/services/app_updates'
const available = shallowRef(false)
let stop: (() => void) | undefined
onMounted(() => {
  if (import.meta.env.PROD)
    stop = watchAppUpdates(() => {
      available.value = true
    })
})
onUnmounted(() => stop?.())
function refresh() {
  window.location.reload()
}
</script>
<template>
  <aside v-if="available" class="app-update-notice" role="status" aria-live="polite">
    <div>
      <strong>Hay una nueva versión disponible</strong>
      <p>Guarda lo que estés editando y actualiza para ver los cambios.</p>
    </div>
    <button type="button" @click="refresh">Actualizar ahora</button>
  </aside>
</template>
<style scoped>
.app-update-notice {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 20px;
  max-width: 560px;
  padding: 18px 20px;
  border: 1px solid #c7cdf1;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 36px #1e293b24;
  color: #24324b;
  font-size: 14px;
}
.app-update-notice strong {
  font-weight: 700;
}
.app-update-notice p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
.app-update-notice button {
  flex-shrink: 0;
  border: 0;
  border-radius: 8px;
  padding: 11px 14px;
  background: #4f52be;
  color: #fff;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.app-update-notice button:focus-visible {
  outline: 3px solid #a5b4fc;
  outline-offset: 2px;
}
@media (max-width: 600px) {
  .app-update-notice {
    left: 12px;
    right: 12px;
    bottom: 12px;
    flex-wrap: wrap;
    gap: 12px;
  }
}
</style>
