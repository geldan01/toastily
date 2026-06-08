/**
 * Generic, club-agnostic dev/demo seed.
 *
 * IMPORTANT: This file is committed to a PUBLIC repo. It must contain ONLY
 * placeholder data — no real club name, address, contacts, or secrets. Real
 * club values (e.g. CN Collaborators) are applied through a deployment-only
 * seed/migration that is never committed here.
 *
 * Run with: pnpm db:seed
 */
process.loadEnvFile?.()

const { useDrizzle, schema } = await import('./client')
const db = useDrizzle()

const settingsSeed: { key: string, value: string, isAdminOnly?: boolean }[] = [
  { key: 'club.name', value: 'Your Toastmasters Club' },
  { key: 'club.tagline_en', value: 'Awaken the confident public speaker within you.' },
  { key: 'club.tagline_fr', value: 'Révélez l\'orateur confiant qui sommeille en vous.' },
  { key: 'club.email', value: 'contact@example.org' },
  { key: 'club.phone', value: '' },
  // Toastmasters club identity (admin-editable). Generic placeholders.
  { key: 'club.number', value: '' },
  { key: 'club.area', value: '' },
  { key: 'club.division', value: '' },
  { key: 'club.district', value: '' },
  { key: 'meeting.day_en', value: 'Mondays' },
  { key: 'meeting.day_fr', value: 'Les lundis' },
  { key: 'meeting.time', value: '18:00 – 20:00' },
  { key: 'meeting.address', value: '123 Example Street, Suite 100, Your City' },
  { key: 'meeting.location_note_en', value: 'A short walk from the downtown transit station.' },
  { key: 'meeting.location_note_fr', value: 'À quelques pas de la station de transport au centre-ville.' },
  { key: 'default.locale', value: 'en' },
  { key: 'speeches.max_per_meeting', value: '3' },
  // Speech timing (PRD §6.3). Window default 5–7 min; the agenda allots each
  // speech its max plus a buffer for transitions/applause.
  { key: 'speech.default_min_minutes', value: '5' },
  { key: 'speech.default_max_minutes', value: '7' },
  { key: 'speech.agenda_buffer_minutes', value: '2' },
  // Recurring schedule + numbering (used by "generate the Toastmaster year").
  { key: 'meeting.weekday', value: '' },
  { key: 'meeting.frequency_weeks', value: '1' },
  { key: 'meeting.number_start', value: '1' },
  { key: 'qr.target_url', value: '' },
  { key: 'branding.maroon', value: '#772432' },
  { key: 'branding.navy', value: '#004165' },
  { key: 'branding.gold', value: '#F2DF74' },
  // Configurable intro/outro copy for notification emails (PRD §10).
  { key: 'notify.intro_en', value: 'Here are the roles still open for our upcoming meeting. Please consider signing up!' },
  { key: 'notify.intro_fr', value: 'Voici les rôles encore vacants pour notre prochaine réunion. Pensez à vous inscrire!' },
  { key: 'notify.outro_en', value: 'Thank you for helping make our meetings a success.' },
  { key: 'notify.outro_fr', value: 'Merci de contribuer au succès de nos réunions.' },
  // Admin-only (never exposed to the public settings endpoint). Empty placeholders.
  { key: 'resend.api_key', value: '', isAdminOnly: true },
  { key: 'email.from_address', value: '', isAdminOnly: true },
]

