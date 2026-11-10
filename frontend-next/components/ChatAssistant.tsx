import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { sendAssistantMessage, listCatsForPerson, updatePerson, AssistantSource } from '../lib/api';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sources?: AssistantSource[];
  suggestedCatIds?: string[];
  matchesReady?: boolean;
}

interface ChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
}

const QUICK_PROMPTS = [
  'Vivo en un piso',
  'Vivo en una casa',
  'Tengo niños en casa',
  'Convivo con perro u otra mascota',
];

type Preferences = Record<string, string | boolean | string[]>;

interface ProgressiveTopic {
  key: string;
  question: string;
}

function getNextTopicQuestion(prefs: Preferences): ProgressiveTopic | null {
  if (!prefs.home_type) {
    return {
      key: 'home_type',
      question: '¿Cómo es tu vivienda? ¿Vives en un piso o en una casa?',
    };
  }
  if (prefs.has_children === undefined) {
    return {
      key: 'children',
      question: '¿Hay niños o niñas conviviendo habitualmente en tu hogar?',
    };
  }
  if (prefs.has_other_pets === undefined) {
    return {
      key: 'pets',
      question: '¿Convives actualmente con perros, otros gatos u otra mascota en casa?',
    };
  }
  if (!prefs.activity_level) {
    return {
      key: 'activity',
      question: '¿Qué ritmo de vida tenéis en casa? ¿Buscáis un gato más bien tranquilo y sosegado, o activo y juguetón?',
    };
  }
  if (!prefs.preferred_cat_traits || (prefs.preferred_cat_traits as string[]).length === 0) {
    return {
      key: 'traits',
      question: '¿Qué rasgos de personalidad te gustaría que tuviera tu gato ideal? (por ejemplo: cariñoso y mimoso, independiente, sociable, curioso...)',
    };
  }
  if (!prefs.location) {
    return {
      key: 'location',
      question: '¿En qué ciudad o localidad vives? Así podremos tener en cuenta la cercanía.',
    };
  }
  return null;
}

function countCollectedPreferences(prefs: Preferences): number {
  let count = 0;
  if (prefs.home_type) count++;
  if (prefs.has_children !== undefined) count++;
  if (prefs.has_other_pets !== undefined) count++;
  if (prefs.activity_level) count++;
  if (prefs.location) count++;
  if (Array.isArray(prefs.preferred_cat_traits) && prefs.preferred_cat_traits.length > 0) count++;
  return count;
}

function readSavedPreferences(): Preferences {
  const raw = typeof window !== 'undefined' ? localStorage.getItem('catmatch_profile_draft') : null;
  if (!raw) return {};
  try {
    const draft: unknown = JSON.parse(raw);
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
      return {};
    }
    return { ...(draft as Preferences) };
  } catch {
    return {};
  }
}

function detectTopicFromAssistantText(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes('perro') || t.includes('mascota') || t.includes('animal') || t.includes('otros gatos')) {
    return 'pets';
  }
  if (t.includes('niñ') || t.includes('peque') || t.includes('hijo')) {
    return 'children';
  }
  if (t.includes('vivienda') || t.includes('piso') || t.includes('casa')) {
    return 'home_type';
  }
  if (t.includes('ritmo') || t.includes('actividad') || (t.includes('tranquilo') && t.includes('activo'))) {
    return 'activity';
  }
  if (t.includes('rasgos') || t.includes('carácter') || t.includes('personalidad')) {
    return 'traits';
  }
  if (t.includes('ciudad') || t.includes('localidad')) {
    return 'location';
  }
  return null;
}

