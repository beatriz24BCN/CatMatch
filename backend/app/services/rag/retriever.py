import math
import re
from typing import List, Tuple
from .document import RAGDocument

SPANISH_STOPWORDS = {
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'a', 'al', 'en', 'para', 'por', 'con', 'sin', 'sobre',
    'que', 'se', 'su', 'sus', 'es', 'son', 'como', 'no', 'si', 'y', 'o',
    'mi', 'tu', 'te', 'me', 'le', 'les', 'lo', 'él', 'ella'
}

# Equivalencias léxicas explícitas para enriquecer consultas en español sin inventar semántica
SYNONYMS = {
    'minino': ['gato'],
    'mininos': ['gatos'],
    'felino': ['gato'],
    'felinos': ['gatos'],
    'calmado': ['tranquilo'],
    'sosegado': ['tranquilo'],
    'perro': ['perros'],
    'nino': ['ninos'],
    'nina': ['ninos'],
    'hijo': ['ninos'],
    'hijos': ['ninos'],
    'familia': ['ninos'],
    'piso': ['vivienda', 'hogar'],
}

def tokenize(text: str) -> List[str]:
    """Tokeniza y normaliza un texto a minúsculas eliminando signos de puntuación y acentos básicos (incluyendo ñ)."""
    if not text:
        return []
    # Normalización básica de tildes y eñes en español
    t = text.lower()
    t = t.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
    t = t.replace('ñ', 'n')
    # Extraer palabras alfanuméricas de longitud >= 2
    tokens = re.findall(r'\b[a-z0-9_]{2,}\b', t)
    return tokens

def expand_query_tokens(raw_tokens: List[str]) -> List[str]:
    """Expande tokens de la consulta con equivalencias léxicas y filtra stopwords."""
    if not raw_tokens:
        return []
    # Detección controlada de negación de movimiento: "no se mueva" -> asocia baja actividad/tranquilidad
    has_neg_motion = (
        ('mueva' in raw_tokens and 'no' in raw_tokens) or
        ('mueve' in raw_tokens and 'no' in raw_tokens) or
        ('muevan' in raw_tokens and 'no' in raw_tokens)
    )

    meaningful = [tok for tok in raw_tokens if tok not in SPANISH_STOPWORDS]
    expanded = list(meaningful)

    for tok in meaningful:
        if tok in SYNONYMS:
            expanded.extend(SYNONYMS[tok])

    if has_neg_motion:
        expanded.extend(['tranquilo', 'low', 'calmado'])

    return expanded

class BM25Retriever:
    """Implementación limpia de Okapi BM25 para recuperación probabilística de textos."""
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.documents: List[RAGDocument] = []
        self.doc_lengths: List[int] = []
        self.avg_doc_len: float = 0.0
        self.doc_freqs: dict[str, int] = {}
        self.term_freqs: List[dict[str, int]] = []

    def fit(self, documents: List[RAGDocument]):
        self.documents = documents
        self.doc_lengths = []
        self.doc_freqs = {}
        self.term_freqs = []

        total_tokens = 0
        for doc in documents:
            combined_text = f"{doc.title} {doc.content}"
            tokens = tokenize(combined_text)
            length = len(tokens)
            self.doc_lengths.append(length)
            total_tokens += length

            tf: dict[str, int] = {}
            for token in tokens:
                tf[token] = tf.get(token, 0) + 1
            self.term_freqs.append(tf)

            for token in set(tokens):
                self.doc_freqs[token] = self.doc_freqs.get(token, 0) + 1

        self.avg_doc_len = total_tokens / len(documents) if documents else 1.0

    def retrieve(
        self,
        query: str,
        top_k: int = 3,
        min_score: float = 0.2,
        relative_threshold: float = 0.25
    ) -> List[Tuple[RAGDocument, float]]:
        """Recupera los top_k documentos más relevantes según el score BM25.

        Aplica umbral mínimo calibrado (0.2) y umbral relativo respecto al documento líder
        para descartar documentos con coincidencias marginales o irrelevantes.
        """
        if not self.documents:
            return []

        raw_tokens = tokenize(query)
        if not raw_tokens:
            return []

        # Usar expansión léxica controlada
        query_tokens = expand_query_tokens(raw_tokens)
        if not query_tokens:
            # Si todos los tokens eran stopwords, usar los tokens originales como fallback
            query_tokens = raw_tokens

        num_docs = len(self.documents)
        scores = [0.0] * num_docs

        for token in query_tokens:
            if token not in self.doc_freqs:
                continue

            # IDF con suavizado
            df = self.doc_freqs[token]
            idf = math.log((num_docs - df + 0.5) / (df + 0.5) + 1.0)

            for idx, tf_dict in enumerate(self.term_freqs):
                tf = tf_dict.get(token, 0)
                if tf > 0:
                    doc_len = self.doc_lengths[idx]
                    denom = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avg_doc_len))
                    score = idf * (tf * (self.k1 + 1.0)) / denom
                    scores[idx] += score

        # Emparejar con documentos con score positivo
        ranked = [
            (self.documents[i], scores[i])
            for i in range(num_docs)
            if scores[i] > 0.0
        ]
        ranked.sort(key=lambda x: x[1], reverse=True)

        if not ranked:
            return []

        top_score = ranked[0][1]
        # Si el mejor score es menor al umbral minimo, retornar lista vacia para evitar ruido
        if top_score < min_score:
            return []

        # Filtrar documentos secundarios que tengan al menos el umbral relativo del líder
        cutoff = top_score * relative_threshold
        filtered = [r for r in ranked if r[1] >= cutoff]

        return filtered[:top_k]
