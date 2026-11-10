from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from .document import RAGDocument
from .retriever import BM25Retriever
from .indexer import load_shelter_guides, load_cats_documents

class RAGService:
    """Servicio centralizado de indexación y recuperación para CatMatch."""
    _instance: Optional['RAGService'] = None

    def __init__(self):
        self.retriever = BM25Retriever()
        self.is_indexed = False

    @classmethod
    def get_instance(cls) -> 'RAGService':
        if cls._instance is None:
            cls._instance = RAGService()
        return cls._instance

    def initialize_index(self, db: Session):
        """Indexa tanto las guías de adopción como las fichas oficiales de los gatos."""
        all_docs: List[RAGDocument] = []
        guides = load_shelter_guides()
        all_docs.extend(guides)
        cats_docs = load_cats_documents(db)
        all_docs.extend(cats_docs)

        self.retriever.fit(all_docs)
        self.is_indexed = True

    def query(self, text: str, db: Session, top_k: int = 3) -> List[Tuple[RAGDocument, float]]:
        """Recupera los fragmentos más relevantes, re-indexando si no estuviera listo."""
        if not self.is_indexed:
            self.initialize_index(db)
        return self.retriever.retrieve(text, top_k=top_k)