function parseUserAnswerForTopic(userText: string, topic: string | null, currentPrefs: Preferences): Preferences {
  const t = userText.trim().toLowerCase();
  const updated: Preferences = { ...currentPrefs };

  const isExplicitNegative =
    /^(no|ninguno|ninguna|ningunos|ningunas|tampoco|para nada|nada|que va|no hay|no tenemos|no convivo|no viven|cero|sin mascotas?|sin animales?|sin niñ[oa]s?)$/i.test(t) ||
    /^(no[\s,\.]+)+/i.test(t);
  const isExplicitPositive =
    /^(s[ií]|claro|por supuesto|efectivamente|afirmativo|exacto|tenemos|tengo)$/i.test(t) ||
    /^(s[ií][\s,\.]+)+/i.test(t);

  // 1. Si el tema anterior fue niños:
  if (topic === 'children') {
    if (
      isExplicitNegative ||
      /(sin|no tengo|no tenemos|no hay|no convivo|no viven)\b.*?(niñ[oa]s?|hij[oa]s?|peques?)/i.test(t) ||
      /\b(sin niños|sin ninos|no niños|no ninos|no hay niños|no hay ninos)\b/i.test(t)
    ) {
      updated.has_children = false;
    } else if (
      isExplicitPositive ||
      /(tengo|tenemos|hay|con|convivo|vivimos|somos)\b.*?(niñ[oa]s?|hij[oa]s?|peques?|beb[eé]s?)/i.test(t) ||
      /\b(con niños|con ninos)\b/i.test(t) ||
      /\b(uno|dos|tres|\d+)\s*(niñ|hij|peque)/i.test(t)
    ) {
      updated.has_children = true;
    }
  }

  // 2. Si el tema anterior fue mascotas:
  if (topic === 'pets') {
    if (
      isExplicitNegative ||
      /(sin|no tengo|no tenemos|no hay|no convivo)\b.*?(perr[oa]s?|mascotas?|animales?)/i.test(t) ||
      /\b(sin perro|sin perros|sin mascota|sin mascotas|no perro|no perros|no mascota|no mascotas|ninguna mascota|ningun perro)\b/i.test(t)
    ) {
      updated.has_other_pets = false;
    } else if (
      isExplicitPositive ||
      /(tengo|tenemos|hay|con|convivo|vivo|vivimos)\b.*?(perr[oa]s?|mascotas?|canes?|otros? animal|otros? gatos?)/i.test(t) ||
      /\b(con perro|con perros|con mascota|con mascotas|tengo un perro|tengo un gato|un perro|dos perros|un gato|dos gatos|gatos?|perros?)\b/i.test(t)
    ) {
      updated.has_other_pets = true;
    }
  }

  // 3. Tipo de vivienda (si se preguntó vivienda o si aparece explícitamente):
  if (topic === 'home_type' || !updated.home_type) {
    if (t.includes('piso') || t.includes('apartamento') || t.includes('estudio') || t.includes('ático') || t.includes('atico')) {
      updated.home_type = 'apartment';
    } else if (t.includes('casa') || t.includes('chalet') || t.includes('finca') || t.includes('jardín') || t.includes('jardin') || t.includes('adosado')) {
      updated.home_type = 'house';
    }
  }

  // 4. Nivel de actividad:
  if (topic === 'activity' || !updated.activity_level) {
    if (t.includes('tranquil') || t.includes('calmad') || t.includes('sosegad') || t.includes('poco activ') || t.includes('sedentari') || t.includes('relax')) {
      updated.activity_level = 'low';
    } else if (t.includes('activ') || t.includes('juguet') || t.includes('enérgic') || t.includes('energic') || t.includes('dinámic') || t.includes('dinamic')) {
      updated.activity_level = 'high';
    } else if (t.includes('moderad') || t.includes('medio') || t.includes('normal') || t.includes('equilibrad')) {
      updated.activity_level = 'medium';
    }
  }

  // 5. Rasgos de personalidad (en cualquier momento):
  const traits: string[] = Array.isArray(updated.preferred_cat_traits) ? [...updated.preferred_cat_traits] : [];
  if (t.includes('tranquil') || t.includes('calm')) { if (!traits.includes('tranquilo')) traits.push('tranquilo'); }
  if (t.includes('cariños') || t.includes('carinos') || t.includes('mimos')) { if (!traits.includes('cariñoso')) traits.push('cariñoso'); }
  if (t.includes('sociabl') || t.includes('amigabl')) { if (!traits.includes('sociable')) traits.push('sociable'); }
  if (t.includes('juguet') || t.includes('activo')) { if (!traits.includes('juguetón')) traits.push('juguetón'); }
  if (t.includes('independient')) { if (!traits.includes('independiente')) traits.push('independiente'); }
  if (traits.length > 0) updated.preferred_cat_traits = traits;

  // 6. Ciudades (en cualquier momento):
  const cities = [
    'barcelona', 'madrid', 'valencia', 'sevilla', 'zaragoza',
    'malaga', 'murcia', 'palma', 'bilbao', 'alicante', 'cordoba',
    'valladolid', 'vigo', 'gijon', 'hospitalet', 'sant miquel de balanya'
  ];
  for (const c of cities) {
    if (t.includes(c)) {
      updated.location = c.charAt(0).toUpperCase() + c.slice(1);
      break;
    }
  }

  // 7. Detección directa en texto si no está establecido y el texto contiene términos explícitos:
  if (updated.has_children === undefined) {
    if (
      /(sin|no tengo|no tenemos|no hay|no convivo)\b.*?(niñ[oa]s?|hij[oa]s?|peques?)/i.test(t) ||
      /\b(sin niños|sin ninos|no niños|no ninos|no hay niños)\b/i.test(t)
    ) {
      updated.has_children = false;
    } else if (
      /(tengo|tenemos|hay|con|convivo|vivimos|somos)\b.*?(niñ[oa]s?|hij[oa]s?|peques?|beb[eé]s?)/i.test(t) ||
      /\b(con niños|con ninos)\b/i.test(t)
    ) {
      updated.has_children = true;
    }
  }

  if (updated.has_other_pets === undefined) {
    if (
      /(sin|no tengo|no tenemos|no hay|no convivo)\b.*?(perr[oa]s?|mascotas?|animales?)/i.test(t) ||
      /\b(sin perro|sin perros|sin mascota|sin mascotas|no perro|no perros|no mascota|no mascotas)\b/i.test(t)
    ) {
      updated.has_other_pets = false;
    } else if (
      /(tengo|tenemos|hay|con|convivo|vivo|vivimos)\b.*?(perr[oa]s?|mascotas?|canes?|otros? animal|otros? gatos?)/i.test(t) ||
      /\b(con perro|con perros|con mascota|con mascotas|tengo un perro|tengo un gato)\b/i.test(t)
    ) {
      updated.has_other_pets = true;
    }
  }

  return updated;
}

