import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.support.services import parse_matrix_csv

pytestmark = pytest.mark.django_db

URL = "/api/v1/competences/"


def test_singleton_round_trip(api, demo_data):
    assert api.get(URL).json() == demo_data["db"]["competences"]


def test_ecarts_match_front(api, demo_data):
    C = demo_data["db"]["competences"]
    gaps = api.get(f"{URL}ecarts/").json()
    assert [g["comp"] for g in gaps] == C["liste"]
    for i, g in enumerate(gaps):
        req = C["requis"][g["comp"]]
        niveaux = [p["niveaux"][i] for p in C["collaborateurs"]]
        assert g["couverts"] == sum(v >= req for v in niveaux)
        assert g["nb"] == sum(0 < v < req for v in niveaux)
        assert g["critique"] == (g["couverts"] < 2)


def test_niveau_cycle_and_set(api):
    # Prisca ASSOGBA, « Gestes sûrs au décorticage » : 4 -> 0 (cycle), puis fixé à 2.
    r = api.post(f"{URL}niveau/", {"collaborateur": "Prisca ASSOGBA", "competence": 0}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["collaborateurs"][0]["niveaux"][0] == 0
    r = api.post(
        f"{URL}niveau/",
        {"collaborateur": 0, "competence": "Gestes sûrs au décorticage", "niveau": 2},
        format="json",
    )
    assert r.json()["collaborateurs"][0]["niveaux"][0] == 2
    assert api.post(f"{URL}niveau/", {"collaborateur": 99, "competence": 0}, format="json").status_code == 400
    assert (
        api.post(
            f"{URL}niveau/", {"collaborateur": 0, "competence": 0, "niveau": 5}, format="json"
        ).status_code
        == 400
    )


def test_add_collaborateur(api):
    r = api.post(f"{URL}collaborateurs/", {"nom": "Bénédicte AGOSSA", "direction": "Direction Industrielle"})
    assert r.status_code == 201
    last = r.json()["collaborateurs"][-1]
    assert last == {"nom": "Bénédicte AGOSSA", "direction": "Direction Industrielle", "niveaux": [1] * 7}


def test_import_csv_text_and_file(api):
    csv = "﻿Nom;Direction;a;b\r\nJean DOE;Direction QSE-SI;2;9;x;1;0;3;4\r\n\r\nSolo\r\n"
    r = api.post(f"{URL}import/", {"csv": csv}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["importes"] == 1
    assert r.json()["competences"]["collaborateurs"][-1]["niveaux"] == [2, 4, 0, 1, 0, 3, 4]
    f = SimpleUploadedFile(
        "m.csv", b"Nom,Direction\nAnne KOFFI,Direction Commerciale,3\n", content_type="text/csv"
    )
    r = api.post(f"{URL}import/", {"file": f}, format="multipart")
    assert r.json()["competences"]["collaborateurs"][-1]["niveaux"] == [3, 0, 0, 0, 0, 0, 0]
    assert api.post(f"{URL}import/", {}, format="json").status_code == 400


def test_parse_matrix_clamps_levels():
    assert parse_matrix_csv("h\nA;B;-3;7", 2) == [{"nom": "A", "direction": "B", "niveaux": [0, 4]}]


@pytest.mark.parametrize(
    "patch",
    [
        {"liste": ["A", "A"]},
        {"requis": {"Gestes sûrs au décorticage": 9}},
        {"collaborateurs": [{"nom": "X", "direction": "D", "niveaux": [1, 2]}]},
        {"collaborateurs": [{"direction": "D", "niveaux": [1] * 7}]},
        {"liste": ["Nouvelle compétence"]},
    ],
)
def test_matrix_consistency(api, patch):
    assert api.patch(URL, patch, format="json").status_code == 400


def test_matrix_update(api):
    body = {
        "liste": ["Lutte incendie"],
        "requis": {"Lutte incendie": 2},
        "collaborateurs": [{"nom": "Jules HOUESSOU", "direction": "Direction Industrielle", "niveaux": [3]}],
    }
    r = api.put(URL, body, format="json")
    assert r.status_code == 200, r.content
    assert r.json() == body
    assert api.get(f"{URL}ecarts/").json() == [
        {"comp": "Lutte incendie", "requis": 2, "nb": 0, "couverts": 1, "critique": True}
    ]


def test_collaborateur_read_only(api_collab):
    assert api_collab.get(f"{URL}ecarts/").status_code == 200
    assert (
        api_collab.post(f"{URL}niveau/", {"collaborateur": 0, "competence": 0}, format="json").status_code
        == 403
    )
    assert api_collab.patch(URL, {"liste": []}, format="json").status_code == 403
