<script setup lang="ts">
interface ImportError {
  line: number
  message: string
}

interface ImportPreviewRow {
  line: number
  name: string
  email: string
  committee: string
  group: string
  role: string
}

interface ImportResponse {
  data: {
    imported: number
    valid: number
    errors: ImportError[]
    preview?: ImportPreviewRow[]
    created?: Array<{ email: string; name: string; sent: boolean; password?: string }>
  }
}

const emit = defineEmits<{
  close: [result: { imported: number; created?: ImportResponse['data']['created'] }]
}>()

const toast = useApiToast()

const file = ref<File | null>(null)
const sendCredentials = ref(true)
const isValidating = ref(false)
const isImporting = ref(false)
const preview = ref<ImportResponse['data'] | null>(null)

watch(file, () => {
  preview.value = null
})

async function submit(dryRun: boolean) {
  if (!file.value) return
  const form = new FormData()
  form.append('file', file.value)
  form.append('sendCredentials', String(sendCredentials.value))
  form.append('dryRun', String(dryRun))

  if (dryRun) isValidating.value = true
  else isImporting.value = true

  try {
    const response = await $fetch<ImportResponse>('/api/admin/users/import', {
      method: 'POST',
      body: form,
    })
    if (dryRun || response.data.errors.length > 0) {
      preview.value = response.data
      if (response.data.errors.length > 0) {
        toast.error(null, 'El CSV contiene errores. Corrígelos e inténtalo de nuevo.')
      }
      return
    }
    toast.success(`${response.data.imported} usuarios importados`)
    emit('close', { imported: response.data.imported, created: response.data.created })
  } catch (error) {
    toast.error(error)
  } finally {
    isValidating.value = false
    isImporting.value = false
  }
}
</script>

<template>
  <UModal
    title="Importar usuarios desde CSV"
    description="Columnas: nombre, apellidos, email, comision, grupo, rol. Comisión y grupo por nombre o siglas."
    :close="{ onClick: () => emit('close', { imported: 0 }) }"
    :ui="{ footer: 'justify-between', content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <UButton
            to="/api/admin/users/import/template"
            external
            icon="i-lucide-download"
            color="neutral"
            variant="subtle"
            size="sm"
          >
            Descargar plantilla CSV
          </UButton>
          <USwitch v-model="sendCredentials" label="Enviar credenciales por correo" />
        </div>

        <UFileUpload
          v-model="file"
          accept=".csv,text/csv"
          label="Arrastra el CSV o haz clic para elegirlo"
          description="UTF-8, separado por comas o punto y coma"
          icon="i-lucide-file-spreadsheet"
          class="w-full"
        />

        <template v-if="preview">
          <UAlert
            v-if="preview.errors.length > 0"
            color="error"
            variant="subtle"
            icon="i-lucide-alert-circle"
            :title="`${preview.errors.length} filas con errores`"
          >
            <template #description>
              <ul class="mt-1 max-h-40 space-y-0.5 overflow-auto text-xs">
                <li v-for="error in preview.errors" :key="`${error.line}-${error.message}`">
                  Línea {{ error.line }}: {{ error.message }}
                </li>
              </ul>
            </template>
          </UAlert>
          <UAlert
            v-else
            color="success"
            variant="subtle"
            icon="i-lucide-check-circle-2"
            :title="`${preview.valid} usuarios listos para importar`"
          />

          <div
            v-if="preview.preview?.length"
            class="border-default max-h-64 overflow-auto rounded-lg border"
          >
            <table class="w-full text-left text-xs">
              <thead class="bg-muted sticky top-0">
                <tr>
                  <th class="px-2 py-1.5">Nombre</th>
                  <th class="px-2 py-1.5">Correo</th>
                  <th class="px-2 py-1.5">Comisión</th>
                  <th class="px-2 py-1.5">Grupo</th>
                  <th class="px-2 py-1.5">Rol</th>
                </tr>
              </thead>
              <tbody class="divide-default divide-y">
                <tr v-for="row in preview.preview" :key="row.line">
                  <td class="px-2 py-1.5">{{ row.name }}</td>
                  <td class="px-2 py-1.5">{{ row.email }}</td>
                  <td class="px-2 py-1.5">{{ row.committee || '—' }}</td>
                  <td class="px-2 py-1.5">{{ row.group || '—' }}</td>
                  <td class="px-2 py-1.5">{{ row.role === 'admin' ? 'Admin' : 'Participante' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </template>
    <template #footer>
      <UButton
        label="Cancelar"
        color="neutral"
        variant="outline"
        @click="emit('close', { imported: 0 })"
      />
      <div class="flex gap-2">
        <UButton
          label="Validar"
          color="neutral"
          variant="subtle"
          icon="i-lucide-scan-search"
          :disabled="!file"
          :loading="isValidating"
          @click="submit(true)"
        />
        <UButton
          label="Importar"
          color="primary"
          icon="i-lucide-upload"
          :disabled="!file || !preview || preview.errors.length > 0"
          :loading="isImporting"
          @click="submit(false)"
        />
      </div>
    </template>
  </UModal>
</template>