function extractPreferencesFromMessages(messages: Message[]): Preferences {
  let prefs: Preferences = {};

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.sender === 'user') {
      let lastAssistantText = '';
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j].sender === 'assistant') {
          lastAssistantText = messages[j].text;
          break;
        }
      }
      const topic = detectTopicFromAssistantText(lastAssistantText);
      prefs = parseUserAnswerForTopic(msg.text, topic, prefs);
    }
  }

  return prefs;
}

function doesMessageAddInformation(prevPrefs: Preferences, newPrefs: Preferences): boolean {
  for (const key of Object.keys(newPrefs)) {
    if (prevPrefs[key] === undefined) return true;
    if (Array.isArray(newPrefs[key]) && Array.isArray(prevPrefs[key])) {
      const newArr = newPrefs[key] as string[];
      const prevArr = prevPrefs[key] as string[];
      if (newArr.some(item => !prevArr.includes(item))) return true;
    } else if (newPrefs[key] !== prevPrefs[key]) {
      return true;
    }
  }
  return false;
}

function countUsefulAnswers(messages: Message[]): number {
  let count = 0;
  let accumulatedPrefs: Preferences = {};
  const userIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].sender === 'user') userIndices.push(i);
  }

  for (const idx of userIndices) {
    const subset = messages.slice(0, idx + 1);
    const nextAccum = extractPreferencesFromMessages(subset);
    if (doesMessageAddInformation(accumulatedPrefs, nextAccum)) {
      count++;
      accumulatedPrefs = nextAccum;
    }
  }

  return count;
}

