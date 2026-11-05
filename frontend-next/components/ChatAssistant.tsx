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
  'Busco un gato tranquilo para piso',
  'Tengo niños en casa',
  'Convivo con perro u otra mascota',
  '¿Cómo funciona la adopción?',
];

type Preferences = Record<string, string | boolean | string[]>;

function readSavedPreferences(): Record<string, unknown> {
  const raw = localStorage.getItem('catmatch_profile_draft');
  if (!raw) return {};
  const draft: unknown = JSON.parse(raw);
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    throw new Error('El borrador de preferencias guardado no es válido.');
  }
  return { ...draft };
}

function extractPreferencesFromMessages(messages: Message[]): Preferences {
  const userMessages = messages.filter(m => m.sender === 'user');
  if (userMessages.length === 0) return {};

  const prefs: Preferences = {};

  // Ubicación conocida
  const cities = [
    'barcelona', 'madrid', 'valencia', 'sevilla', 'zaragoza',
    'malaga', 'murcia', 'palma', 'bilbao', 'alicante', 'cordoba',
    'valladolid', 'vigo', 'gijon', 'hospitalet', 'sant miquel de balanya'
  ];

  for (const msg of userMessages) {
    const text = msg.text.toLowerCase();

    // Ubicación conocida
    for (const c of cities) {
      if (text.includes(c)) {
        prefs.location = c.charAt(0).toUpperCase() + c.slice(1);
        break;
      }
    }

    // Convivencia con niños
    const hasChildrenMatch = /(tengo|hay|con)\s+(niñ[oa]s?|hij[oa]s?|peques?)/i.test(text);
    const noChildrenMatch = /(sin|no tengo|no hay)\s+(niñ[oa]s?|hij[oa]s?|peques?)/i.test(text);
    if (hasChildrenMatch && !noChildrenMatch) {
      prefs.has_children = true;
    } else if (noChildrenMatch) {
      prefs.has_children = false;
    }

    // Convivencia con mascotas / perros
    const hasPetsMatch = /(tengo|hay|con|convivo con)\s+(perr[oa]s?|mascotas?|canes?|otros? animal)/i.test(text);
    const noPetsMatch = /(sin|no tengo|no hay)\s+(perr[oa]s?|mascotas?|perro)/i.test(text);
    if (hasPetsMatch && !noPetsMatch) {
      prefs.has_other_pets = true;
    } else if (noPetsMatch) {
      prefs.has_other_pets = false;
    }

    // Tipo de vivienda
    if (text.includes('piso') || text.includes('apartamento')) {
      prefs.home_type = 'apartment';
    } else if (text.includes('casa') || text.includes('chalet') || text.includes('finca') || text.includes('jardín') || text.includes('jardin')) {
      prefs.home_type = 'house';
    }

    // Nivel de actividad
    if (text.includes('tranquil') || text.includes('calmad') || text.includes('sosegad') || text.includes('poco activ') || text.includes('sedentari')) {
      prefs.activity_level = 'low';
    } else if (text.includes('activ') || text.includes('juguet') || text.includes('enérgic') || text.includes('dinámic') || text.includes('mucho jueg')) {
      prefs.activity_level = 'high';
    } else if (text.includes('moderad') || text.includes('medio') || text.includes('normal')) {
      prefs.activity_level = 'medium';
    }

    // Rasgos de personalidad
    const traits: string[] = [];
    if (text.includes('tranquil') || text.includes('calm')) traits.push('tranquilo');
    if (text.includes('cariños') || text.includes('carinos') || text.includes('mimos')) traits.push('cariñoso');
    if (text.includes('sociabl') || text.includes('amigabl')) traits.push('sociable');
    if (text.includes('juguet') || text.includes('activo')) traits.push('juguetón');
    if (text.includes('independient')) traits.push('independiente');
    if (traits.length > 0) prefs.preferred_cat_traits = traits;
  }

  return prefs;
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
      text: '¡Hola! Soy Matcher 🐾\n\nTe ayudo a encontrar a tu compañero ideal y a resolver dudas sobre adopción responsable.\n\nPara empezar, ¿cómo es tu hogar? ¿Vives en piso o casa, y tienes niños u otras mascotas?',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resultsReady, setResultsReady] = useState(false);
  const [hasSavedPreferences, setHasSavedPreferences] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const storedPersonId = localStorage.getItem('catmatch_person_id');

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
    let shouldSearch = Object.keys(extractPreferencesFromMessages(newMessages)).length > 0;

    try {
      const history = newMessages
        .filter(m => m.id !== 'welcome' && !m.matchesReady)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        }));

      const res = await sendAssistantMessage(text, history);
      shouldSearch = shouldSearch || res.suggested_cat_ids.length > 0;

      const conversation: Message[] = [
        ...newMessages,
        {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: res.response,
          sources: res.sources,
          suggestedCatIds: res.suggested_cat_ids,
        },
      ];
      setMessages(conversation);
      setLoading(false);
    } catch (err) {
      console.warn('Error contacting conversation assistant', err);
      setError('No he podido conectar con el asistente en este momento. Inténtalo de nuevo.');
      setLoading(false);
      busyRef.current = false;
      return;
    }

    try {
      if (shouldSearch) {
        await prepareMatches(newMessages);
      }
    } catch (err) {
      console.warn('Error preparing conversation matches', err);
      setError('No he podido preparar tus matches en este momento. Inténtalo de nuevo.');
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGoToResults = async () => {
    if (!resultsReady || busyRef.current) return;
    setError(null);
    try {
      if (await router.push('/adopt/results')) onClose();
      else setError('La navegación se ha cancelado. Pulsa de nuevo en «Ver mis matches».');
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
        text: '¡Hola! Soy Matcher 🐾\n\nTe ayudo a encontrar a tu compañero ideal y a resolver dudas sobre adopción responsable.\n\nPara empezar, ¿cómo es tu hogar? ¿Vives en piso o casa, y tienes niños u otras mascotas?',
      },
    ]);
    setInputValue('');
    setLoading(false);
    setSearching(false);
    setResultsReady(false);
    setHasSavedPreferences(false);
    setConfirmingReset(false);
    setError(null);
    busyRef.current = false;
  };

  const canSearch = hasSavedPreferences ||
    messages.some(m => m.sender === 'user');

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
          <h3 id="assistant-title" className="assistant-title">Matcher</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="assistant-close-btn"
              aria-label="Minimizar Matcher"
              title="Minimizar"
            >
              —
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="assistant-close-btn"
            aria-label="Cerrar Matcher"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="assistant-messages" ref={messagesRef} role="log" aria-label="Conversación con Matcher" aria-live="polite">
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
                    Ver mis matches →
                  </button>

                  <div className="assistant-matches-secondary-actions">
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

            {m.sources && m.sources.length > 0 && (
              <div className="assistant-sources">
                <span className="assistant-sources-title">Fuentes oficiales:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {m.sources.map((s, idx) => (
                    <div key={idx} className="assistant-source-item">
                      {s.url ? (
                        <Link href={s.url} className="assistant-source-link">
                          🔗 {s.title}
                        </Link>
                      ) : (
                        <span>📄 {s.title}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="assistant-msg assistant-msg-bot">
            <div className="assistant-bubble assistant-loading" role="status">
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Matcher está respondiendo…
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
                onClick={handleSearch}
              >
                Buscar mis matches →
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
