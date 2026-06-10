<script setup lang="ts">
import { ArrowDown, ArrowUp, Check, ClipboardCheck, Mic, Plus, Trash2 } from '@lucide/vue'

definePageMeta({ middleware: 'admin' })

const { t } = useI18n()

type ItemType = 'item' | 'speeches' | 'evaluations'
type Section = 'administrative' | 'speeches' | 'table_topics' | 'evaluations'
const SECTIONS: Section[] = ['administrative', 'speeches', 'table_topics', 'evaluations']
const SECTION_KEY: Record<Section, string> = {
  administrative: 'agenda.sectionAdministrative',
  speeches: 'agenda.sectionSpeeches',
  table_topics: 'agenda.sectionTableTopics',
  evaluations: 'agenda.sectionEvaluations',
}
interface Item {
  itemType: ItemType
  section: Section
  labelEn: string
  labelFr: string
  durationMinutes: number | null
  meetingRoleId: string | null
}
const isBlock = (it: Item) => it.itemType === 'speeches' || it.itemType === 'evaluations'
interface Role { id: string, nameEn: string, nameFr: string }
interface TemplateData {
  template: { id: string, nameEn: string, nameFr: string, items: Item[] } | null
  roles: Role[]
}

const { data } = await useFetch<TemplateData>('/api/admin/agenda-template', { key: 'admin-agenda-template' })

const templateId = ref<string | null>(null)
const name = reactive({ en: '', fr: '' })
const items = ref<Item[]>([])
const roles = ref<Role[]>([])

watchEffect(() => {
  const tpl = data.value?.template
  templateId.value = tpl?.id ?? null
  name.en = tpl?.nameEn ?? ''
  name.fr = tpl?.nameFr ?? ''
  items.value = (tpl?.items ?? []).map(i => ({ ...i }))
  roles.value = data.value?.roles ?? []
})

const saving = ref(false)
const saved = ref(false)
const error = ref('')

function move(index: number, dir: -1 | 1) {
  const target = index + dir
  if (target < 0 || target >= items.value.length) return
  const arr = items.value
  ;[arr[index], arr[target]] = [arr[target]!, arr[index]!]
}

function addItem() {
  items.value.push({ itemType: 'item', section: 'administrative', labelEn: '', labelFr: '', durationMinutes: null, meetingRoleId: null })
}
function addSpeeches() {
  items.value.push({ itemType: 'speeches', section: 'speeches', labelEn: 'Prepared Speeches', labelFr: 'Discours préparés', durationMinutes: null, meetingRoleId: null })
}
function addEvaluations() {
  items.value.push({ itemType: 'evaluations', section: 'evaluations', labelEn: 'Speech Evaluations', labelFr: 'Évaluations des discours', durationMinutes: null, meetingRoleId: null })
}
const hasSpeeches = computed(() => items.value.some(i => i.itemType === 'speeches'))
const hasEvaluations = computed(() => items.value.some(i => i.itemType === 'evaluations'))
function removeItem(index: number) {
  items.value.splice(index, 1)
}

async function save() {
  if (!templateId.value) return
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    await $fetch(`/api/admin/agenda-template/${templateId.value}`, {
      method: 'PUT',
      body: { nameEn: name.en, nameFr: name.fr, items: items.value },
    })
    saved.value = true
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { saving.value = false }
}

const totalMinutes = computed(() =>
  items.value.reduce((sum, i) => sum + (i.durationMinutes || 0), 0),
)