const contentSeed = [
  // Hero carousel
  {
    page: 'home', section: 'hero', sortOrder: 0, published: true,
    titleEn: 'Awaken the confident public speaker within you',
    titleFr: 'Révélez l\'orateur confiant qui sommeille en vous',
    bodyEn: 'Join a welcoming, bilingual club where members grow their communication and leadership skills.',
    bodyFr: 'Joignez-vous à un club bilingue et accueillant où les membres développent leurs compétences en communication et en leadership.',
    ctaLabelEn: 'Visit us', ctaLabelFr: 'Visitez-nous', ctaHref: '/news',
    image: '',
  },
  {
    page: 'home', section: 'hero', sortOrder: 1, published: true,
    titleEn: 'Lead. Speak. Grow.',
    titleFr: 'Diriger. S\'exprimer. Grandir.',
    bodyEn: 'A supportive environment to practice, get feedback, and build leadership.',
    bodyFr: 'Un environnement bienveillant pour pratiquer, recevoir des commentaires et développer son leadership.',
    ctaLabelEn: 'Learn more', ctaLabelFr: 'En savoir plus', ctaHref: '/news',
    image: '',
  },
  // Key benefits
  {
    page: 'home', section: 'benefit', sortOrder: 0, published: true,
    titleEn: 'Communication', titleFr: 'Communication',
    bodyEn: 'Practice public speaking in a friendly setting and become a clear, compelling speaker.',
    bodyFr: 'Pratiquez l\'art oratoire dans un cadre amical et devenez un orateur clair et convaincant.',
  },
  {
    page: 'home', section: 'benefit', sortOrder: 1, published: true,
    titleEn: 'Leadership', titleFr: 'Leadership',
    bodyEn: 'Take on meeting roles and projects that build real-world leadership experience.',
    bodyFr: 'Assumez des rôles et des projets qui bâtissent une expérience concrète de leadership.',
  },
  {
    page: 'home', section: 'benefit', sortOrder: 2, published: true,
    titleEn: 'Self-confidence', titleFr: 'Confiance en soi',
    bodyEn: 'Grow your confidence one speech at a time, supported by encouraging members.',
    bodyFr: 'Gagnez en confiance, un discours à la fois, soutenu par des membres encourageants.',
  },
  // Why join
  {
    page: 'home', section: 'why_join', sortOrder: 0, published: true,
    titleEn: 'Why join us', titleFr: 'Pourquoi nous rejoindre',
    bodyEn: 'Bilingual programming, open membership, mentorship, a welcoming environment, a convenient downtown location, and a regular weekly schedule.',
    bodyFr: 'Programmation bilingue, adhésion ouverte, mentorat, environnement accueillant, emplacement pratique au centre-ville et horaire hebdomadaire régulier.',
  },
]

const newsSeed = [
  {
    titleEn: 'Welcome to our club website',
    titleFr: 'Bienvenue sur le site de notre club',
    excerptEn: 'Our brand-new bilingual website is live — explore meetings, news, and how to join.',
    excerptFr: 'Notre tout nouveau site bilingue est en ligne — découvrez les réunions, les nouvelles et comment nous rejoindre.',
    contentEn: 'We are thrilled to launch our new website. Here you can read the latest news, learn when and where we meet, and find out how to become a member. We meet regularly and warmly welcome guests at every meeting.',
    contentFr: 'Nous sommes ravis de lancer notre nouveau site. Vous pourrez y lire les dernières nouvelles, savoir quand et où nous nous réunissons, et découvrir comment devenir membre. Nous nous réunissons régulièrement et accueillons chaleureusement les invités à chaque réunion.',
    daysAgo: 2,
  },
  {
    titleEn: 'Guests are always welcome',
    titleFr: 'Les invités sont toujours les bienvenus',
    excerptEn: 'Curious about public speaking? Drop by a meeting — no experience needed.',
    excerptFr: 'Curieux de l\'art oratoire? Passez à une réunion — aucune expérience requise.',
    contentEn: 'You don\'t need any experience to attend. Come as a guest, watch how a meeting works, and even try an impromptu speaking opportunity if you\'d like. Our members will make you feel at home.',
    contentFr: 'Aucune expérience n\'est requise pour assister. Venez en tant qu\'invité, observez le déroulement d\'une réunion et tentez même une prise de parole improvisée si vous le souhaitez. Nos membres vous mettront à l\'aise.',
    daysAgo: 9,
  },
  {
    titleEn: 'A new term of officers',
    titleFr: 'Un nouveau mandat des dirigeants',
    excerptEn: 'Meet the executive team leading the club this term.',
    excerptFr: 'Rencontrez l\'équipe de direction du club pour ce mandat.',
    contentEn: 'Our club elected a new executive team to guide us this term. Thank you to everyone who stepped up to serve in a leadership role — your dedication keeps our club thriving.',
    contentFr: 'Notre club a élu une nouvelle équipe de direction pour ce mandat. Merci à toutes les personnes qui se sont portées volontaires pour un rôle de leadership — votre dévouement fait prospérer notre club.',
    daysAgo: 16,
  },
]

/**
 * Generic Toastmasters meeting roles (PRD §3.3). These are the standard,
 * club-agnostic role names — admins rename/reorder/deactivate per club.
 * `grantsMeetingAuthority` marks the role whose signed-up holder may manage that
 * meeting's signups (assign/reassign/release anyone) — the Toastmaster hosts the
 * meeting, so they get it by default; admins can move it to any role.
 */
