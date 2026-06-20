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
  // Machine-readable start time (HH:MM) used to compute agenda line clock times.
  { key: 'meeting.start_time', value: '18:00' },
  { key: 'meeting.address', value: '123 Example Street, Suite 100, Your City' },
  { key: 'meeting.location_note_en', value: 'A short walk from the downtown transit station.' },
  { key: 'meeting.location_note_fr', value: 'À quelques pas de la station de transport au centre-ville.' },
  // Rotating landing-page hero backgrounds: comma-separated image URLs. Ships
  // with generic bundled photos; clubs point these at their own images.
  { key: 'landing.hero_images', value: '/images/hero/speaker.jpg,/images/hero/meeting.jpg,/images/hero/networking.jpg' },
  { key: 'default.locale', value: 'en' },
  // Privacy policy version (issue #25). Bumped when the /privacy content changes
  // materially; the value in force is stamped onto each user's consent record so
  // a revision can later require re-consent.
  { key: 'privacy.version', value: '1' },
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
  // Official Toastmasters International palette (Brand Manual): True Maroon
  // PMS 188, Loyal Blue PMS 302, Happy Yellow PMS 127, Cool Gray PMS 442.
  { key: 'branding.maroon', value: '#772432' },
  { key: 'branding.navy', value: '#004165' },
  { key: 'branding.gold', value: '#F2DF74' },
  { key: 'branding.gray', value: '#A9B2B1' },
  // Official TI logo shown on the agenda header (screen + print). The file is
  // NOT bundled — clubs download it from the TI Brand Portal (trademarked) and
  // place it at this URL or point this setting elsewhere.
  { key: 'branding.logo_url', value: '/images/toastmasters-logo.png' },
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
 * Standalone rich pages (issue #16): About / FAQ. Generic, club-agnostic copy
 * authored as Editor.js block JSON — content managers edit them in-app. Seeded
 * published so the nav links resolve out of the box.
 */
const pagesSeed = [
  {
    slug: 'about',
    titleEn: 'About our club',
    titleFr: 'À propos de notre club',
    contentEn: JSON.stringify({ blocks: [
      { type: 'header', data: { text: 'Who we are', level: 2 } },
      { type: 'paragraph', data: { text: 'We are a welcoming Toastmasters club where members practise public speaking and leadership in a supportive, bilingual environment.' } },
      { type: 'header', data: { text: 'What to expect', level: 2 } },
      { type: 'paragraph', data: { text: 'Every meeting blends prepared speeches, impromptu speaking, and constructive evaluation. Guests are always welcome — no experience needed.' } },
    ] }),
    contentFr: JSON.stringify({ blocks: [
      { type: 'header', data: { text: 'Qui nous sommes', level: 2 } },
      { type: 'paragraph', data: { text: 'Nous sommes un club Toastmasters accueillant où les membres pratiquent l\'art oratoire et le leadership dans un environnement bilingue et bienveillant.' } },
      { type: 'header', data: { text: 'À quoi s\'attendre', level: 2 } },
      { type: 'paragraph', data: { text: 'Chaque réunion combine discours préparés, prise de parole improvisée et évaluation constructive. Les invités sont toujours les bienvenus — aucune expérience requise.' } },
    ] }),
  },
  {
    slug: 'faq',
    titleEn: 'Frequently asked questions',
    titleFr: 'Foire aux questions',
    contentEn: JSON.stringify({ blocks: [
      { type: 'header', data: { text: 'Do I need to be a member to attend?', level: 2 } },
      { type: 'paragraph', data: { text: 'No. Guests are welcome at any meeting. Come and see how it works before deciding to join.' } },
      { type: 'header', data: { text: 'How much does it cost?', level: 2 } },
      { type: 'paragraph', data: { text: 'Membership dues vary by club. Reach out through our contact page and we will share the current rates.' } },
      { type: 'header', data: { text: 'Are meetings in English or French?', level: 2 } },
      { type: 'paragraph', data: { text: 'Both! Our meetings are bilingual and you are welcome to speak in either language.' } },
    ] }),
    contentFr: JSON.stringify({ blocks: [
      { type: 'header', data: { text: 'Dois-je être membre pour assister?', level: 2 } },
      { type: 'paragraph', data: { text: 'Non. Les invités sont les bienvenus à toute réunion. Venez voir comment cela se déroule avant de décider d\'adhérer.' } },
      { type: 'header', data: { text: 'Combien cela coûte-t-il?', level: 2 } },
      { type: 'paragraph', data: { text: 'Les cotisations varient selon le club. Contactez-nous via notre page de contact et nous vous communiquerons les tarifs en vigueur.' } },
      { type: 'header', data: { text: 'Les réunions sont-elles en anglais ou en français?', level: 2 } },
      { type: 'paragraph', data: { text: 'Les deux! Nos réunions sont bilingues et vous pouvez vous exprimer dans la langue de votre choix.' } },
    ] }),
  },
  {
    slug: 'privacy',
    titleEn: 'Privacy policy',
    titleFr: 'Politique de confidentialité',
    contentEn: JSON.stringify({ blocks: [
      { type: 'paragraph', data: { text: 'This policy explains what personal information we collect when you create an account or take part in club activities, how we use it, and who can see it. By creating an account you agree to the terms below.' } },
      { type: 'header', data: { text: 'What we collect', level: 2 } },
      { type: 'paragraph', data: { text: 'When you register we collect your name, email address, and password. As a member you may also add a profile picture and a phone number, and we record your participation in meetings (roles, speeches, evaluations, attendance, and votes).' } },
      { type: 'header', data: { text: 'How your information is shared', level: 2 } },
      { type: 'list', data: { style: 'unordered', items: [
        'Your name and profile picture may be shown publicly on the club website and to other members (for example in the roster, agendas, and participation history).',
        'Your email address and phone number are shared only with signed-in club members — never with guests or the general public.',
        'Your password is stored securely (hashed) and is never visible to anyone, including club officers.',
      ] } },
      { type: 'header', data: { text: 'How we use your information', level: 2 } },
      { type: 'paragraph', data: { text: 'We use your information to run the club: to organise meetings and agendas, to let members reach one another, to track participation, and to send you club-related emails. We do not sell your personal information.' } },
      { type: 'header', data: { text: 'Your choices', level: 2 } },
      { type: 'paragraph', data: { text: 'You can review or update your profile, including your photo and phone number, from your account page at any time. To request removal of your account or data, contact a club officer.' } },
    ] }),
    contentFr: JSON.stringify({ blocks: [
      { type: 'paragraph', data: { text: 'Cette politique explique quels renseignements personnels nous recueillons lorsque vous créez un compte ou participez aux activités du club, comment nous les utilisons et qui peut les consulter. En créant un compte, vous acceptez les conditions ci-dessous.' } },
      { type: 'header', data: { text: 'Ce que nous recueillons', level: 2 } },
      { type: 'paragraph', data: { text: 'Lors de votre inscription, nous recueillons votre nom, votre adresse courriel et votre mot de passe. En tant que membre, vous pouvez aussi ajouter une photo de profil et un numéro de téléphone, et nous consignons votre participation aux réunions (rôles, discours, évaluations, présence et votes).' } },
      { type: 'header', data: { text: 'Partage de vos renseignements', level: 2 } },
      { type: 'list', data: { style: 'unordered', items: [
        'Votre nom et votre photo de profil peuvent être affichés publiquement sur le site du club et auprès des autres membres (par exemple dans le répertoire, les ordres du jour et l\'historique de participation).',
        'Votre adresse courriel et votre numéro de téléphone ne sont partagés qu\'avec les membres connectés du club — jamais avec les invités ni le grand public.',
        'Votre mot de passe est stocké de façon sécurisée (haché) et n\'est jamais visible par quiconque, y compris les dirigeants du club.',
      ] } },
      { type: 'header', data: { text: 'Comment nous utilisons vos renseignements', level: 2 } },
      { type: 'paragraph', data: { text: 'Nous utilisons vos renseignements pour faire fonctionner le club : organiser les réunions et les ordres du jour, permettre aux membres de communiquer entre eux, suivre la participation et vous envoyer des courriels liés au club. Nous ne vendons pas vos renseignements personnels.' } },
      { type: 'header', data: { text: 'Vos choix', level: 2 } },
      { type: 'paragraph', data: { text: 'Vous pouvez consulter ou mettre à jour votre profil, y compris votre photo et votre numéro de téléphone, depuis votre page de compte à tout moment. Pour demander la suppression de votre compte ou de vos données, communiquez avec un dirigeant du club.' } },
    ] }),
  },
]

/**
 * Generic Toastmasters meeting roles (PRD §3.3). These are the standard,
 * club-agnostic role names — admins rename/reorder/deactivate per club.
 * `grantsMeetingAuthority` marks roles whose signed-up holder may manage that
 * meeting's signups (assign/reassign/release anyone) and open/close voting
 * (PRD §8) — the Toastmaster (host) and Sergeant-at-Arms (runs voting) get it by
 * default; admins can move it to any role.
 */
const meetingRolesSeed = [
  { nameEn: 'Chair', nameFr: 'Président', isMeetingOfficer: true },
  { nameEn: 'Toastmaster', nameFr: 'Animateur', grantsMeetingAuthority: true, isMeetingOfficer: true },
  { nameEn: 'General Evaluator', nameFr: 'Évaluateur général', isMeetingOfficer: true },
  { nameEn: 'Table Topics Master', nameFr: 'Maître des sujets impromptus', isMeetingOfficer: true },
  { nameEn: 'Secretary', nameFr: 'Secrétaire', isMeetingOfficer: true, isMinutesSecretary: true },
  { nameEn: 'Sergeant-at-Arms', nameFr: 'Huissier', grantsMeetingAuthority: true, isMeetingOfficer: true },
  { nameEn: 'Toast', nameFr: 'Toast' },
  { nameEn: 'Moment of Reflection', nameFr: 'Moment de réflexion' },
  { nameEn: 'Moment of Humour', nameFr: 'Moment d\'humour' },
  { nameEn: 'Grammarian', nameFr: 'Grammairien', countsAsEvaluator: true, isMeetingOfficer: true },
  { nameEn: 'Timer', nameFr: 'Chronométreur', isMeetingOfficer: true },
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
    // Opening administrative segment.
    { labelEn: 'Call to Order', labelFr: 'Ouverture de la séance', duration: 1, role: 'Sergeant-at-Arms', section: 'administrative' as const },
    { labelEn: 'Chair\'s Welcome', labelFr: 'Mot de bienvenue du président', duration: 3, role: 'Chair', section: 'administrative' as const },
    { labelEn: 'Toast', labelFr: 'Toast', duration: 2, role: 'Toast', section: 'administrative' as const },
    { labelEn: 'Moment of Reflection', labelFr: 'Moment de réflexion', duration: 2, role: 'Moment of Reflection', section: 'administrative' as const },
    { labelEn: 'Moment of Humour', labelFr: 'Moment d\'humour', duration: 3, role: 'Moment of Humour', section: 'administrative' as const },
    { labelEn: 'Toastmaster Takes Over', labelFr: 'Prise en charge par l\'animateur', duration: 2, role: 'Toastmaster', section: 'administrative' as const },
    // Educative session: prepared speeches, table topics, evaluations.
    { labelEn: 'Prepared Speeches', labelFr: 'Discours préparés', type: 'speeches' as const, section: 'speeches' as const },
    { labelEn: 'Break', labelFr: 'Pause', duration: 10, section: 'table_topics' as const },
    { labelEn: 'Table Topics', labelFr: 'Sujets impromptus', duration: 15, role: 'Table Topics Master', section: 'table_topics' as const },
    { labelEn: 'Evaluation Session', labelFr: 'Séance d\'évaluation', duration: 2, role: 'General Evaluator', section: 'evaluations' as const },
    { labelEn: 'Speech Evaluations', labelFr: 'Évaluations des discours', type: 'evaluations' as const, section: 'evaluations' as const },
    { labelEn: 'Grammarian\'s Report', labelFr: 'Rapport du grammairien', duration: 3, role: 'Grammarian', section: 'evaluations' as const },
    { labelEn: 'General Evaluation', labelFr: 'Évaluation générale', duration: 5, role: 'General Evaluator', section: 'evaluations' as const },
    { labelEn: 'Awards Ceremony', labelFr: 'Remise des prix', duration: 2, role: 'Toastmaster', section: 'evaluations' as const },
    // Closing administrative segment — the Chair's conclusion.
    { labelEn: 'Guests Feedback', labelFr: 'Commentaires des invités', duration: 5, role: 'Chair', section: 'administrative' as const },
    { labelEn: 'Last Minute Announcements', labelFr: 'Annonces de dernière minute', duration: 2, role: 'Chair', section: 'administrative' as const },
    { labelEn: 'Closing Remarks & Adjournment', labelFr: 'Mot de la fin et clôture', duration: 2, role: 'Chair', section: 'administrative' as const },
  ],
}

