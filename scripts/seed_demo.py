#!/usr/bin/env python3
"""
Seed de datos de DEMO para testear grupos localmente.
Crea usuarios de prueba, un grupo compartido, documentos, XP repartido en
varios días (para rachas/heatmap/ranking) y un duelo jugado por varios.

Uso:  python3 scripts/seed_demo.py
Requiere Supabase local corriendo (supabase start) y el backend en :8000.
"""
import json, uuid, urllib.request, datetime, random

ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
SUPA = "http://127.0.0.1:54321"
API = "http://localhost:8000"

def req(u, m="GET", b=None, h=None):
    r = urllib.request.Request(u, method=m, headers=h or {})
    d = json.dumps(b).encode() if b is not None else None
    if d: r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, d) as x:
            t = x.read().decode(); return x.status, (json.loads(t) if t else {})
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try: return e.code, json.loads(t)
        except: return e.code, t

TEST_PW = "test123456"
svc = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Prefer": "return=minimal"}

# (email, nombre)  — password test123456 para todos
USERS = [
    ("ana@test.local", "Ana Gómez"),
    ("beto@test.local", "Beto Ríos"),
    ("lucia@test.local", "Lucía Paz"),
    ("mateo@test.local", "Mateo Sosa"),
    ("sofia@test.local", "Sofía Luna"),
]

def ensure_user(email, name):
    st, d = req(f"{SUPA}/auth/v1/signup", "POST",
                {"email": email, "password": TEST_PW, "data": {"full_name": name}},
                {"apikey": ANON})
    if st != 200 or "access_token" not in d:
        st, d = req(f"{SUPA}/auth/v1/token?grant_type=password", "POST",
                    {"email": email, "password": TEST_PW}, {"apikey": ANON})
    return d["access_token"], d["user"]["id"]

def mk_doc(uid, title, subject, n_cards=10, n_q=8, mature=False):
    doc_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.UTC)
    cards = []
    for i in range(n_cards):
        reps = random.randint(2, 6) if mature else random.randint(0, 2)
        interval = random.choice([6, 15, 30]) if mature else random.choice([1, 1, 6])
        nr = (now - datetime.timedelta(days=1)).isoformat() if i % 3 == 0 else (now + datetime.timedelta(days=interval)).isoformat()
        cards.append({"question": f"{title} — carta {i}", "answer": f"Respuesta {i}",
                      "interval": interval, "ease_factor": round(random.uniform(1.8, 2.6), 2),
                      "repetitions": reps, "next_review": nr})
    qs = [{"question": f"{title}: ¿pregunta {i}?", "options": [f"Correcta {i}", f"Falsa A{i}", f"Falsa B{i}"],
           "correct_answer": f"Correcta {i}", "explanation": f"La correcta es la {i}."} for i in range(n_q)]
    req(f"{SUPA}/rest/v1/documents", "POST", {
        "id": doc_id, "user_id": uid, "title": title, "file_type": "text", "status": "ready",
        "subject": subject, "content": "Contenido de ejemplo.", "summary": f"Resumen de {title}.",
        "flashcards": cards, "exam_questions": qs,
        "key_concepts": [{"concept": f"Concepto {i}", "definition": f"Definición {i}."} for i in range(4)],
    }, svc)
    return doc_id, qs

def seed_xp(uid, doc_id, days_active, base):
    """Reparte eventos de XP en los últimos `days_active` días."""
    now = datetime.datetime.now(datetime.UTC)
    rows = []
    for day in range(days_active):
        when = now - datetime.timedelta(days=day, hours=random.randint(0, 6))
        # quiz + algunos repasos por día
        rows.append({"user_id": uid, "kind": "quiz", "amount": base + random.randint(0, 30),
                     "doc_id": doc_id, "meta": {"percentage": random.randint(45, 98)}, "created_at": when.isoformat()})
        for _ in range(random.randint(2, 6)):
            rows.append({"user_id": uid, "kind": "review", "amount": 5, "doc_id": doc_id,
                         "meta": {}, "created_at": (when + datetime.timedelta(minutes=random.randint(1, 40))).isoformat()})
    if rows:
        req(f"{SUPA}/rest/v1/xp_events", "POST", rows, svc)

print("Creando usuarios de prueba…")
accounts = []
for email, name in USERS:
    tok, uid = ensure_user(email, name)
    accounts.append({"email": email, "name": name, "token": tok, "uid": uid})
    print(f"  ✓ {name} ({email})")

# fabrizio como dueño del grupo demo
st, fab = req(f"{SUPA}/auth/v1/token?grant_type=password", "POST",
              {"email": "fabrizio@memoria.local", "password": "memoria123"}, {"apikey": ANON})
fab_tok, fab_uid = fab["access_token"], fab["user"]["id"]
FAB = {"Authorization": f"Bearer {fab_tok}"}

# Grupo demo (idempotente: reusar si ya existe)
st, groups = req(f"{API}/groups", "GET", None, FAB)
demo = next((g for g in groups if g["name"] == "Medicina — Comisión 3"), None)
if not demo:
    st, demo = req(f"{API}/groups", "POST", {"name": "Medicina — Comisión 3"}, FAB)
    print(f"Grupo demo creado: {demo['name']} (código {demo['code']})")
gid, code = demo["id"], demo["code"]

# Todos se unen + docs + XP variado (distintas rachas para ranking realista)
SUBJECTS = ["Anatomía", "Fisiología", "Histología", "Bioquímica", "Farmacología"]
profiles = [(7, 60), (5, 45), (6, 55), (3, 30), (4, 40)]  # (días activos, base xp) por user
first_doc = None
for acc, (days, base) in zip(accounts, profiles):
    H = {"Authorization": f"Bearer {acc['token']}"}
    req(f"{API}/groups/join", "POST", {"code": code}, H)
    subj = random.choice(SUBJECTS)
    doc_id, qs = mk_doc(acc["uid"], f"{subj} — {acc['name'].split()[0]}", subj, mature=(days >= 6))
    seed_xp(acc["uid"], doc_id, days, base)
    if first_doc is None:
        first_doc = (acc, doc_id, qs)
    print(f"  ✓ {acc['name']} en el grupo, doc de {subj}, {days} días activos")

# Un compañero comparte su mazo y crea un duelo; varios lo juegan
sharer, doc_id, qs = first_doc
SH = {"Authorization": f"Bearer {sharer['token']}"}
req(f"{API}/groups/{gid}/decks", "POST", {"doc_id": doc_id}, SH)
st, duel = req(f"{API}/groups/{gid}/duels", "POST", {"doc_id": doc_id, "title": "Duelo — parcial 1", "num_questions": 6}, SH)
if "id" in duel:
    did = duel["id"]
    for acc in accounts[:4]:
        H = {"Authorization": f"Bearer {acc['token']}"}
        st, dv = req(f"{API}/duels/{did}", "GET", None, H)
        if dv.get("already_played") or "questions" not in dv:
            continue
        # responder bien un % al azar
        answers = []
        for q in dv["questions"]:
            answers.append(q["options"][0] if random.random() < random.uniform(0.4, 0.9) else q["options"][1])
        req(f"{API}/duels/{did}/submit", "POST", {"answers": answers}, H)
    print(f"  ✓ Duelo '{duel.get('title')}' creado y jugado por varios")

print(f"\n✅ Demo lista. Grupo 'Medicina — Comisión 3' (código {code}).")
print("   Cuentas de prueba (password: test123456):")
for u in USERS:
    print(f"     - {u[0]}")
