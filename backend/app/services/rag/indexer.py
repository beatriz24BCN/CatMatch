import os
from typing import List
from sqlalchemy.orm import Session
from .document import RAGDocument
from backend.app.models.cat import Cat

def load_shelter_guides() -> List[RAGDocument]:
    """Carga los documentos markdown de guías del refugio."""
    docs: List[RAGDocument] = []
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/shelter_docs"))
    if not os.path.exists(base_dir):
        return docs

    for fname in os.listdir(base_dir):
        if fname.endswith(".md"):
            fpath = os.path.join(base_dir, fname)
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read()
                # Extraer título del primer encabezado si existe
                lines = content.splitlines()
                title = fname
                for l in lines:
                    if l.startswith("# "):
                        title = l.replace("# ", "").strip()
                        break
                docs.append(RAGDocument(
                    doc_id=f"guide-{fname}",
                    title=title,
                    content=content,
                    source_type="shelter_guide",
                    source_id=None,
                    url="/#como-funciona",
                    metadata={"filename": fname}
                ))
            except Exception as e:
                print(f"[RAG Indexer] Error loading {fname}: {e}")
    return docs

def load_cats_documents(db: Session) -> List[RAGDocument]:
    """Carga las descripciones y atributos oficiales de los gatos desde la base de datos."""
    docs: List[RAGDocument] = []
    if not db:
        return docs
    try:
        cats = db.query(Cat).all()
    except Exception:
        # Fallback defensivo si la tabla no existe en entornos de test aislados
        return docs
    for cat in cats:
        # Construir resumen semántico enriquecido con atributos oficiales
        traits_str = ", ".join(cat.personality_traits) if isinstance(cat.personality_traits, list) else (str(cat.personality_traits) if cat.personality_traits else "No especificados")
        children_str = "Apto con niños" if cat.good_with_children is True else ("No apto con niños" if cat.good_with_children is False else "Pendiente de valorar con niños")
        dogs_str = "Apto con perros y otras mascotas" if cat.good_with_dogs is True else ("No apto con perros u otras mascotas" if cat.good_with_dogs is False else "Pendiente de valorar con perros")
        activity_str = f"Nivel de actividad: {cat.activity_level or 'desconocido'}"

        content_parts = [
            f"Gato {cat.name}, edad: {cat.age_stage} ({cat.age_months or '?'} meses), raza: {cat.breed or 'Común europeo'}, ubicación: {cat.location or 'Refugio'}.",
            f"Personalidad y rasgos: {traits_str}.",
            f"Convivencia: {children_str}. {dogs_str}.",
            f"Energía: {activity_str}.",
            f"Descripción oficial del refugio: {cat.description or 'Sin descripción adicional.'}"
        ]
        full_content = "\n".join(content_parts)

        docs.append(RAGDocument(
            doc_id=f"cat-{cat.id}",
            title=f"Ficha oficial de {cat.name}",
            content=full_content,
            source_type="cat_profile",
            source_id=str(cat.id),
            url=f"/adopt/cat/{cat.id}",
            metadata={
                "cat_id": str(cat.id),
                "cat_name": cat.name,
                "age_stage": cat.age_stage,
                "age_months": cat.age_months,
                "breed": cat.breed,
                "location": cat.location,
                "activity_level": cat.activity_level,
                "good_with_children": cat.good_with_children,
                "good_with_dogs": cat.good_with_dogs,
                "personality_traits": cat.personality_traits
            }
        ))
    return docs