function isGeneralInquiry(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('?') ||
    /\b(c[oó]mo|qu[eé]|cu[aá]ndo|d[oó]nde|cu[aá]nto|por qu[eé]|porque|requisito|requisitos|proceso|tr[aá]mite|adopci[oó]n|vacuna|vacunas|chip|coste|precio|tasa|pauta|pautas|consejo|consejos|adaptaci[oó]n|veterinari[oa]|salud|enfermedad|ventana|ventanas|protecci[oó]n|red|redes|visita|visitas|contrato)\b/i.test(t)
  );
}

function buildEmpatheticAcknowledgment(newPrefs: Preferences, prevPrefs: Preferences): string {
  const acks: string[] = [];

  if (newPrefs.home_type && prevPrefs.home_type !== newPrefs.home_type) {
    if (newPrefs.home_type === 'apartment') {
      acks.push('¡Entendido! Un piso puede ser un hogar ideal para un gato, asegurando rascadores y ventanas bien protegidas.');
    } else {
      acks.push('¡Genial! Una casa ofrece mucho espacio y tranquilidad para que un felino se sienta a gusto.');
    }
  }

  if (newPrefs.has_children !== undefined && prevPrefs.has_children !== newPrefs.has_children) {
    if (newPrefs.has_children) {
      acks.push('¡Qué bien! Con niños en casa es clave buscar gatos sociables, pacientes y con buena tolerancia al juego.');
    } else {
      acks.push('¡Anotado! Un hogar sin peques permite considerar gatos más tímidos o que prefieren un ambiente tranquilo.');
    }
  }

  if (newPrefs.has_other_pets !== undefined && prevPrefs.has_other_pets !== newPrefs.has_other_pets) {
    if (newPrefs.has_other_pets) {
      acks.push('¡Dato muy importante! Al haber otras mascotas, priorizaremos gatos con convivencia positiva demostrada.');
    } else {
      acks.push('¡Perfecto! Al no haber otros animales en casa, el gato podrá adaptarse a su propio ritmo sin estrés.');
    }
  }

  if (newPrefs.activity_level && prevPrefs.activity_level !== newPrefs.activity_level) {
    if (newPrefs.activity_level === 'low') {
      acks.push('¡Totalmente de acuerdo! Un compañero sosegado y tranquilo encajará de maravilla con un ritmo de vida relajado.');
    } else if (newPrefs.activity_level === 'high') {
      acks.push('¡Estupendo! Un gato juguetón y activo llenará la casa de alegría y dinamismo.');
    } else {
      acks.push('¡Anotado! Un nivel de actividad moderado es muy versátil y se adapta muy bien al día a día.');
    }
  }

  if (newPrefs.location && prevPrefs.location !== newPrefs.location) {
    acks.push(`¡Perfecto! Tener en cuenta ${newPrefs.location} nos permite valorar la proximidad con el refugio.`);
  }

  if (Array.isArray(newPrefs.preferred_cat_traits) && newPrefs.preferred_cat_traits.length > 0) {
    const prevTraits = Array.isArray(prevPrefs.preferred_cat_traits) ? prevPrefs.preferred_cat_traits : [];
    const addedTraits = (newPrefs.preferred_cat_traits as string[]).filter(t => !prevTraits.includes(t));
    if (addedTraits.length > 0) {
      acks.push(`¡Tomo nota de esos rasgos (${addedTraits.join(', ')})! El carácter es esencial para una convivencia feliz.`);
    }
  }

  return acks.join(' ');
}

