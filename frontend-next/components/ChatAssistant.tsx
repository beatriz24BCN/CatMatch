import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { sendAssistantMessage, AssistantSource } from '../lib/api';

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
  'Busco un gato tranquilo',
  'Tengo otras mascotas',
  '¿Cómo funciona la adopción?',
];

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '¡Hola! Soy tu guía de adopción. Cuéntame cómo es tu hogar y te ayudaré a descubrir gatos que podrían encajar contigo. No necesitas crear un perfil para empezar.',
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
          <h3 id="assistant-title" className="assistant-title">Asistente CatMatch</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="assistant-close-btn"
          aria-label="Cerrar asistente"
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
