"""Calculs métier du module 4 (équivalents de src/services/metrics.ts)."""

import csv
import io


def competence_gaps(comp) -> list[dict]:
    """competenceGaps() du front, pour chaque compétence de la matrice :

    - nb : collaborateurs ayant des notions mais sous le niveau requis (0 < niveau < requis) ;
    - couverts : collaborateurs au niveau requis ou au-delà ;
    - critique : moins de 2 collaborateurs au niveau requis.
    """
    out = []
    for i, c in enumerate(comp.liste):
        req = comp.requis.get(c, 0)
        niveaux = [p["niveaux"][i] for p in comp.collaborateurs if i < len(p["niveaux"])]
        couverts = sum(1 for v in niveaux if v >= req)
        out.append(
            {
                "comp": c,
                "requis": req,
                "nb": sum(1 for v in niveaux if 0 < v < req),
                "couverts": couverts,
                "critique": couverts < 2,
            }
        )
    return out


def parse_matrix_csv(text: str, nb_competences: int) -> list[dict]:
    """importMatrix() du front : lignes « Nom;Direction;niveau1;niveau2… » (en-tête ignoré).

    Séparateur ';' ou ','. Niveaux absents ou invalides -> 0, bornés à 0..4.
    """
    # Caractère NUL retiré : csv le refuse (erreur serveur) et PostgreSQL aussi.
    text = text.lstrip("﻿").replace("\x00", "")
    lines = [line for line in text.splitlines() if line.strip()]
    rows = []
    for line in lines[1:]:
        cells = next(csv.reader(io.StringIO(line.replace(",", ";")), delimiter=";"))
        if len(cells) < 2 or not cells[0].strip():
            continue
        niveaux = []
        for k in range(nb_competences):
            raw = cells[k + 2].strip() if k + 2 < len(cells) else ""
            try:
                v = int(float(raw))
            except (ValueError, OverflowError):  # « abc », « inf »… -> 0
                v = 0
            niveaux.append(max(0, min(4, v)))
        rows.append({"nom": cells[0].strip(), "direction": cells[1].strip(), "niveaux": niveaux})
    return rows
