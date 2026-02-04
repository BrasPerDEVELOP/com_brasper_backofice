<script setup lang="ts"></script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="w-full max-w-sm rounded-lg bg-white p-6 shadow">
      <h1 class="mb-6 text-xl font-semibold text-gray-800">Login</h1>
      <form class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="email"
            type="email"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            placeholder="tu@email.com"
          />
        </div>
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">Contraseña</label>
          <input
            id="password"
            type="password"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <button
          type="submit"
          class="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700"
        >
          Entrar
        </button>
      </form>
    </div>
  </div>
</template>