/**
 * Standard Toastmasters executive positions (PRD §3.2, issue #47). Per-group
 * write access is data, not hard-coded role checks: President writes to every
 * group, VP Education to meetings/agenda, VP Public Relations to content +
 * communication, Secretary to meetings (minutes). Admins adjust the matrix.
 */
const executivePositionsSeed = [
  { nameEn: 'President', nameFr: 'Président', writePeople: true, writeMeetings: true, writeContent: true, writeCommunication: true, writeConfig: true, notifyMemberRequests: true },
  { nameEn: 'VP Education', nameFr: 'VP Éducation', writeMeetings: true },
  { nameEn: 'VP Membership', nameFr: 'VP Adhésion', notifyMemberRequests: true },
  { nameEn: 'VP Public Relations', nameFr: 'VP Relations publiques', writeContent: true, writeCommunication: true },
  { nameEn: 'Treasurer', nameFr: 'Trésorier' },
  { nameEn: 'Secretary', nameFr: 'Secrétaire', writeMeetings: true },
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
  {
    // System-triggered when a guest requests membership (issue #50). Sent to the
    // President, VP Membership, and site admin(s). Placeholders substituted at
    // send time: {{requester_name}} {{message}} {{requests_link}}.
    key: 'membership_request_received',
    descriptionEn: 'Notifies the President, VP Membership, and admins when a new membership request is submitted.',
    descriptionFr: 'Avise le président, le VP Adhésion et les administrateurs lorsqu\'une nouvelle demande d\'adhésion est soumise.',
    subjectEn: 'New membership request',
    subjectFr: 'Nouvelle demande d\'adhésion',
    bodyEn: '<p><strong>{{requester_name}}</strong> has requested to become a member.</p>\n{{message}}\n<p><a href="{{requests_link}}">Review membership requests</a></p>',
    bodyFr: '<p><strong>{{requester_name}}</strong> a demandé à devenir membre.</p>\n{{message}}\n<p><a href="{{requests_link}}">Examiner les demandes d\'adhésion</a></p>',
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
      writePeople: p.writePeople ?? false,
      writeMeetings: p.writeMeetings ?? false,
      writeContent: p.writeContent ?? false,
      writeCommunication: p.writeCommunication ?? false,
      writeConfig: p.writeConfig ?? false,
      notifyMemberRequests: p.notifyMemberRequests ?? false,
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
      section: item.section,
      labelEn: item.labelEn,
      labelFr: item.labelFr,
      durationMinutes: item.duration ?? null,
      meetingRoleId: item.role ? roleId.get(item.role) ?? null : null,
    })),
  )
}

