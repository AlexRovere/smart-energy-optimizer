<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')

watch(() => props.open, async (open) => {
  if (!open) return

  await nextTick()
  if (dialog.value && !dialog.value.open) {
    if (typeof dialog.value.showModal === 'function') {
      dialog.value.showModal()
    }
    else {
      dialog.value.setAttribute('open', '')
    }
  }
}, { immediate: true })
</script>

<template>
  <dialog
    v-if="open"
    ref="dialog"
    class="fixed bg-ev-surface-2 border border-ev-border rounded-ev-md p-6 w-full max-w-md text-ev-text"
    @click.self="emit('close')"
    @cancel.prevent="emit('close')"
  >
    <div class="flex flex-col gap-4">
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
dialog::backdrop {
  background: rgb(0 0 0 / 60%);
}
</style>