const meetingRolesSeed = [
  { nameEn: 'Chair', nameFr: 'Président' },
  { nameEn: 'Toastmaster', nameFr: 'Animateur', grantsMeetingAuthority: true },
  { nameEn: 'General Evaluator', nameFr: 'Évaluateur général' },
  { nameEn: 'Table Topics Master', nameFr: 'Maître des sujets impromptus' },
  { nameEn: 'Secretary', nameFr: 'Secrétaire' },
  { nameEn: 'Sergeant-at-Arms', nameFr: 'Huissier' },
  { nameEn: 'Toast', nameFr: 'Toast' },
  { nameEn: 'Moment of Reflection', nameFr: 'Moment de réflexion' },
  { nameEn: 'Moment of Humour', nameFr: 'Moment d\'humour' },
  { nameEn: 'Grammarian', nameFr: 'Grammairien' },
]

/**
 * A generic timed agenda template (PRD §6.4). Items optionally bind to a role
 * by its English name (resolved to an id at seed time); `speeches` expands per
 * speech when an agenda is generated.
 */
const agendaTemplateSeed = {
  nameEn: 'Standard Meeting',
  nameFr: 'Réunion standard',
  items: [
    { labelEn: 'Call to Order', labelFr: 'Ouverture de la séance', duration: 1, role: 'Sergeant-at-Arms' },
    { labelEn: 'Chair\'s Welcome', labelFr: 'Mot de bienvenue du président', duration: 3, role: 'Chair' },
    { labelEn: 'Toast', labelFr: 'Toast', duration: 2, role: 'Toast' },
    { labelEn: 'Moment of Reflection', labelFr: 'Moment de réflexion', duration: 2, role: 'Moment of Reflection' },
    { labelEn: 'Moment of Humour', labelFr: 'Moment d\'humour', duration: 3, role: 'Moment of Humour' },
    { labelEn: 'Toastmaster Takes Over', labelFr: 'Prise en charge par l\'animateur', duration: 2, role: 'Toastmaster' },
    { labelEn: 'Prepared Speeches', labelFr: 'Discours préparés', type: 'speeches' as const },
    { labelEn: 'Break', labelFr: 'Pause', duration: 10 },
    { labelEn: 'Table Topics', labelFr: 'Sujets impromptus', duration: 15, role: 'Table Topics Master' },
    { labelEn: 'Evaluation Session', labelFr: 'Séance d\'évaluation', duration: 2, role: 'General Evaluator' },
    { labelEn: 'Speech Evaluations', labelFr: 'Évaluations des discours', type: 'evaluations' as const },
    { labelEn: 'Grammarian\'s Report', labelFr: 'Rapport du grammairien', duration: 3, role: 'Grammarian' },
    { labelEn: 'Voting & Awards', labelFr: 'Vote et remises de prix', duration: 5, role: 'Sergeant-at-Arms' },
    { labelEn: 'Closing Remarks & Adjournment', labelFr: 'Mot de la fin et clôture', duration: 2, role: 'Chair' },
  ],
}

/**
 * Standard Toastmasters executive positions (PRD §3.2). Capability flags are
 * data, not hard-coded role checks: President manages everything, VP Education
 * manages the calendar, VP Public Relations manages content. Admins adjust.
 */
const executivePositionsSeed = [
  { nameEn: 'President', nameFr: 'Président', canManageCalendar: true, canManageContent: true, canAssignOfficers: true },
  { nameEn: 'VP Education', nameFr: 'VP Éducation', canManageCalendar: true },
  { nameEn: 'VP Membership', nameFr: 'VP Adhésion' },
  { nameEn: 'VP Public Relations', nameFr: 'VP Relations publiques', canManageContent: true },
  { nameEn: 'Treasurer', nameFr: 'Trésorier' },
  { nameEn: 'Secretary', nameFr: 'Secrétaire' },
  { nameEn: 'Sergeant-at-Arms', nameFr: 'Huissier' },
]

/**
 * Default notification templates (PRD §10). Body placeholders are substituted at
 * send time: {{intro}} {{unfilled_roles}} {{signup_link}} {{outro}}. Generic,
 * club-agnostic copy — admins edit subject/body per club.
 */
const emailTemplatesSeed = [
  {
    key: 'unfilled_roles',
    descriptionEn: 'Weekly reminder listing open roles for upcoming meeting(s) with a link to sign up.',
    descriptionFr: 'Rappel hebdomadaire listant les rôles vacants pour les prochaines réunions avec un lien pour s\'inscrire.',
    subjectEn: 'Roles still open for our next meeting',
    subjectFr: 'Rôles encore vacants pour notre prochaine réunion',
    bodyEn: '<p>{{intro}}</p>\n{{unfilled_roles}}\n<p><a href="{{signup_link}}">Sign up here</a></p>\n<p>{{outro}}</p>',
    bodyFr: '<p>{{intro}}</p>\n{{unfilled_roles}}\n<p><a href="{{signup_link}}">Inscrivez-vous ici</a></p>\n<p>{{outro}}</p>',
  },
]