/**
 * Member testimonials (issue #27). Generic, club-agnostic quotes. Users are NOT
 * seeded by this file (they come from registration / the test harness), so we
 * attach testimonials to whichever member/officer users already exist, in a
 * stable order. Idempotent: clears the table then inserts. No-ops gracefully
 * when there aren't enough members yet.
 */
const testimonialsSeed = [
  {
    bodyEn: 'Joining this club gave me the confidence to speak up at work. Every meeting is a friendly place to practise and grow.',
    bodyFr: 'Rejoindre ce club m\'a donné la confiance de prendre la parole au travail. Chaque réunion est un endroit amical pour pratiquer et progresser.',
    featuredEn: true,
    featuredFr: false,
    featuredOrderEn: 0,
    featuredOrderFr: 0,
  },
  {
    bodyEn: 'The supportive feedback helped me become a clearer, more compelling speaker than I ever imagined.',
    bodyFr: 'Les commentaires bienveillants m\'ont aidé à devenir un orateur plus clair et plus convaincant que je ne l\'aurais imaginé.',
    featuredEn: false,
    featuredFr: true,
    featuredOrderEn: 0,
    featuredOrderFr: 0,
  },
  {
    bodyEn: 'I came as a nervous guest and stayed for the people. Taking on roles built real leadership skills I use every day.',
    bodyFr: null,
    featuredEn: true,
    featuredFr: false,
    featuredOrderEn: 1,
    featuredOrderFr: 0,
  },
  {
    bodyEn: null,
    bodyFr: 'Un environnement accueillant et bilingue où j\'ai pu pratiquer dans la langue de mon choix sans jugement.',
    featuredEn: false,
    featuredFr: false,
    featuredOrderEn: 0,
    featuredOrderFr: 0,
  },
]

