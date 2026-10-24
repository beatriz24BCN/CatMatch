from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.api.deps import get_db
from backend.app.services.rag.service import RAGService

router = APIRouter(prefix="/api/assistant", tags=["assistant"])

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    history: Optional[List[ChatMessage]] = Field(default_factory=list)

class SourceCitation(BaseModel):
    title: str
    source_type: str
    url: Optional[str] = None
    snippet: str

class ChatResponse(BaseModel):
    response: str
    sources: List[SourceCitation]
    suggested_cat_ids: List[str] = Field(default_factory=list)

from backend.app.services.rag.context_matcher import (
    extract_user_intent,
    filter_compatible_cats,
    format_cat_explanation,
    generate_contextual_response,
)

@router.post("/chat", response_model=ChatResponse, summary="Conversar con el asistente de adopción responsable")
def assistant_chat(payload: ChatRequest, db: Session = Depends(get_db)):
    """Responde consultas sobre el catálogo y adopción responsable mediante RAG local.

    - 100% público, no requiere cuenta ni crea perfiles.
    - Utiliza recuperación BM25 sobre fichas oficiales y guías del refugio.
    - No inventa datos de disponibilidad ni contradice restricciones de convivencia.
    - Mantiene contexto acumulado de los últimos turnos del usuario para responder preguntas de seguimiento.
    - Explica de forma justificada por qué recomienda cada gato basándose en datos oficiales.
    """
    rag_service = RAGService.get_instance()

    # Combinar el mensaje actual con los mensajes de usuario previos para mantener el contexto
    history_user_texts = [
        m.content for m in (payload.history or [])
        if m.role == "user" and m.content.strip()
    ]
    # Texto completo acumulado para extracción de intenciones y consulta enriquecida
    full_context_text = " ".join(history_user_texts[-3:] + [payload.message])
    intent = extract_user_intent(full_context_text)

    # Realizar consulta RAG utilizando el texto contextualizado
    raw_results = rag_service.query(full_context_text, db=db, top_k=6)

    # Si la consulta contextual no obtuvo resultados, intentar solo con el mensaje actual
    if not raw_results:
        raw_results = rag_service.query(payload.message, db=db, top_k=6)

    # Filtrar resultados garantizando que los gatos cumplan las condiciones confirmadas (niños, perros)
    filtered_results = filter_compatible_cats(raw_results, intent)

    # Limitar a los mejores 3 resultados tras el filtrado
    final_results = filtered_results[:3]

    citations: List[SourceCitation] = []
    cat_ids: List[str] = []
    found_snippets = []

    for doc, score in final_results:
        snippet_lines = [l.strip() for l in doc.content.splitlines() if l.strip() and not l.startswith("#")]
        snippet = snippet_lines[0] if snippet_lines else doc.title
        if len(snippet) > 220:
            snippet = snippet[:217] + "..."

        citations.append(SourceCitation(
            title=doc.title,
            source_type=doc.source_type,
            url=doc.url,
            snippet=snippet
        ))
        if doc.source_type == "cat_profile" and doc.source_id:
            cat_ids.append(doc.source_id)
            # Explicación detallada y verificable basada estrictamente en la ficha
            found_snippets.append(format_cat_explanation(doc, intent))
        elif doc.source_type == "shelter_guide":
            found_snippets.append(f"• **Guía ({doc.title})**: {snippet}")

    # Generar respuesta contextualizada y empática
    reply_text = generate_contextual_response(intent, final_results, found_snippets)

    return ChatResponse(
        response=reply_text,
        sources=citations,
        suggested_cat_ids=list(dict.fromkeys(cat_ids))
    )
