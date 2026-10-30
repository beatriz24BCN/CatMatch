import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { sendAssistantMessage, createPerson, updatePerson, AssistantSource } from '../lib/api';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sources?: AssistantSource[];
  suggestedCatIds?: string[];
}

interface ChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  'Busco un gato tranquilo para piso',
  'Tengo niños en casa',
  'Convivo con perro u otra mascota',
  '¿Cómo funciona la adopción?',
];

function extractPreferencesFromMessages(messages: Message[]): Record<string, any> {
  const userTexts = messages
    .filter(m => m.sender === 'user')
    .map(m => m.text.toLowerCase());
  const fullText = userTexts.join(' ');
  if (!fullText) return {};

  const prefs: Record<string, any> = {};

  // Ubicación conocida
  const cities = [
    'barcelona', 'madrid', 'valencia', 'sevilla', 'zaragoza',
    'malaga', 'murcia', 'palma', 'bilbao', 'alicante', 'cordoba',
    'valladolid', 'vigo', 'gijon', 'hospitalet', 'sant miquel de balanya'
  ];
  for (const c of cities) {
    if (fullText.includes(c)) {
      prefs.location = c.charAt(0).toUpperCase() + c.slice(1);
      break;
    }
  }

  // Convivencia con niños
  const hasChildrenMatch = /(tengo|hay|con)\s+(niñ[oa]s?|hij[oa]s?|peques?)/i.test(fullText);
  const noChildrenMatch = /(sin|no tengo|no hay)\s+(niñ[oa]s?|hij[oa]s?|peques?)/i.test(fullText);
  if (hasChildrenMatch && !noChildrenMatch) {
    prefs.has_children = true;
  } else if (noChildrenMatch) {
    prefs.has_children = false;
  }

  // Convivencia con mascotas / perros
  const hasPetsMatch = /(tengo|hay|con|convivo con)\s+(perr[oa]s?|mascotas?|canes?|otros? animal)/i.test(fullText);
  const noPetsMatch = /(sin|no tengo|no hay)\s+(perr[oa]s?|mascotas?|perro)/i.test(fullText);
  if (hasPetsMatch && !noPetsMatch) {
    prefs.has_other_pets = true;
  } else if (noPetsMatch) {
    prefs.has_other_pets = false;
  }

  // Nivel de actividad y vivienda
  if (fullText.includes('tranquil') || fullText.includes('calmad') || fullText.includes('sosegad') || fullText.includes('piso')) {
    prefs.activity_level = 'low';
    if (fullText.includes('piso')) prefs.home_type = 'apartment';
  } else if (fullText.includes('activ') || fullText.includes('juguet') || fullText.includes('enérgic')) {
    prefs.activity_level = 'high';
  }

  // Rasgos de personalidad
  const traits: string[] = [];
  if (fullText.includes('tranquil') || fullText.includes('calm')) traits.push('tranquilo');
  if (fullText.includes('cariños') || fullText.includes('carinos') || fullText.includes('mimos')) traits.push('cariñoso');
  if (fullText.includes('sociabl') || fullText.includes('amigabl')) traits.push('sociable');
  if (fullText.includes('juguet') || fullText.includes('activo')) traits.push('juguetón');
  if (fullText.includes('independient')) traits.push('independiente');
  if (traits.length > 0) prefs.preferred_cat_traits = traits;

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

export default function ChatAssistant({ isOpen, onClose }: ChatAssistantProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '¡Hola! Soy Matcher, tu guía de compatibilidad y adopción responsable. Cuéntame cómo es tu hogar (si vives en piso o casa, si hay niños o mascotas, o tu nivel de actividad) y te ayudaré a encontrar los gatos disponibles que mejor encajan contigo. ¡No necesitas registrarte para empezar!',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    setError(null);
    const userMsgId = String(Date.now());
    const newMessages: Message[] = [
      ...messages,
      { id: userMsgId, sender: 'user', text },
    ];
    setMessages(newMessages);
    if (!textToSend) setInputValue('');
    setLoading(true);

    try {
      const history = newMessages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        }));

      const res = await sendAssistantMessage(text, history);

      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: res.response,
          sources: res.sources,
          suggestedCatIds: res.suggested_cat_ids,
        },
      ]);
    } catch (err: any) {
      setError('No he podido conectar con el asistente. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGoToResults = async () => {
    const extracted = extractPreferencesFromMessages(messages);

    // Si se han detectado preferencias durante la conversación, persistirlas para la evaluación
    if (Object.keys(extracted).length > 0) {
      try {
        const storedDraftRaw = typeof window !== 'undefined' ? localStorage.getItem('catmatch_profile_draft') : null;
        const existingDraft = storedDraftRaw ? JSON.parse(storedDraftRaw) : {};
        const updatedDraft = { ...existingDraft, ...extracted };
        if (typeof window !== 'undefined') {
          localStorage.setItem('catmatch_profile_draft', JSON.stringify(updatedDraft));
        }

        const storedPersonId = typeof window !== 'undefined' ? localStorage.getItem('catmatch_person_id') : null;
        if (storedPersonId) {
          updatePerson(storedPersonId, extracted).catch(() => {});
        } else {
          try {
            const created = await createPerson(updatedDraft);
            if (created?.id && typeof window !== 'undefined') {
              localStorage.setItem('catmatch_person_id', created.id);
            }
          } catch {
            // fallback: results.tsx utilizará el borrador local
          }
        }
      } catch (err) {
        console.warn('Error saving conversation preferences', err);
      }
    }

    onClose();
    router.push('/adopt/results');
  };

  if (!isOpen) return null;

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
          <h3 id="assistant-title" className="assistant-title">Matcher — Compatibilidad</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="assistant-close-btn"
          aria-label="Cerrar Matcher"
        >
          ✕
        </button>
      </header>

      <div className="assistant-messages">
        {messages.map(m => (
          <div
            key={m.id}
            className={`assistant-msg ${m.sender === 'user' ? 'assistant-msg-user' : 'assistant-msg-bot'}`}
          >
            <div className="assistant-bubble" style={{ whiteSpace: 'pre-line' }}>
              {renderFormattedMessage(m.text)}
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
            <div className="assistant-bubble assistant-loading">
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Consultando catálogo y guías…
            </div>
          </div>
        )}

        {error && (
          <div className="assistant-error-banner" role="alert">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length === 1 && (
        <div className="assistant-quick-prompts">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              className="assistant-chip"
              onClick={() => handleSend(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: '10px 16px', background: 'var(--surface-alt, #f7f9fa)', borderTop: '1px solid var(--border, #e2e8f0)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--muted, #64748b)', lineHeight: 1.4 }}>
          ¡Encuentra a tu compañero ideal! Descubre tus gatos compatibles y da el primer paso hacia la adopción.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleGoToResults}
            className="btn btn-primary btn-sm"
            style={{ fontSize: '0.84rem', padding: '6px 14px', whiteSpace: 'nowrap' }}
          >
            Ver mis matches →
          </button>
        </div>
      </div>

      <footer className="assistant-footer">
        <input
          type="text"
          className="assistant-input"
          placeholder="Escribe tu consulta…"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          aria-label="Mensaje para el asistente"
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => handleSend()}
          disabled={loading || !inputValue.trim()}
          style={{ minHeight: 38, padding: '0 12px' }}
        >
          Enviar
        </button>
      </footer>
    </div>
  );
}
