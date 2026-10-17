// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `child_summary`.
//
// The use case: the tablet in the nursery, at 3 a.m. One look says how long
// since the last feeding and the last diaper, and whether the baby sleeps; one
// tap notes a diaper or starts / stops the sleep or feeding timer, without
// unlocking a phone.
//
// Budget (8 components, 6 tiles, 1 status, 4 buttons, 2 texts): three tiles
// (since the last feeding, since the last diaper, sleep today), one status
// list (the child's name with sleep, feeding and last diaper) and four
// buttons. Each timer button carries the command it shows ("start" or
// "stop"): a tap on a stale widget never does the opposite. Values, not bound
// to device features, so the widget works before any device is added.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { ACTIVITIES, minutesSince } from './babybuddy/model.js';
import { childIds } from './devices.js';
import { COMMANDS, DIAPER_KINDS, WIDGET_KEY } from './hub.js';
import { pick } from './texts.js';

// Action keys of the buttons: permanent once published (unique, the core
// drops a button whose key is taken).
export const BUTTONS = Object.freeze({
  WET: 'diaper_wet',
  SOLID: 'diaper_solid',
  SLEEP: 'sleep_timer',
  FEEDING: 'feeding_timer',
});

export const TEXT = {
  configure: {
    en: 'Enter the address of your Baby Buddy and its API key in the configuration of the integration.',
    fr: "Saisissez l'adresse de votre Baby Buddy et sa clé d'API dans la configuration de l'intégration.",
    de: 'Gib die Adresse deines Baby Buddy und seinen API-Schlüssel in der Konfiguration der Integration ein.',
    es: 'Introduzca la dirección de su Baby Buddy y su clave de API en la configuración de la integración.',
  },
  noChild: {
    en: 'No child in Baby Buddy yet: add one there first.',
    fr: "Aucun enfant dans Baby Buddy pour l'instant : ajoutez-en un d'abord.",
    de: 'Noch kein Kind in Baby Buddy: Füge dort zuerst eines hinzu.',
    es: 'Todavía no hay ningún niño en Baby Buddy: añada uno primero.',
  },
  unknown: {
    en: 'This child is no longer in Baby Buddy: choose another device in the widget settings.',
    fr: "Cet enfant n'est plus dans Baby Buddy : choisissez un autre appareil dans les réglages du widget.",
    de: 'Dieses Kind ist nicht mehr in Baby Buddy: Wähle ein anderes Gerät in den Widget-Einstellungen.',
    es: 'Este niño ya no está en Baby Buddy: elija otro dispositivo en la configuración del widget.',
  },
  noAnswer: {
    en: 'Baby Buddy does not answer: see the Configuration screen of the integration.',
    fr: "Baby Buddy ne répond pas : voir l'écran Configuration de l'intégration.",
    de: 'Baby Buddy antwortet nicht: Sieh dir die Konfiguration der Integration an.',
    es: 'Baby Buddy no responde: consulte la pantalla de configuración de la integración.',
  },
  stale: {
    en: 'Baby Buddy does not answer: last known values.',
    fr: 'Baby Buddy ne répond pas : dernières valeurs connues.',
    de: 'Baby Buddy antwortet nicht: zuletzt bekannte Werte.',
    es: 'Baby Buddy no responde: últimos valores conocidos.',
  },
  lastFeeding: {
    en: 'Last feeding',
    fr: 'Dernier repas',
    de: 'Letzte Mahlzeit',
    es: 'Última toma',
  },
  lastDiaper: { en: 'Last diaper', fr: 'Dernière couche', de: 'Letzte Windel', es: 'Último pañal' },
  sleepToday: { en: 'Sleep today', fr: "Sommeil aujourd'hui", de: 'Schlaf heute', es: 'Sueño hoy' },
  feeding: { en: 'Feeding', fr: 'Repas', de: 'Mahlzeit', es: 'Toma' },
  diaper: { en: 'Diaper', fr: 'Couche', de: 'Windel', es: 'Pañal' },
  asleepSince: {
    en: 'Asleep since',
    fr: 'Dort depuis',
    de: 'Schläft seit',
    es: 'Duerme desde',
  },
  awake: { en: 'Awake', fr: 'Éveillé', de: 'Wach', es: 'Despierto' },
  inProgressSince: {
    en: 'In progress since',
    fr: 'En cours depuis',
    de: 'Läuft seit',
    es: 'En curso desde',
  },
  lastAt: { en: 'Last at', fr: 'Dernier à', de: 'Zuletzt um', es: 'Última a las' },
  none: { en: 'None yet', fr: 'Aucun', de: 'Noch keine', es: 'Ninguno' },
  wet: { en: 'Wet', fr: 'Mouillée', de: 'Nass', es: 'Mojado' },
  solid: { en: 'Dirty', fr: 'Sale', de: 'Voll', es: 'Sucio' },
  both: { en: 'Wet and dirty', fr: 'Mouillée et sale', de: 'Nass und voll', es: 'Mojado y sucio' },
  wetButton: { en: 'Wet diaper', fr: 'Couche mouillée', de: 'Nasse Windel', es: 'Pañal mojado' },
  solidButton: { en: 'Dirty diaper', fr: 'Couche sale', de: 'Volle Windel', es: 'Pañal sucio' },
  startSleep: {
    en: 'Start sleep',
    fr: 'Début sommeil',
    de: 'Schlaf starten',
    es: 'Iniciar sueño',
  },
  stopSleep: { en: 'Woke up', fr: 'Réveil', de: 'Aufgewacht', es: 'Despertó' },
  startFeeding: {
    en: 'Start feeding',
    fr: 'Début repas',
    de: 'Mahlzeit starten',
    es: 'Iniciar toma',
  },
  stopFeeding: { en: 'End feeding', fr: 'Fin repas', de: 'Mahlzeit beenden', es: 'Terminar toma' },
};