async function seedEmailNotifications() {
  console.log('Seeding email templates…')
  for (const tmpl of emailTemplatesSeed) {
    await db.insert(schema.emailTemplates)
      .values(tmpl)
      .onConflictDoUpdate({
        target: schema.emailTemplates.key,
        // Templates are admin-managed: on reseed, refresh only the description
        // and never clobber edited subject/body copy.
        set: { descriptionEn: tmpl.descriptionEn, descriptionFr: tmpl.descriptionFr, updatedAt: new Date() },
      })
  }

  // A sample weekly schedule (inactive by default), only when none exist.
  const existing = await db.select({ id: schema.emailSchedules.id }).from(schema.emailSchedules).limit(1)
  if (existing.length === 0) {
    console.log('Seeding sample (inactive) email schedule…')
    await db.insert(schema.emailSchedules).values({
      templateKey: 'unfilled_roles',
      cadence: 'weekly',
      dayOfWeek: 0, // Sunday
      timeOfDay: '09:00',
      active: false,
    })
  }
}

async function seedExecutivePositions() {
  const existing = await db.select({ id: schema.executivePositions.id }).from(schema.executivePositions).limit(1)
  if (existing.length > 0) {
    console.log('Executive positions already present — skipping.')
    return
  }
  console.log('Seeding executive positions…')
  await db.insert(schema.executivePositions).values(
    executivePositionsSeed.map((p, i) => ({
      nameEn: p.nameEn,
      nameFr: p.nameFr,
      canManageCalendar: p.canManageCalendar ?? false,
      canManageContent: p.canManageContent ?? false,
      canAssignOfficers: p.canAssignOfficers ?? false,
      sortOrder: i,
    })),
  )
}

async function seedMeetingRolesAndAgenda() {
  // Idempotent: only seed when the meeting_roles table is still empty, so
  // re-running the seed never duplicates or clobbers admin edits.
  const existing = await db.select({ id: schema.meetingRoles.id }).from(schema.meetingRoles).limit(1)
  if (existing.length > 0) {
    console.log('Meeting roles already present — skipping roles/agenda seed.')
    return
  }

  console.log('Seeding meeting roles…')
  const roleRows = await db.insert(schema.meetingRoles)
    .values(meetingRolesSeed.map((r, i) => ({ ...r, sortOrder: i })))
    .returning({ id: schema.meetingRoles.id, nameEn: schema.meetingRoles.nameEn })
  const roleId = new Map(roleRows.map(r => [r.nameEn, r.id]))

  console.log('Seeding default agenda template…')
  const [template] = await db.insert(schema.agendaTemplates)
    .values({ nameEn: agendaTemplateSeed.nameEn, nameFr: agendaTemplateSeed.nameFr, isDefault: true })
    .returning({ id: schema.agendaTemplates.id })

  await db.insert(schema.agendaTemplateItems).values(
    agendaTemplateSeed.items.map((item, i) => ({
      templateId: template!.id,
      sortOrder: i,
      itemType: (item.type ?? 'item') as 'item' | 'speeches' | 'evaluations',
      labelEn: item.labelEn,
      labelFr: item.labelFr,
      durationMinutes: item.duration ?? null,
      meetingRoleId: item.role ? roleId.get(item.role) ?? null : null,
    })),
  )
}

async function main() {
  console.log('Seeding settings…')
  for (const s of settingsSeed) {
    await db.insert(schema.settings)
      .values({ key: s.key, value: s.value, isAdminOnly: s.isAdminOnly ?? false })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: s.value, isAdminOnly: s.isAdminOnly ?? false, updatedAt: new Date() },
      })
  }

  console.log('Reseeding content blocks…')
  await db.delete(schema.contentBlocks)
  await db.insert(schema.contentBlocks).values(contentSeed)

  console.log('Reseeding news…')
  await db.delete(schema.news)
  const now = Date.now()
  await db.insert(schema.news).values(
    newsSeed.map(n => ({
      titleEn: n.titleEn,
      titleFr: n.titleFr,
      excerptEn: n.excerptEn,
      excerptFr: n.excerptFr,
      contentEn: n.contentEn,
      contentFr: n.contentFr,
      image: '',
      publishedAt: new Date(now - n.daysAgo * 24 * 60 * 60 * 1000),
    })),
  )

  await seedMeetingRolesAndAgenda()
  await seedExecutivePositions()
  await seedEmailNotifications()

  console.log('✓ Seed complete.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
