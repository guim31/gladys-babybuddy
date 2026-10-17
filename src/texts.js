// -----------------------------------------------------------------------------
// Texts the integration sends to Gladys outside the widget (src/widgets.js):
// connection status, errors, the "Test the connection" report, scene action
// errors and toasts. Four languages, the four of the Gladys interface; German
// says "du", Spanish "usted". test/i18n.test.js checks every table.
// -----------------------------------------------------------------------------

import { ERROR_KINDS } from './babybuddy/client.js';

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

export const CONNECTION_TEXT = {
  noUrl: {
    en: 'Enter the address of your Baby Buddy in the configuration.',
    fr: "Saisissez l'adresse de votre Baby Buddy dans la configuration.",
    de: 'Gib die Adresse deines Baby Buddy in der Konfiguration ein.',
    es: 'Introduzca la dirección de su Baby Buddy en la configuración.',
  },
  invalidUrl: {
    en: 'Address not understood, e.g. http://192.168.1.20:8000',
    fr: 'Adresse incomprise, ex. http://192.168.1.20:8000',
    de: 'Adresse nicht verstanden, z. B. http://192.168.1.20:8000',
    es: 'Dirección no válida, p. ej. http://192.168.1.20:8000',
  },
  noKey: {
    en: 'Enter the Baby Buddy API key in the configuration (user menu, API key).',
    fr: "Saisissez la clé d'API de Baby Buddy dans la configuration (menu utilisateur, API key).",
    de: 'Gib den API-Schlüssel von Baby Buddy in der Konfiguration ein (Benutzermenü, API key).',
    es: 'Introduzca la clave de API de Baby Buddy en la configuración (menú de usuario, API key).',
  },
};

// One short explanation per error kind (src/babybuddy/client.js).
export const ERROR_TEXT = {
  [ERROR_KINDS.UNREACHABLE]: {
    en: 'Baby Buddy does not answer',
    fr: 'Baby Buddy ne répond pas',
    de: 'Baby Buddy antwortet nicht',
    es: 'Baby Buddy no responde',
  },
  [ERROR_KINDS.TLS]: {
    en: 'certificate refused: tick "Accept self-signed certificates"',
    fr: 'certificat refusé : cochez « Accepter les certificats auto-signés »',
    de: 'Zertifikat abgelehnt: Aktiviere „Selbstsignierte Zertifikate akzeptieren“',
    es: 'certificado rechazado: marque «Aceptar certificados autofirmados»',
  },
  [ERROR_KINDS.AUTH]: {
    en: 'API key refused: copy it again from your Baby Buddy profile',
    fr: "clé d'API refusée : recopiez-la depuis votre profil Baby Buddy",
    de: 'API-Schlüssel abgelehnt: Kopiere ihn erneut aus deinem Baby-Buddy-Profil',
    es: 'clave de API rechazada: cópiela de nuevo desde su perfil de Baby Buddy',
  },
  [ERROR_KINDS.NOT_BABYBUDDY]: {
    en: 'no Baby Buddy API at this address',
    fr: 'aucune API Baby Buddy à cette adresse',
    de: 'keine Baby-Buddy-API unter dieser Adresse',
    es: 'no hay ninguna API de Baby Buddy en esta dirección',
  },
  [ERROR_KINDS.REDIRECT]: {
    en: 'the address redirects: enter the https:// address',
    fr: "l'adresse redirige : saisissez l'adresse en https://",
    de: 'die Adresse leitet um: Gib die https://-Adresse ein',
    es: 'la dirección redirige: introduzca la dirección https://',
  },
  [ERROR_KINDS.RATE_LIMIT]: {
    en: 'too many requests, retrying later',
    fr: 'trop de requêtes, nouvel essai plus tard',
    de: 'zu viele Anfragen, neuer Versuch später',
    es: 'demasiadas solicitudes, se reintentará más tarde',
  },
  [ERROR_KINDS.HTTP]: {
    en: 'unexpected answer, see the logs',
    fr: 'réponse inattendue, voir les logs',
    de: 'unerwartete Antwort, sieh in den Protokollen nach',
    es: 'respuesta inesperada, consulte los registros',
  },
};