const t = (text, language) => pick(text, language);

function message(text, language) {
  return {
    ttl_seconds: 300,
    components: [{ type: 'text', variant: 'body', text: t(text, language) }],
  };
}

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

function formatTime(hub, ms, language) {
  return new Intl.DateTimeFormat(LOCALES[language] ?? 'en-GB', {
    timeZone: hub.timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

/** "45 min", "2 h 05", "99+ h": a duration in a tile (12 characters at most). */
export function formatMinutes(total) {
  if (total < 60) {
    return `${total} min`;
  }
  const hours = Math.floor(total / 60);
  if (hours > 99) {
    return '99+ h';
  }
  return `${hours} h ${String(total % 60).padStart(2, '0')}`;
}

const tile = (value, label, icon, color = WIDGET_COLORS.NEUTRAL) => ({
  type: 'value',
  value,
  label,
  icon,
  color,
});

/** The child shown: the one chosen in the settings, or the first one. */
function chosenChild(hub, settings) {
  const device = settings?.device || null;
  if (!device) {
    return { child: hub.children[0] ?? null, unknown: false };
  }
  const child = hub.childOf(device);
  return { child, unknown: !child };
}

async function get(hub, { settings, language = 'en' }) {
  if (!hub.client) {
    return message(TEXT.configure, language);
  }
  if (hub.error && hub.readAt === 0) {
    return message(TEXT.noAnswer, language);
  }
  const { child, unknown } = chosenChild(hub, settings);
  if (unknown) {
    return message(TEXT.unknown, language);
  }
  if (!child) {
    return message(TEXT.noChild, language);
  }
  const now = hub.now();
  const s = hub.summary(child.id, now);
  const components = [];
  if (hub.error) {
    components.push({ type: 'text', variant: 'caption', text: t(TEXT.stale, language) });
  }
  const sinceFeeding = s.lastFeeding ? minutesSince(s.lastFeeding.endAt, now) : null;
  const sinceChange = s.lastChange ? minutesSince(s.lastChange.at, now) : null;
  components.push(
    tile(
      s.feedingTimer ? '…' : sinceFeeding === null ? '–' : formatMinutes(sinceFeeding),
      t(TEXT.lastFeeding, language),
      'coffee',
    ),
    tile(
      sinceChange === null ? '–' : formatMinutes(sinceChange),
      t(TEXT.lastDiaper, language),
      'droplet',
    ),
    tile(formatMinutes(s.sleepTodayMinutes), t(TEXT.sleepToday, language), 'moon'),
  );

  const diaperKind = s.lastChange
    ? s.lastChange.wet && s.lastChange.solid
      ? TEXT.both
      : s.lastChange.solid
        ? TEXT.solid
        : TEXT.wet
    : null;
  components.push({
    type: 'status',
    items: [
      {
        label: child.firstName.slice(0, 40),
        icon: s.sleepTimer ? 'moon' : 'sun',
        value: s.sleepTimer
          ? `${t(TEXT.asleepSince, language)} ${formatTime(hub, s.sleepTimer.startAt, language)}`
          : t(TEXT.awake, language),
        color: s.sleepTimer ? WIDGET_COLORS.INFO : WIDGET_COLORS.NEUTRAL,
      },
      {
        label: t(TEXT.feeding, language),
        icon: 'coffee',
        value: s.feedingTimer
          ? `${t(TEXT.inProgressSince, language)} ${formatTime(hub, s.feedingTimer.startAt, language)}`
          : s.lastFeeding
            ? `${t(TEXT.lastAt, language)} ${formatTime(hub, s.lastFeeding.endAt, language)}`
            : t(TEXT.none, language),
        color: s.feedingTimer ? WIDGET_COLORS.INFO : WIDGET_COLORS.NEUTRAL,
      },
      {
        label: t(TEXT.diaper, language),
        icon: 'droplet',
        value: s.lastChange
          ? `${t(diaperKind, language)} · ${formatTime(hub, s.lastChange.at, language)}`
          : t(TEXT.none, language),
        color: WIDGET_COLORS.NEUTRAL,
      },
    ],
  });

  if (!hub.error) {
    const params = { child: child.id };
    const timerButton = (key, timer, startLabel, stopLabel, icons) => ({
      type: 'button',
      label: t(timer ? stopLabel : startLabel, language),
      icon: timer ? icons[1] : icons[0],
      style: 'secondary',
      action: { key, params: { ...params, command: timer ? COMMANDS.STOP : COMMANDS.START } },
    });
    components.push(
      {
        type: 'button',
        label: t(TEXT.wetButton, language),
        icon: 'droplet',
        style: 'secondary',
        action: { key: BUTTONS.WET, params },
      },
      {
        type: 'button',
        label: t(TEXT.solidButton, language),
        icon: 'trash-2',
        style: 'secondary',
        action: { key: BUTTONS.SOLID, params },
      },
      timerButton(BUTTONS.SLEEP, s.sleepTimer, TEXT.startSleep, TEXT.stopSleep, ['moon', 'sun']),
      timerButton(BUTTONS.FEEDING, s.feedingTimer, TEXT.startFeeding, TEXT.stopFeeding, [
        'play',
        'square',
      ]),
    );
  }
  // The minutes move: content valid for one minute.
  return { ttl_seconds: 60, components };
}

async function action(hub, { actionKey, params = {} }) {
  if (!Number.isInteger(params.child)) {
    throw new Error(`Unknown action ${actionKey}`);
  }
  const device = childIds(hub.gladys, params.child).device;
  switch (actionKey) {
    case BUTTONS.WET:
      return { message: (await hub.logDiaper(device, DIAPER_KINDS.WET)).message };
    case BUTTONS.SOLID:
      return { message: (await hub.logDiaper(device, DIAPER_KINDS.SOLID)).message };
    case BUTTONS.SLEEP:
    case BUTTONS.FEEDING: {
      if (![COMMANDS.START, COMMANDS.STOP].includes(params.command)) {
        throw new Error(`Unknown command ${params.command}`);
      }
      const activity = actionKey === BUTTONS.SLEEP ? ACTIVITIES.SLEEP : ACTIVITIES.FEEDING;
      return { message: (await hub.activity(device, activity, params.command)).message };
    }
    default:
      throw new Error(`Unknown action ${actionKey}`);
  }
}

export const WIDGETS = {
  [WIDGET_KEY]: { get, action },
};