useHead(() => ({ title: t('admin.agenda.title') }))
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12">
    <h1 class="text-3xl font-bold tracking-tight">
      {{ t('admin.agenda.title') }}
    </h1>
    <p class="mt-2 text-sm text-muted-foreground">
      {{ t('admin.agenda.intro') }}
    </p>

    <div
      v-if="saved"
      class="mt-6 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
    >
      <Check class="size-4" />
      {{ t('admin.saved') }}
    </div>
    <div
      v-else-if="error"
      class="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {{ error }}
    </div>

    <p
      v-if="!templateId"
      class="mt-8 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
    >
      {{ t('admin.agenda.none') }}
    </p>

    <template v-else>
      <Card class="mt-8">
        <CardHeader>
          <CardTitle class="text-lg">
            {{ t('admin.agenda.nameSection') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label for="tpl-en">{{ t('admin.agenda.nameEn') }}</Label>
            <Input
              id="tpl-en"
              v-model="name.en"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="tpl-fr">{{ t('admin.agenda.nameFr') }}</Label>
            <Input
              id="tpl-fr"
              v-model="name.fr"
            />
          </div>
        </CardContent>
      </Card>

      <div class="mt-6 flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          {{ t('admin.agenda.itemsSection') }}
        </h2>
        <span class="text-sm text-muted-foreground">{{ t('admin.agenda.total', { min: totalMinutes }) }}</span>
      </div>

      <div class="mt-3 space-y-3">
        <Card
          v-for="(item, index) in items"
          :key="index"
          :class="isBlock(item) ? 'border-secondary/50 bg-secondary/5' : ''"
        >
          <CardContent class="flex items-start gap-3 py-4">
            <div class="flex flex-col gap-1 pt-6">
              <Button
                variant="ghost"
                size="icon"
                class="size-7"
                :disabled="index === 0"
                :aria-label="t('admin.roles.moveUp')"
                @click="move(index, -1)"
              >
                <ArrowUp class="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="size-7"
                :disabled="index === items.length - 1"
                :aria-label="t('admin.roles.moveDown')"
                @click="move(index, 1)"
              >
                <ArrowDown class="size-4" />
              </Button>
            </div>

            <div class="flex-1 space-y-3">
              <div
                v-if="item.itemType === 'speeches'"
                class="flex items-center gap-2 text-sm font-medium text-secondary"
              >
                <Mic class="size-4" />
                {{ t('admin.agenda.speechesNote') }}
              </div>
              <div
                v-else-if="item.itemType === 'evaluations'"
                class="flex items-center gap-2 text-sm font-medium text-secondary"
              >
                <ClipboardCheck class="size-4" />
                {{ t('admin.agenda.evaluationsNote') }}
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div class="space-y-1.5">
                  <Label :for="`le-${index}`">{{ t('admin.agenda.labelEn') }}</Label>
                  <Input
                    :id="`le-${index}`"
                    v-model="item.labelEn"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label :for="`lf-${index}`">{{ t('admin.agenda.labelFr') }}</Label>
                  <Input
                    :id="`lf-${index}`"
                    v-model="item.labelFr"
                  />
                </div>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div class="space-y-1.5">
                  <Label :for="`dur-${index}`">{{ t('admin.agenda.duration') }}</Label>
                  <Input
                    :id="`dur-${index}`"
                    v-model.number="item.durationMinutes"
                    type="number"
                    min="0"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label :for="`section-${index}`">{{ t('admin.agenda.section') }}</Label>
                  <!-- The speeches/evaluations blocks define their own section. -->
                  <select
                    :id="`section-${index}`"
                    v-model="item.section"
                    :disabled="isBlock(item)"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                  >
                    <option
                      v-for="s in SECTIONS"
                      :key="s"
                      :value="s"
                    >
                      {{ t(SECTION_KEY[s]) }}
                    </option>
                  </select>
                </div>
                <div
                  v-if="item.itemType === 'item'"
                  class="space-y-1.5"
                >
                  <Label :for="`role-${index}`">{{ t('admin.agenda.role') }}</Label>
                  <select
                    :id="`role-${index}`"
                    v-model="item.meetingRoleId"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <option :value="null">
                      {{ t('admin.agenda.noRole') }}
                    </option>
                    <option
                      v-for="role in roles"
                      :key="role.id"
                      :value="role.id"
                    >
                      {{ role.nameEn }} / {{ role.nameFr }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              class="mt-6 text-muted-foreground hover:text-destructive"
              :aria-label="t('admin.agenda.deleteItem')"
              @click="removeItem(index)"
            >
              <Trash2 class="size-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div class="mt-4 flex flex-wrap gap-3">
        <Button
          variant="secondary"
          @click="addItem"
        >
          <Plus class="size-4" />
          {{ t('admin.agenda.addItem') }}
        </Button>
        <Button
          v-if="!hasSpeeches"
          variant="outline"
          @click="addSpeeches"
        >
          <Mic class="size-4" />
          {{ t('admin.agenda.addSpeeches') }}
        </Button>
        <Button
          v-if="!hasEvaluations"
          variant="outline"
          @click="addEvaluations"
        >
          <ClipboardCheck class="size-4" />
          {{ t('admin.agenda.addEvaluations') }}
        </Button>
      </div>

      <div class="sticky bottom-4 mt-8 flex items-center gap-3">
        <Button
          size="lg"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? t('admin.saving') : t('admin.save') }}
        </Button>
      </div>
    </template>
  </div>
</template>
