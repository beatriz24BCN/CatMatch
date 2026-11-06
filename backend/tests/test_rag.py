import os
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from backend.app.services.rag.document import RAGDocument
from backend.app.services.rag.retriever import BM25Retriever
from backend.app.services.rag.service import RAGService
from backend.app.services.rag.indexer import load_shelter_guides

def test_bm25_retriever_basic():
    retriever = BM25Retriever()
    doc1 = RAGDocument(doc_id="1", title="Gato tranquilo", content="Milo es muy tranquilo y duerme siestas en piso", source_type="cat_profile")
    doc2 = RAGDocument(doc_id="2", title="Gata activa", content="Luna es muy activa y juguetona", source_type="cat_profile")
    retriever.fit([doc1, doc2])

    results = retriever.retrieve("tranquilo piso", top_k=1)
    assert len(results) == 1
    assert results[0][0].doc_id == "1"
    assert results[0][1] > 0.0

def test_load_shelter_guides():
    guides = load_shelter_guides()
    assert len(guides) >= 2
    titles = [g.title for g in guides]
    assert any("Adopción Responsable" in t or "adopcion" in t.lower() for t in titles)
    assert any("Convivencia" in t or "convivencia" in t.lower() for t in titles)

def test_rag_service_query_mocked():
    rag = RAGService()
    # Simular documentos indexados de guías y gatos
    guides = load_shelter_guides()
    cat_doc_milo = RAGDocument(
        doc_id="cat-1",
        title="Ficha oficial de Milo",
        content="Milo es un gato adulto tranquilo, sociable y cariñoso. Apto con niños y perros. Actividad baja. Barcelona.",
        source_type="cat_profile",
        source_id="11111111-1111-1111-1111-111111111111",
        url="/adopt/cat/11111111-1111-1111-1111-111111111111",
        metadata={"cat_name": "Milo", "activity_level": "low", "good_with_dogs": True}
    )
    cat_doc_luna = RAGDocument(
        doc_id="cat-2",
        title="Ficha oficial de Luna",
        content="Luna es joven y muy activa. No apta con perros. Necesita juegos y atención.",
        source_type="cat_profile",
        source_id="22222222-2222-2222-2222-222222222222",
        url="/adopt/cat/22222222-2222-2222-2222-222222222222",
        metadata={"cat_name": "Luna", "activity_level": "high", "good_with_dogs": False}
    )
    all_docs = guides + [cat_doc_milo, cat_doc_luna]
    rag.retriever.fit(all_docs)
    rag.is_indexed = True

    # Consulta sobre gato tranquilo
    res_tranquilo = rag.query("busco un gato tranquilo para piso", db=None, top_k=2)
    assert len(res_tranquilo) > 0
    found_milo = any(r[0].metadata.get("cat_name") == "Milo" for r in res_tranquilo)
    assert found_milo is True

    # Consulta sobre perros
    res_perros = rag.query("tengo perros en casa convivencia", db=None, top_k=3)
    assert len(res_perros) > 0
    sources = [r[0].title for r in res_perros]
    assert any("Convivencia" in s or "Luna" in s or "Milo" in s for s in sources)

def test_rag_adopcion_prioritizes_guides():
    rag = RAGService()
    guides = load_shelter_guides()
    cat_doc = RAGDocument(
        doc_id="cat-99",
        title="Ficha oficial de Gato Aleatorio",
        content="Gato que vive en una casa y espera adopcion.",
        source_type="cat_profile",
        source_id="99999999-9999-9999-9999-999999999999",
        url="/adopt/cat/99999999-9999-9999-9999-999999999999"
    )
    rag.retriever.fit(guides + [cat_doc])
    rag.is_indexed = True

    # Consulta sobre proceso de adopción: debe priorizar la Guía de Adopción Responsable
    res = rag.query("¿Cómo funciona la adopción?", db=None, top_k=3)
    assert len(res) > 0
    assert "Adopción Responsable" in res[0][0].title
    assert res[0][0].source_type == "shelter_guide"

def test_rag_colloquial_expansion():
    rag = RAGService()
    cat_milo = RAGDocument(
        doc_id="cat-1",
        title="Ficha oficial de Milo",
        content="Gato Milo, edad adult. Actividad low. Muy tranquilo, calmado y sosegado.",
        source_type="cat_profile",
        source_id="11111111-1111-1111-1111-111111111111",
        metadata={"cat_name": "Milo"}
    )
    cat_luna = RAGDocument(
        doc_id="cat-2",
        title="Ficha oficial de Luna",
        content="Gata Luna, muy activa y enérgica. Corretea y juega sin parar.",
        source_type="cat_profile",
        source_id="22222222-2222-2222-2222-222222222222",
        metadata={"cat_name": "Luna"}
    )
    rag.retriever.fit([cat_milo, cat_luna])
    rag.is_indexed = True

    # Consulta coloquial: "minino que no se mueva mucho"
    res = rag.query("Busco un minino que no se mueva mucho", db=None, top_k=2)
    assert len(res) > 0
    # Milo debe ser el primer resultado con alta relevancia
    assert res[0][0].metadata.get("cat_name") == "Milo"

