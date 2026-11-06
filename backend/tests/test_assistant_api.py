import os
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.rag.service import RAGService
from backend.app.services.rag.document import RAGDocument

client = TestClient(app)

def test_assistant_chat_endpoint_public():
    # Inicializar RAGService con documentos mockeados para tests unitarios aislados
    rag = RAGService.get_instance()
    milo = RAGDocument(
        doc_id="cat-1",
        title="Ficha oficial de Milo",
        content="Gato Milo, edad: adult. Actividad baja, tranquilo y calmado para piso.",
        source_type="cat_profile",
        source_id="70939fee-0301-546d-be30-eda626cf0f0c",
        url="/adopt/cat/70939fee-0301-546d-be30-eda626cf0f0c"
    )
    guia = RAGDocument(
        doc_id="guide-1",
        title="Guía de Adopción Responsable — CatMatch",
        content="Adoptar un gato es un compromiso a largo plazo. Consejos para adaptar tu hogar.",
        source_type="shelter_guide",
        url="/#como-funciona"
    )
    rag.retriever.fit([milo, guia])
    rag.is_indexed = True

    payload = {
        "message": "Hola, busco un gato tranquilo para un piso pequeño"
    }
    response = client.post("/api/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert "sources" in data
    assert len(data["sources"]) > 0
    # Verifica que menciona a gatos o guías del refugio
    assert any("Milo" in s["title"] or "Guía" in s["title"] or "Ficha" in s["title"] for s in data["sources"])

def test_assistant_chat_validation_length():
    # Mensaje vacío debe fallar con 422
    response = client.post("/api/assistant/chat", json={"message": ""})
    assert response.status_code == 422

    # Mensaje demasiado largo (>1000)
    response = client.post("/api/assistant/chat", json={"message": "a" * 1001})
    assert response.status_code == 422

def test_assistant_chat_adopcion_prioritizes_guides():
    rag = RAGService.get_instance()
    guia = RAGDocument(
        doc_id="guide-1",
        title="Guía de Adopción Responsable — CatMatch",
        content="¿Cómo funciona la adopción? Adoptar un gato en CatMatch es un proceso transparente.",
        source_type="shelter_guide",
        url="/#como-funciona"
    )
    cat_random = RAGDocument(
        doc_id="cat-99",
        title="Ficha oficial de Gato Aleatorio",
        content="Gato que duerme en el rincón.",
        source_type="cat_profile",
        source_id="99999999-9999-9999-9999-999999999999"
    )
    rag.retriever.fit([guia, cat_random])
    rag.is_indexed = True

    response = client.post("/api/assistant/chat", json={"message": "¿Cómo funciona la adopción?"})
    assert response.status_code == 200
    data = response.json()
    # Debe devolver fuentes y la primera debe ser la guía oficial
    assert len(data["sources"]) > 0
    assert data["sources"][0]["source_type"] == "shelter_guide"
    assert "Guía" in data["sources"][0]["title"]
    # No debe incluir al gato irrelevante
    assert not any("Gato Aleatorio" in s["title"] for s in data["sources"])

def test_assistant_chat_context_followup_children():
    rag = RAGService.get_instance()
    milo = RAGDocument(
        doc_id="cat-1",
        title="Ficha oficial de Milo",
        content="Gato Milo, sociable y cariñoso. Apto con niños y apto con perros. Actividad baja para piso.",
        source_type="cat_profile",
        source_id="70939fee-0301-546d-be30-eda626cf0f0c",
        metadata={"cat_name": "Milo", "good_with_children": True, "good_with_dogs": True, "activity_level": "low"}
    )
    nube = RAGDocument(
        doc_id="cat-3",
        title="Ficha oficial de Nube",
        content="Gato Nube, independiente. No apto con niños. Apto con perros.",
        source_type="cat_profile",
        source_id="200fea94-f666-5843-ad06-e17d30bc1bbf",
        metadata={"cat_name": "Nube", "good_with_children": False, "good_with_dogs": True, "activity_level": "low"}
    )
    rag.retriever.fit([milo, nube])
    rag.is_indexed = True

    # Turno 1: "piso con niños"
    # Turno 2: "sí convivo con niños" con historial
    payload = {
        "message": "sí convivo con niños",
        "history": [
            {"role": "user", "content": "piso con niños"},
            {"role": "assistant", "content": "¿Convives con niños u otras mascotas?"}
        ]
    }
    response = client.post("/api/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["sources"]) > 0
    # Milo DEBE aparecer (apto con niños)
    assert any("Milo" in s["title"] for s in data["sources"])
    # Nube NO DEBE aparecer porque no es apto con niños
    assert not any("Nube" in s["title"] for s in data["sources"])
    # La respuesta debe mencionar la preferencia de convivencia con niños
    assert "niños" in data["response"]

def test_assistant_chat_dogs_and_children():
    rag = RAGService.get_instance()
    milo = RAGDocument(
        doc_id="cat-1",
        title="Ficha oficial de Milo",
        content="Gato Milo, sociable y cariñoso. Apto con niños y con perros.",
        source_type="cat_profile",
        source_id="70939fee-0301-546d-be30-eda626cf0f0c",
        metadata={"cat_name": "Milo", "good_with_children": True, "good_with_dogs": True}
    )
    luna = RAGDocument(
        doc_id="cat-2",
        title="Ficha oficial de Luna",
        content="Gata Luna, juguetona. Apta con niños pero NO apta con perros.",
        source_type="cat_profile",
        source_id="526bc9f8-55fd-5a2b-831f-53e9f1290c45",
        metadata={"cat_name": "Luna", "good_with_children": True, "good_with_dogs": False}
    )
    rag.retriever.fit([milo, luna])
    rag.is_indexed = True

    payload = {"message": "Tengo un perro y dos niños"}
    response = client.post("/api/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    # Milo es compatible con ambos, debe recomendarse
    assert any("Milo" in s["title"] for s in data["sources"])
    # Luna NO es apta con perros, debe ser excluida estrictamente
    assert not any("Luna" in s["title"] for s in data["sources"])

def test_assistant_chat_unknown_query():
    rag = RAGService.get_instance()
    payload = {"message": "xyz987 consulta_totalmente_desconocida_sin_sentido"}
    response = client.post("/api/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["sources"]) == 0
    assert "No he encontrado información específica" in data["response"]

def test_assistant_chat_explains_recommendations_with_official_data():
    rag = RAGService.get_instance()
    milo = RAGDocument(
        doc_id="cat-1",
        title="Ficha oficial de Milo",
        content="Gato Milo, edad: adult (36 meses), común europeo, Barcelona. Actividad baja, tranquilo. Apto con niños y con perros.",
        source_type="cat_profile",
        source_id="70939fee-0301-546d-be30-eda626cf0f0c",
        url="/adopt/cat/70939fee-0301-546d-be30-eda626cf0f0c",
        metadata={
            "cat_name": "Milo",
            "age_stage": "adult",
            "age_months": 36,
            "breed": "Común europeo",
            "location": "Barcelona",
            "activity_level": "low",
            "good_with_children": True,
            "good_with_dogs": True
        }
    )
    rag.retriever.fit([milo])
    rag.is_indexed = True

    payload = {"message": "Busco un gato para un piso con niños en Barcelona"}
    response = client.post("/api/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    resp_text = data["response"]
    # Verifica que incluye explicación con atributos reales
    assert "Milo" in resp_text
    assert "Barcelona" in resp_text
    assert "convivencia positiva con niños confirmada" in resp_text
    assert "actividad bajo" in resp_text
    assert "[Ver ficha oficial](/adopt/cat/70939fee-0301-546d-be30-eda626cf0f0c)" in resp_text

def test_assistant_chat_unconfirmed_compatibility_clarity():
    rag = RAGService.get_instance()
    gato_sin_datos = RAGDocument(
        doc_id="cat-mystery",
        title="Ficha oficial de Misterio",
        content="Gato rescatado reciente.",
        source_type="cat_profile",
        source_id="88888888-8888-8888-8888-888888888888",
        url="/adopt/cat/88888888-8888-8888-8888-888888888888",
        metadata={
            "cat_name": "Misterio",
            "good_with_children": None,  # Desconocido
            "good_with_dogs": None,      # Desconocido
            "activity_level": "medium",
            "location": "Madrid"
        }
    )
    rag.retriever.fit([gato_sin_datos])
    rag.is_indexed = True

    payload = {"message": "Tengo niños en casa en Barcelona, ¿Misterio es compatible?"}
    response = client.post("/api/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    resp_text = data["response"]
    # Debe indicar claramente que la compatibilidad con niños está pendiente de valorar
    assert "pendiente de valorar" in resp_text
    # No debe mentir diciendo que es de Barcelona si es de Madrid, y solo indicar la ubicación real sin asumir traslados
    assert "ubicado en Madrid" in resp_text

def test_assistant_chat_source_urls_and_attributes_fidelity():
    rag = RAGService.get_instance()
    milo = RAGDocument(
        doc_id="cat-1",
        title="Ficha oficial de Milo",
        content="Gato Milo, edad adult. Actividad baja. Apto con niños y perros.",
        source_type="cat_profile",
        source_id="70939fee-0301-546d-be30-eda626cf0f0c",
        url="/adopt/cat/70939fee-0301-546d-be30-eda626cf0f0c",
        metadata={
            "cat_id": "70939fee-0301-546d-be30-eda626cf0f0c",
            "cat_name": "Milo",
            "age_stage": "adult",
            "age_months": 36,
            "breed": "Común europeo",
            "location": "Barcelona",
            "activity_level": "low",
            "good_with_children": True,
            "good_with_dogs": True
        }
    )
    rag.retriever.fit([milo])
    rag.is_indexed = True

    payload = {"message": "Busco gato tranquilo para niños"}
    response = client.post("/api/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()

    # 1. Comprobar que en sources y en el texto el URL es completo y funcional
    expected_url = "/adopt/cat/70939fee-0301-546d-be30-eda626cf0f0c"
    assert any(s.get("url") == expected_url for s in data["sources"])
    assert f"({expected_url})" in data["response"]
    assert "70939fee-0301-546d-be30-eda626cf0f0c" in data["suggested_cat_ids"]

    # 2. Comprobar que no hay inferencias inventadas sobre traslados ni disponibilidad no confirmada
    assert "traslado" not in data["response"].lower()
    assert "visita" not in data["response"].lower()

def test_assistant_chat_spanish_age_formatting_and_traits():
    rag = RAGService.get_instance()
    nala = RAGDocument(
        doc_id="cat-nala",
        title="Ficha oficial de Nala",
        content="Gato Nala, edad: young (12 meses), común europeo, Madrid. Muy sociable, cariñosa y juguetona.",
        source_type="cat_profile",
        source_id="f7c1deaf-0f4a-5273-8a60-89ba7b38a178",
        url="/adopt/cat/f7c1deaf-0f4a-5273-8a60-89ba7b38a178",
        metadata={
            "cat_name": "Nala",
            "age_months": 12,
            "breed": "Común europeo",
            "location": "Madrid",
            "activity_level": "high",
            "personality_traits": ["sociable", "cariñosa", "juguetona"],
            "good_with_children": True,
            "good_with_dogs": True
        }
    )
    rag.retriever.fit([nala])
    rag.is_indexed = True

    payload = {"message": "Busco un gato sociable y cariñoso en Madrid"}
    response = client.post("/api/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    resp_text = data["response"]

    # 1. Comprobar edad en español correcto: "1 año" (no "1 años" ni "12 meses")
    assert "1 año" in resp_text
    assert "1 años" not in resp_text

    # 2. Comprobar justificación de rasgos documentados
    assert "carácter sociable documentado" in resp_text
    assert "carácter cariñoso documentado" in resp_text

    # 3. Comprobar invitación responsable a matching sin afirmar falsamente comparación previa
    assert "realice una evaluación detallada de compatibilidad" in resp_text
    assert "comparemos automáticamente tu perfil con todos los gatos" not in resp_text