async function seedTestimonials() {
  const { asc, inArray } = await import('drizzle-orm')

  // Attach to existing member/officer/admin users, in a stable order.
  const candidates = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(inArray(schema.users.status, ['member', 'officer', 'admin']))
    .orderBy(asc(schema.users.createdAt), asc(schema.users.email))
    .limit(testimonialsSeed.length)

  console.log('Reseeding testimonials…')
  await db.delete(schema.testimonials)

  if (candidates.length === 0) {
    console.log('No member/officer users present — skipping testimonials seed.')
    return
  }

  await db.insert(schema.testimonials).values(
    candidates.map((u, i) => ({ userId: u.id, ...testimonialsSeed[i]! })),
  )
}

// The 11 official Toastmasters International learning paths (issue #58). Global
// and fixed worldwide — not club-specific config — so they ship as generic seed
// data. Idempotent: only seeded when the table is empty.
const pathwaysPathsSeed = [
  { nameEn: 'Dynamic Leadership', nameFr: 'Leadership dynamique' },
  { nameEn: 'Effective Coaching', nameFr: 'Coaching efficace' },
  { nameEn: 'Engaging Humor', nameFr: 'Humour engageant' },
  { nameEn: 'Innovative Planning', nameFr: 'Planification innovante' },
  { nameEn: 'Leadership Development', nameFr: 'Perfectionnement du leadership' },
  { nameEn: 'Motivational Strategies', nameFr: 'Stratégies de motivation' },
  { nameEn: 'Persuasive Influence', nameFr: 'Influence persuasive' },
  { nameEn: 'Presentation Mastery', nameFr: 'Maîtrise de la présentation' },
  { nameEn: 'Strategic Relationships', nameFr: 'Relations stratégiques' },
  { nameEn: 'Team Collaboration', nameFr: 'Collaboration en équipe' },
  { nameEn: 'Visionary Communication', nameFr: 'Communication visionnaire' },
]

async function seedPathwaysPaths() {
  const existing = await db.select({ id: schema.pathwaysPaths.id }).from(schema.pathwaysPaths).limit(1)
  if (existing.length > 0) {
    console.log('Pathways paths already present — skipping.')
    return
  }
  console.log('Seeding Pathways paths…')
  await db.insert(schema.pathwaysPaths)
    .values(pathwaysPathsSeed.map((p, i) => ({ ...p, sortOrder: i })))
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

  console.log('Reseeding pages…')
  await db.delete(schema.pages)
  await db.insert(schema.pages).values(
    pagesSeed.map(p => ({ ...p, published: true })),
  )

  await seedMeetingRolesAndAgenda()
  await seedExecutivePositions()
  await seedEmailNotifications()
  await seedTestimonials()
  await seedPathwaysPaths()

  console.log('✓ Seed complete.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
