#!/usr/bin/env python3
"""
Seed reproducible para los seis gatos de demostración de CatMatch.

Revisión de seguridad:
- NO sobrescribe ningún registro existente. Si detecta colisión por ID o nombre, aborta inmediatamente.
- Identifica explícitamente los perfiles como ficticios de demostración.
- Establece valores neutros (None/NULL) en vacunación y esterilización para no inventar datos clínicos.
- Manejo transaccional estricto con rollback en caso de error.
- Modo Dry Run por defecto (solo lectura).
"""

import sys
import uuid
from typing import List, Dict, Any

from sqlalchemy import select
from sqlalchemy.orm import Session

# Importar sesión y modelo del proyecto existente
from backend.app.db.session import SessionLocal
from backend.app.models.cat import Cat

# Namespace determinista para generar UUIDs reproducibles
CATMATCH_NAMESPACE = uuid.UUID("ca700000-0000-0000-0000-000000000000")

DEMO_CATS: List[Dict[str, Any]] = [
    {
        "id": uuid.uuid5(CATMATCH_NAMESPACE, "Milo"),
        "name": "Milo",
        "age_stage": "adult",
        "age_months": 36,
        "sex": "M",
        "breed": "Común europeo",
        "size": "M",
        "activity_level": "low",
        "personality_traits": ["tranquilo", "cariñoso", "sociable"],
        "good_with_children": True,
        "good_with_dogs": True,
        "vaccinated": None,  # Valor neutro (sin datos clínicos inventados)
        "neutered": None,    # Valor neutro
        "health_status": "Perfil ficticio para pruebas del MVP",
        "description": "[Perfil de demostración] Compañero tranquilo y cariñoso. Disfruta de las siestas y de estar cerca de las personas en un hogar apacible.",
        "image_urls": ["/images/cats/milo.jpg"],
        "location": "Barcelona",
    },
    {
        "id": uuid.uuid5(CATMATCH_NAMESPACE, "Luna"),
        "name": "Luna",
        "age_stage": "young",
        "age_months": 24,
        "sex": "F",
        "breed": "Común europeo",
        "size": "M",
        "activity_level": "high",
        "personality_traits": ["juguetona", "curiosa", "activa"],
        "good_with_children": True,
        "good_with_dogs": False,  # Permite verificar detección de incompatibilidad con perros
        "vaccinated": None,
        "neutered": None,
        "health_status": "Perfil ficticio para pruebas del MVP",
        "description": "[Perfil de demostración] Exploradora, curiosa y activa. Necesita espacio y personas que le dediquen tiempo de juego y estímulos en un entorno sin perros.",
        "image_urls": ["/images/cats/luna.jpg"],
        "location": "Barcelona",
    },
    {
        "id": uuid.uuid5(CATMATCH_NAMESPACE, "Nube"),
        "name": "Nube",
        "age_stage": "adult",
        "age_months": 60,
        "sex": "M",
        "breed": "Común europeo",
        "size": "L",
        "activity_level": "low",
        "personality_traits": ["independiente", "calmado", "observador"],
        "good_with_children": False,  # Permite verificar detección de incompatibilidad con niños
        "good_with_dogs": True,
        "vaccinated": None,
        "neutered": None,
        "health_status": "Perfil ficticio para pruebas del MVP",
        "description": "[Perfil de demostración] Independiente y calmado. Valora tener sus propios espacios y agradece la compañía cuando él la busca en un entorno tranquilo.",
        "image_urls": ["/images/cats/nube.jpg"],
        "location": "Barcelona",
    },
    {
        "id": uuid.uuid5(CATMATCH_NAMESPACE, "Nala"),
        "name": "Nala",
        "age_stage": "young",
        "age_months": 12,
        "sex": "F",
        "breed": "Común europeo",
        "size": "S",
        "activity_level": "high",
        "personality_traits": ["sociable", "cariñosa", "juguetona"],
        "good_with_children": True,
        "good_with_dogs": True,
        "vaccinated": None,
        "neutered": None,
        "health_status": "Perfil ficticio para pruebas del MVP",
        "description": "[Perfil de demostración] Sociable, alegre y cariñosa. Disfruta de la compañía constante, los juegos y la atención activa en casa.",
        "image_urls": ["/images/cats/nala.jpg"],
        "location": "Madrid",  # Permite verificar factor informativo de ubicación
    },
    {
        "id": uuid.uuid5(CATMATCH_NAMESPACE, "Simba"),
        "name": "Simba",
        "age_stage": "young",
        "age_months": 24,
        "sex": "M",
        "breed": "Europeo naranja",
        "size": "M",
        "activity_level": "high",
        "personality_traits": ["activo", "juguetón", "explorador"],
        "good_with_children": True,
        "good_with_dogs": True,
        "vaccinated": None,
        "neutered": None,
        "health_status": "Perfil ficticio para pruebas del MVP",
        "description": "[Perfil de demostración] Enérgico y juguetón. Necesita estímulos, juegos diarios y espacio para explorar junto a personas activas.",
        "image_urls": ["/images/cats/simba.jpg"],
        "location": "Barcelona",
    },
    {
        "id": uuid.uuid5(CATMATCH_NAMESPACE, "Oreo"),
        "name": "Oreo",
        "age_stage": "adult",
        "age_months": 48,
        "sex": "M",
        "breed": "Común europeo blanco y negro",
        "size": "M",
        "activity_level": "medium",
        "personality_traits": ["tranquilo", "sensible", "cariñoso"],
        "good_with_children": False,  # Permite verificar desaconsejado con niños
        "good_with_dogs": False,      # y desaconsejado con otras mascotas
        "vaccinated": None,
        "neutered": None,
        "health_status": "Perfil ficticio para pruebas del MVP",
        "description": "[Perfil de demostración] Sensible y tranquilo. Necesita un entorno predecible, paciencia y respeto por sus tiempos de adaptación.",
        "image_urls": ["/images/cats/oreo.jpg"],
        "location": "Barcelona",
    },
]