function renderFormattedMessage(text: string) {
  // Parsea enlaces Markdown [Texto](url) y negritas **texto**
  const regex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // Enlace Markdown [label](url)
      const label = match[1];
      const url = match[2];
      elements.push(
        <Link key={match.index} href={url} className="assistant-bubble-link">
          {label}
        </Link>
      );
    } else if (match[3]) {
      // Negrita **texto**
      elements.push(
        <strong key={match.index}>{match[3]}</strong>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
}

export default function ChatAssistant({ isOpen, onClose, isMinimized = false, onMinimize }: ChatAssistantProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '¡Hola! Te doy la bienvenida a **Matcher Assistant** 🐾\n\nEstoy aquí para ayudarte a encontrar al compañero felino ideal para tu hogar y resolver cualquier duda que tengas sobre la adopción responsable.\n\nPara empezar a conocerte poquito a poco, cuéntame: **¿cómo es tu vivienda? ¿Vives en un piso o en una casa?**',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resultsReady, setResultsReady] = useState(false);
  const [hasSavedPreferences, setHasSavedPreferences] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usefulAnswersCount, setUsefulAnswersCount] = useState(0);
  const [decisionDismissed, setDecisionDismissed] = useState(false);
  const [nextMatchThreshold, setNextMatchThreshold] = useState(3);
  const messagesRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const busy = loading || searching;

  const scrollToBottom = () => {
    const container = messagesRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized, loading, searching, error]);

  useEffect(() => {
    if (!isOpen || isMinimized) return;
    try {
      setHasSavedPreferences(
        Object.keys(readSavedPreferences()).length > 0 ||
        Boolean(localStorage.getItem('catmatch_person_id'))
      );
    } catch (err) {
      console.warn('Error reading conversation preferences', err);
      setError('No he podido leer tus preferencias guardadas en el navegador.');
    }
  }, [isOpen, isMinimized]);

  const prepareMatches = async (conversation: Message[]) => {
    setSearching(true);
    setResultsReady(false);
    try {
      const extracted = extractPreferencesFromMessages(conversation);
      const updatedDraft = { ...readSavedPreferences(), ...extracted };
      const storedPersonId = typeof window !== 'undefined' ? localStorage.getItem('catmatch_person_id') : null;

      if (Object.keys(extracted).length > 0) {
        localStorage.setItem('catmatch_profile_draft', JSON.stringify(updatedDraft));
        if (storedPersonId) {
          // Results prioritizes the saved person ID over the local draft.
          await updatePerson(storedPersonId, extracted);
        }
      }

      const minDuration = new Promise(resolve => setTimeout(resolve, 3000));
      const searchPromise = listCatsForPerson(storedPersonId
        ? { person_id: storedPersonId }
        : { person: updatedDraft });

      const [matches] = await Promise.all([searchPromise, minDuration]);
      if (!Array.isArray(matches)) {
        throw new Error('La búsqueda no ha devuelto una lista de matches válida.');
      }

      setHasSavedPreferences(Object.keys(updatedDraft).length > 0 || Boolean(storedPersonId));
      setResultsReady(true);
      setMessages(prev => [
        ...prev.filter(m => !m.matchesReady),
        {
          id: `matches-${Date.now()}`,
          sender: 'assistant',
          text: matches.length > 0
            ? '¡Tus matches están listos! 🐾\nHemos encontrado los gatos que mejor encajan con tu hogar. Pulsa el botón para verlos con su grado de afinidad.'
            : '¡Tus matches están listos! 🐾\nEn este momento no hay gatos disponibles con ese perfil. Puedes consultar el catálogo general o ajustar tus preferencias.',
          matchesReady: true,
        },
      ]);
    } finally {
      setSearching(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || busyRef.current) return;

    busyRef.current = true;
    setError(null);
    setResultsReady(false);

    const userMsgId = String(Date.now());
    const newMessages: Message[] = [
      ...messages.filter(m => !m.matchesReady),
      { id: userMsgId, sender: 'user', text },
    ];
    setMessages(newMessages);
    if (!textToSend) setInputValue('');
    setLoading(true);

    // Preferencias extraídas antes y después de este mensaje
    const prefsBefore = extractPreferencesFromMessages(messages);
    const prefsAfter = extractPreferencesFromMessages(newMessages);

    // Contabilizar respuestas útiles reales: solo mensajes del usuario que aporten información real
    const updatedUsefulCount = countUsefulAnswers(newMessages);
    setUsefulAnswersCount(updatedUsefulCount);

    // Actualizar borrador en localStorage de forma continua para preservar datos
    try {
      const mergedDraft = { ...readSavedPreferences(), ...prefsAfter };
      if (Object.keys(mergedDraft).length > 0) {
        localStorage.setItem('catmatch_profile_draft', JSON.stringify(mergedDraft));
        setHasSavedPreferences(true);
      }
    } catch (e) {
      console.warn('Error saving draft in ChatAssistant', e);
    }

    try {
      const history = newMessages
        .filter(m => m.id !== 'welcome' && !m.matchesReady)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        }));

      const res = await sendAssistantMessage(text, history);

      // Decisión recurrente del usuario:
      // Primera oferta a las 3 respuestas útiles; siguientes ofertas cada 2 respuestas útiles nuevas (3, 5, 7, 9...)
      const shouldOfferDecision = updatedUsefulCount >= nextMatchThreshold;

      let replyText = '';

      if (isGeneralInquiry(text)) {
        // Consulta del usuario sobre adopción, cuidados o salud: responder con RAG oficial
        replyText = res.response.replace(/•\s*\*\*[^*]+\*\*.*?(?=(\n\n|$))/gs, '').trim();
        if (!shouldOfferDecision) {
          const nextTopic = getNextTopicQuestion(prefsAfter);
          if (nextTopic && !replyText.includes('?')) {
            replyText += `\n\nCuando quieras seguir buscando tu gato ideal, cuéntame: **${nextTopic.question}**`;
          }
        }
      } else {
        // El usuario está compartiendo información sobre su hogar y circunstancias
        const ack = buildEmpatheticAcknowledgment(prefsAfter, prefsBefore);
        const nextTopic = getNextTopicQuestion(prefsAfter);

        if (shouldOfferDecision) {
          replyText = ack
            ? `${ack}\n\n¡Hemos reunido nueva información muy valiosa sobre tu hogar!`
            : '¡Hemos reunido nueva información muy valiosa sobre tu hogar!';
        } else {
          if (ack && nextTopic) {
            replyText = `${ack}\n\n${nextTopic.question}`;
          } else if (nextTopic) {
            replyText = nextTopic.question;
          } else if (ack) {
            replyText = `${ack}\n\n¿Hay algún otro detalle de tu estilo de vida que quieras compartir?`;
          } else {
            replyText = res.response.replace(/•\s*\*\*[^*]+\*\*.*?(?=(\n\n|$))/gs, '').trim() || '¡Anotado!';
          }
        }
      }

      // Filtrar fuentes oficiales: antes de los matches NUNCA mostrar fuentes de tipo cat_profile
      const filteredSources = (res.sources || []).filter(s => s.source_type === 'shelter_guide');

      const conversation: Message[] = [
        ...newMessages,
        {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: replyText,
          sources: filteredSources,
          suggestedCatIds: res.suggested_cat_ids,
        },
      ];

      setMessages(conversation);
      setLoading(false);

      if (shouldOfferDecision) {
        setNextMatchThreshold(updatedUsefulCount + 2);
        setDecisionDismissed(false);
        try {
          await prepareMatches(conversation);
        } catch (err) {
          console.warn('Error preparing conversation matches', err);
          setError('No he podido preparar tus matches en este momento. Inténtalo de nuevo.');
        }
      }
    } catch (err) {
      console.warn('Error contacting conversation assistant', err);
      setError('No he podido conectar con Matcher Assistant en este momento. Inténtalo de nuevo.');
      setLoading(false);
    } finally {
      busyRef.current = false;
    }
  };

  const handleSearch = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    try {
      await prepareMatches(messages);
    } catch (err) {
      console.warn('Error preparing saved matches', err);
      setError('No he podido preparar tus matches en este momento. Inténtalo de nuevo.');
    } finally {
      busyRef.current = false;
    }
  };

  const handleKeepTalking = () => {
    if (busyRef.current) return;
    setDecisionDismissed(true);
    setResultsReady(false);

    const extracted = extractPreferencesFromMessages(messages);
    const updatedDraft = { ...readSavedPreferences(), ...extracted };
    const nextTopic = getNextTopicQuestion(updatedDraft);

    const followUpText = nextTopic
      ? `¡Perfecto, seguimos hablando! Cuantos más detalles conozcamos, más afinada será la compatibilidad.\n\n${nextTopic.question}`
      : '¡Perfecto, seguimos hablando! Ya hemos repasado los aspectos principales de tu hogar y convivencia. Cuéntame cualquier otra duda o detalle sobre lo que buscas en tu compañero felino.';

    setMessages(prev => [
      ...prev,
      {
        id: `continue-${Date.now()}`,
        sender: 'assistant',
        text: followUpText,
      },
    ]);
  };

  const handleGoToResults = async () => {
    if (busyRef.current) return;
    setError(null);
    try {
      if (await router.push('/adopt/results')) onClose();
      else setError('La navegación se ha cancelado. Pulsa de nuevo en «Ir a tus matches».');
    } catch (err) {
      console.warn('Error opening match results', err);
      setError('No he podido abrir tus matches en este momento. Inténtalo de nuevo.');
    }
  };

  const handleChangePreferences = () => {
    if (busyRef.current) return;
    setResultsReady(false);
    setConfirmingReset(false);
    setError(null);

    const currentDraft = readSavedPreferences();
    const summaryParts: string[] = [];
    if (currentDraft.location) summaryParts.push(String(currentDraft.location));
    if (currentDraft.home_type === 'apartment') summaryParts.push('piso');
    else if (currentDraft.home_type === 'house') summaryParts.push('casa');
    if (currentDraft.has_children === true) summaryParts.push('con niños');
    else if (currentDraft.has_children === false) summaryParts.push('sin niños');
    if (currentDraft.has_other_pets === true) summaryParts.push('con mascotas');
    else if (currentDraft.has_other_pets === false) summaryParts.push('sin mascotas');
    if (currentDraft.activity_level === 'low') summaryParts.push('tranquilo');
    else if (currentDraft.activity_level === 'high') summaryParts.push('activo');
    else if (currentDraft.activity_level === 'medium') summaryParts.push('actividad media');

    const summaryText = summaryParts.length > 0
      ? `Tengo anotado: ${summaryParts.join(' · ')}.\n\n`
      : '';

    setMessages(prev => [
      ...prev.filter(m => !m.matchesReady),
      {
        id: `change-${Date.now()}`,
        sender: 'assistant',
        text: `${summaryText}¿Qué te gustaría cambiar? Puedes indicarme tu nueva vivienda, convivencia o actividad y actualizaré tus matches.`,
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleResetConversation = () => {
    if (busyRef.current) return;
    try {
      localStorage.removeItem('catmatch_profile_draft');
    } catch (e) {
      console.warn('Error clearing profile draft from localStorage', e);
    }

    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: '¡Hola! Te doy la bienvenida a **Matcher Assistant** 🐾\n\nEstoy aquí para ayudarte a encontrar al compañero felino ideal para tu hogar y resolver cualquier duda que tengas sobre la adopción responsable.\n\nPara empezar a conocerte poquito a poco, cuéntame: **¿cómo es tu vivienda? ¿Vives en un piso o en una casa?**',
      },
    ]);
    setInputValue('');
    setLoading(false);
    setSearching(false);
    setResultsReady(false);
    setHasSavedPreferences(false);
    setConfirmingReset(false);
    setError(null);
    setUsefulAnswersCount(0);
    setNextMatchThreshold(3);
    setDecisionDismissed(false);
    busyRef.current = false;
  };

  const currentUsefulCount = countUsefulAnswers(messages);

  // El botón persistente «Ir a tus matches» NUNCA se muestra antes de alcanzar
  // el mínimo obligatorio de 3 respuestas útiles y solo si el usuario decidió seguir hablando
  const canSearch = currentUsefulCount >= 3 && decisionDismissed;

  // The component stays mounted while minimized, so the conversation state is preserved.
  if (!isOpen || isMinimized) return null;

  return (
    <div
      className="assistant-panel"
      role="dialog"
      aria-labelledby="assistant-title"
      aria-modal="false"
    >
      <header className="assistant-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>🐱</span>
          <h3 id="assistant-title" className="assistant-title">Matcher Assistant</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="assistant-close-btn"
              aria-label="Minimizar Matcher Assistant"
              title="Minimizar"
            >
              —
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="assistant-close-btn"
            aria-label="Cerrar Matcher Assistant"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="assistant-messages" ref={messagesRef} role="log" aria-label="Conversación con Matcher Assistant" aria-live="polite">
        {messages.map(m => (
          <div
            key={m.id}
            className={`assistant-msg ${m.sender === 'user' ? 'assistant-msg-user' : 'assistant-msg-bot'}`}
          >
            <div
              className={`assistant-bubble ${m.matchesReady ? 'assistant-bubble-matches' : ''}`}
              style={{ whiteSpace: 'pre-line' }}
            >
              {renderFormattedMessage(m.text)}
              {m.matchesReady && resultsReady && !busy && (
                <div className="assistant-matches-actions">
                  <button
                    type="button"
                    onClick={handleGoToResults}
                    className="btn btn-primary btn-sm assistant-results-button"
                  >
                    Ir a tus matches →
                  </button>

                  <div className="assistant-matches-secondary-actions">
                    <button
                      type="button"
                      onClick={handleKeepTalking}
                      className="btn btn-secondary btn-sm assistant-btn-change"
                    >
                      Seguir hablando
                    </button>
                    {!confirmingReset ? (
                      <>
                        <button
                          type="button"
                          onClick={handleChangePreferences}
                          className="btn btn-secondary btn-sm assistant-btn-change"
                        >
                          ✎ Cambiar mis preferencias
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingReset(true)}
                          className="assistant-link-reset"
                        >
                          ↺ Empezar de nuevo
                        </button>
                      </>
                    ) : (
                      <div className="assistant-reset-confirm" role="alert">
                        <span className="assistant-reset-confirm-text">
                          ¿Borrar conversación y preferencias?
                        </span>
                        <div className="assistant-reset-confirm-buttons">
                          <button
                            type="button"
                            onClick={handleResetConversation}
                            className="btn btn-sm assistant-btn-confirm-reset"
                          >
                            Sí, reiniciar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingReset(false)}
                            className="btn btn-ghost btn-sm assistant-btn-cancel-reset"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="assistant-msg assistant-msg-bot">
            <div className="assistant-bubble assistant-loading" role="status">
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Matcher Assistant está respondiendo…
            </div>
          </div>
        )}

        {searching && (
          <div className="assistant-msg assistant-msg-bot" role="status" aria-live="polite">
            <div className="assistant-search-card">
              <div className="assistant-search-bars" aria-hidden="true">
                <span className="assistant-search-bar" />
                <span className="assistant-search-bar" />
                <span className="assistant-search-bar" />
                <span className="assistant-search-bar" />
                <span className="assistant-search-bar" />
              </div>
              <div className="assistant-search-text">
                <span className="assistant-search-primary">Buscando tus matches...</span>
                <span className="assistant-search-secondary">
                  Estamos encontrando los gatos que mejor encajan contigo
                </span>
              </div>
            </div>
          </div>
        )}

        {canSearch && !resultsReady && !busy && (
          <div className="assistant-msg assistant-msg-bot">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="assistant-chip assistant-chip-search"
                onClick={handleGoToResults}
              >
                Ir a tus matches →
              </button>
              {!confirmingReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmingReset(true)}
                  className="assistant-link-reset"
                >
                  ↺ Empezar de nuevo
                </button>
              ) : (
                <div className="assistant-reset-confirm" role="alert">
                  <span className="assistant-reset-confirm-text">
                    ¿Borrar preferencias?
                  </span>
                  <div className="assistant-reset-confirm-buttons">
                    <button
                      type="button"
                      onClick={handleResetConversation}
                      className="btn btn-sm assistant-btn-confirm-reset"
                    >
                      Sí, reiniciar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingReset(false)}
                      className="btn btn-ghost btn-sm assistant-btn-cancel-reset"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="assistant-error-banner" role="alert">
            {error}
          </div>
        )}
        {messages.length === 1 && (
          <div className="assistant-quick-prompts">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                className="assistant-chip"
                onClick={() => handleSend(prompt)}
                disabled={busy}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="assistant-footer">
        <input
          type="text"
          className="assistant-input"
          placeholder="Escribe tu consulta…"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          aria-label="Mensaje para el asistente"
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => handleSend()}
          disabled={busy || !inputValue.trim()}
          style={{ minHeight: 38, padding: '0 12px' }}
        >
          Enviar
        </button>
      </footer>
    </div>
  );
}