// The "Test the connection" report.
export const REPORT_TEXT = {
  en: {
    ok: (children, timers) => `Baby Buddy OK: ${children} child(ren), ${timers} running timer(s).`,
    failed: (reason) => `${withName(reason, 'en')}.`,
  },
  fr: {
    ok: (children, timers) =>
      `Baby Buddy OK : ${children} enfant(s), ${timers} minuteur(s) en cours.`,
    failed: (reason) => `${withName(reason, 'fr')}.`,
  },
  de: {
    ok: (children, timers) => `Baby Buddy OK: ${children} Kind(er), ${timers} laufende(r) Timer.`,
    failed: (reason) => `${withName(reason, 'de')}.`,
  },
  es: {
    ok: (children, timers) =>
      `Baby Buddy OK: ${children} niño(s), ${timers} temporizador(es) en marcha.`,
    failed: (reason) => `${withName(reason, 'es')}.`,
  },
};

// Errors of the scene actions and the widget buttons (shown in Gladys).
export const ACTION_TEXT = {
  notConfigured: {
    en: 'Baby Buddy is not configured.',
    fr: "Baby Buddy n'est pas configuré.",
    de: 'Baby Buddy ist nicht konfiguriert.',
    es: 'Baby Buddy no está configurado.',
  },
  unknownChild: {
    en: 'This child is no longer in Baby Buddy: choose another device.',
    fr: "Cet enfant n'est plus dans Baby Buddy : choisissez un autre appareil.",
    de: 'Dieses Kind ist nicht mehr in Baby Buddy: Wähle ein anderes Gerät.',
    es: 'Este niño ya no está en Baby Buddy: elija otro dispositivo.',
  },
  badField: {
    en: 'Unknown choice in the action: edit the scene.',
    fr: "Choix inconnu dans l'action : modifiez la scène.",
    de: 'Unbekannte Auswahl in der Aktion: Bearbeite die Szene.',
    es: 'Opción desconocida en la acción: modifique la escena.',
  },
  overlap: {
    en: 'Baby Buddy refused: another entry already covers this time. The timer is kept.',
    fr: 'Baby Buddy a refusé : une autre entrée couvre déjà ce moment. Le minuteur est gardé.',
    de: 'Baby Buddy hat abgelehnt: Ein anderer Eintrag deckt diese Zeit schon ab. Der Timer bleibt.',
    es: 'Baby Buddy lo ha rechazado: otra entrada ya cubre este momento. Se conserva el temporizador.',
  },
  refused: {
    en: 'Baby Buddy refused the entry:',
    fr: "Baby Buddy a refusé l'entrée :",
    de: 'Baby Buddy hat den Eintrag abgelehnt:',
    es: 'Baby Buddy ha rechazado la entrada:',
  },
};