def seed_cats(db: Session, dry_run: bool = True) -> None:
    """Inserta de forma segura los 6 gatos sin sobrescribir ningún registro existente."""
    print(f"--- Modo de ejecución: {'DRY RUN (Solo lectura)' if dry_run else 'APLICANDO CAMBIOS EN BD'} ---")

    # 1. Comprobación estricta de conflictos previos
    conflicts = []
    for cat_data in DEMO_CATS:
        stmt = select(Cat).where((Cat.id == cat_data["id"]) | (Cat.name == cat_data["name"]))
        existing = db.execute(stmt).scalars().first()
        if existing:
            conflicts.append(
                f"Conflicto con '{cat_data['name']}': ya existe registro con ID {existing.id} y nombre '{existing.name}'."
            )

    if conflicts:
        print("\n[ERROR DE SEGURIDAD] Se han detectado registros existentes. El seed NO sobrescribe datos:")
        for c in conflicts:
            print(f"  - {c}")
        print("\nOperación cancelada. No se ha modificado la base de datos.")
        sys.exit(1)

    # 2. Inserción protegida por transacción
    try:
        for cat_data in DEMO_CATS:
            print(f"[A INSERTAR] {cat_data['name']} (UUID: {cat_data['id']})")
            if not dry_run:
                new_cat = Cat(**cat_data)
                db.add(new_cat)

        if dry_run:
            print(f"\nResumen Dry Run: 6 gatos validados para inserción. Ningún cambio aplicado.")
        else:
            db.commit()
            print(f"\nÉxito: 6 gatos de demostración insertados correctamente en PostgreSQL.")
    except Exception as e:
        if not dry_run:
            db.rollback()
            print(f"\n[ERROR] Ocurrió un fallo durante la inserción. Se ha ejecutado ROLLBACK: {e}")
        raise


if __name__ == "__main__":
    is_dry = "--apply" not in sys.argv
    db_session = SessionLocal()
    try:
        seed_cats(db_session, dry_run=is_dry)
    finally:
        db_session.close()

