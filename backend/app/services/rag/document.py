from typing import Optional, Dict, Any
from pydantic import BaseModel

class RAGDocument(BaseModel):
    """Representa un fragmento o documento indexable en el motor RAG."""
    doc_id: str
    title: str
    content: str
    source_type: str  # 'cat_profile' o 'shelter_guide'
    source_id: Optional[str] = None  # UUID del gato si aplica
    url: Optional[str] = None  # Enlace relativo (ej: /adopt/cat/[id])
    metadata: Dict[str, Any] = {}
