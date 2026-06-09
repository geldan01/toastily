<script setup lang="ts">
// Inline panel for a meeting manager to assign a signup to any member, to a
// checked-in guest (picked by name — no retyping, PRD §9), or to a manually-typed
// guest. Owns its own selection and emits the resolved POST-body fragment on
// submit. Reused by meeting roles, speech slots, and vote candidates.
interface Member { id: string, name: string }

const props = defineProps<{
  members: Member[]
  guests?: { name: string }[]
  busy?: boolean
  idPrefix: string
}>()
const emit = defineEmits<{
  assign: [target: { userId: string } | { guestName: string }]
}>()

const { t } = useI18n()

const GUEST = '__guest__'
const CI = 'ci:' // checked-in guest option, value = `ci:<index>`
const selection = ref('')
const guestName = ref('')

const isGuest = computed(() => selection.value === GUEST)
const ready = computed(() => isGuest.value ? !!guestName.value.trim() : !!selection.value)

function submit() {
  if (!ready.value) return
  if (isGuest.value) {
    emit('assign', { guestName: guestName.value.trim() })
    return
  }
  if (selection.value.startsWith(CI)) {
    const g = props.guests?.[Number(selection.value.slice(CI.length))]
    if (g) emit('assign', { guestName: g.name })
    return
  }
  emit('assign', { userId: selection.value })
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
        <optgroup
          v-if="props.guests?.length"
          :label="t('meetings.checkedInGuestsGroup')"
        >
          <option
            v-for="(g, i) in props.guests"
            :key="`ci-${i}`"
            :value="`${CI}${i}`"
          >
            {{ g.name }}
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
