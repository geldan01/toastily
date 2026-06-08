<script setup lang="ts">
// Inline panel for a meeting manager to assign a signup to any member or to a
// named guest. Owns its own member/guest selection and emits the resolved
// POST-body fragment on submit. Reused by both meeting roles and speech slots.
interface Member { id: string, name: string }

const props = defineProps<{
  members: Member[]
  busy?: boolean
  idPrefix: string
}>()
const emit = defineEmits<{
  assign: [target: { userId: string } | { guestName: string }]
}>()

const { t } = useI18n()

const GUEST = '__guest__'
const selection = ref('')
const guestName = ref('')

const isGuest = computed(() => selection.value === GUEST)
const ready = computed(() => isGuest.value ? !!guestName.value.trim() : !!selection.value)

function submit() {
  if (!ready.value) return
  emit('assign', isGuest.value ? { guestName: guestName.value.trim() } : { userId: selection.value })
}
</script>

<template>
  <form
    class="flex w-full flex-wrap items-end gap-2"
    @submit.prevent="submit"
  >
    <div class="min-w-48 flex-1 space-y-1.5">
      <Label :for="`${props.idPrefix}-who`">{{ t('meetings.assignTo') }}</Label>
      <select
        :id="`${props.idPrefix}-who`"
        v-model="selection"
        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      >
        <option value="">
          {{ t('meetings.chooseMember') }}
        </option>
        <optgroup :label="t('meetings.membersGroup')">
          <option
            v-for="m in props.members"
            :key="m.id"
            :value="m.id"
          >
            {{ m.name }}
          </option>
        </optgroup>
        <option :value="GUEST">
          {{ t('meetings.guestOption') }}
        </option>
      </select>
    </div>
    <div
      v-if="isGuest"
      class="min-w-48 flex-1 space-y-1.5"
    >
      <Label :for="`${props.idPrefix}-guest`">{{ t('meetings.guestName') }}</Label>
      <Input
        :id="`${props.idPrefix}-guest`"
        v-model="guestName"
        autofocus
      />
    </div>
    <Button
      type="submit"
      size="sm"
      :disabled="!ready || props.busy"
    >
      {{ t('meetings.assign') }}
    </Button>
  </form>
</template>