// Toasts and scene results (≤ 200 characters). `name` is the child's first name.
export const DONE_TEXT = {
  en: {
    wet: (name) => `Wet diaper logged for ${name}.`,
    solid: (name) => `Dirty diaper logged for ${name}.`,
    both: (name) => `Wet and dirty diaper logged for ${name}.`,
    sleepStarted: (name) => `Sleep timer started for ${name}.`,
    feedingStarted: (name) => `Feeding timer started for ${name}.`,
    sleepStopped: (name, minutes) => `Sleep of ${name} recorded: ${minutes} min.`,
    feedingStopped: (name, minutes) => `Feeding of ${name} recorded: ${minutes} min.`,
    sleepRunning: (name) => `A sleep timer is already running for ${name}.`,
    feedingRunning: (name) => `A feeding timer is already running for ${name}.`,
    sleepNone: (name) => `No sleep timer is running for ${name}.`,
    feedingNone: (name) => `No feeding timer is running for ${name}.`,
  },
  fr: {
    wet: (name) => `Couche mouillée notée pour ${name}.`,
    solid: (name) => `Couche sale notée pour ${name}.`,
    both: (name) => `Couche mouillée et sale notée pour ${name}.`,
    sleepStarted: (name) => `Minuteur de sommeil lancé pour ${name}.`,
    feedingStarted: (name) => `Minuteur de repas lancé pour ${name}.`,
    sleepStopped: (name, minutes) => `Sommeil de ${name} enregistré : ${minutes} min.`,
    feedingStopped: (name, minutes) => `Repas de ${name} enregistré : ${minutes} min.`,
    sleepRunning: (name) => `Un minuteur de sommeil tourne déjà pour ${name}.`,
    feedingRunning: (name) => `Un minuteur de repas tourne déjà pour ${name}.`,
    sleepNone: (name) => `Aucun minuteur de sommeil en cours pour ${name}.`,
    feedingNone: (name) => `Aucun minuteur de repas en cours pour ${name}.`,
  },
  de: {
    wet: (name) => `Nasse Windel für ${name} eingetragen.`,
    solid: (name) => `Volle Windel für ${name} eingetragen.`,
    both: (name) => `Nasse und volle Windel für ${name} eingetragen.`,
    sleepStarted: (name) => `Schlaf-Timer für ${name} gestartet.`,
    feedingStarted: (name) => `Mahlzeit-Timer für ${name} gestartet.`,
    sleepStopped: (name, minutes) => `Schlaf von ${name} eingetragen: ${minutes} Min.`,
    feedingStopped: (name, minutes) => `Mahlzeit von ${name} eingetragen: ${minutes} Min.`,
    sleepRunning: (name) => `Für ${name} läuft schon ein Schlaf-Timer.`,
    feedingRunning: (name) => `Für ${name} läuft schon ein Mahlzeit-Timer.`,
    sleepNone: (name) => `Für ${name} läuft kein Schlaf-Timer.`,
    feedingNone: (name) => `Für ${name} läuft kein Mahlzeit-Timer.`,
  },
  es: {
    wet: (name) => `Pañal mojado registrado para ${name}.`,
    solid: (name) => `Pañal sucio registrado para ${name}.`,
    both: (name) => `Pañal mojado y sucio registrado para ${name}.`,
    sleepStarted: (name) => `Temporizador de sueño iniciado para ${name}.`,
    feedingStarted: (name) => `Temporizador de toma iniciado para ${name}.`,
    sleepStopped: (name, minutes) => `Sueño de ${name} registrado: ${minutes} min.`,
    feedingStopped: (name, minutes) => `Toma de ${name} registrada: ${minutes} min.`,
    sleepRunning: (name) => `Ya hay un temporizador de sueño en marcha para ${name}.`,
    feedingRunning: (name) => `Ya hay un temporizador de toma en marcha para ${name}.`,
    sleepNone: (name) => `No hay ningún temporizador de sueño en marcha para ${name}.`,
    feedingNone: (name) => `No hay ningún temporizador de toma en marcha para ${name}.`,
  },
};

/** "Baby Buddy: <reason>", unless the reason already names Baby Buddy. */
export function withName(reason, language) {
  const text = reason.replace(/\.$/, '');
  if (/^Baby Buddy\b/.test(text)) {
    return text;
  }
  return `Baby Buddy${language === 'fr' ? ' : ' : ': '}${text}`;
}

export const LANGUAGE_FALLBACK = 'en';

export const pick = (text, language) => text[language] ?? text[LANGUAGE_FALLBACK];

/** A multi-language object from a function of the language. */
export const allLanguages = (render) =>
  Object.fromEntries(Object.keys(INIT_FAILED).map((language) => [language, render(language)]));
