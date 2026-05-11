"""
ingest_science_corpus.py
========================
Ingest 10 Wikipedia science articles into TigerGraph so the
vectorSearchChunks query returns relevant results for the benchmark.

Run from the repo root:
    python ingest_science_corpus.py

Reads TG_HOST, TG_TOKEN, TG_GRAPH and HUGGING_FACE_HUB_TOKEN from web/.env
"""
import os, json, sys, time
import urllib.request, urllib.error

# ── Load web/.env ──────────────────────────────────────────────────────────────
_env = os.path.join(os.path.dirname(__file__), "web", ".env")
if os.path.exists(_env):
    for line in open(_env):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

TG_HOST   = os.environ.get("TG_HOST", "").rstrip("/")
TG_SECRET = os.environ.get("TG_SECRET", "")   # preferred: GSQL-Secret auth
TG_TOKEN  = os.environ.get("TG_TOKEN", "")    # fallback: Bearer token
TG_GRAPH  = os.environ.get("TG_GRAPH", "GraphRAG")
HF_TOKEN  = os.environ.get("HUGGING_FACE_HUB_TOKEN") or os.environ.get("HF_TOKEN", "")

if not TG_HOST:
    sys.exit("ERROR: Set TG_HOST in web/.env")
if not TG_SECRET and not TG_TOKEN:
    sys.exit("ERROR: Set TG_SECRET or TG_TOKEN in web/.env")
if not HF_TOKEN:
    sys.exit("ERROR: Set HUGGING_FACE_HUB_TOKEN in web/.env")

# Use GSQL-Secret if available (doesn't expire), otherwise Bearer token
TG_AUTH_HEADER = f"GSQL-Secret {TG_SECRET}" if TG_SECRET else f"Bearer {TG_TOKEN}"

# ── Wikipedia science corpus (matches benchmark RETRIEVAL_CONTEXTS) ────────────
CORPUS = [
    {
        "id": "general_relativity",
        "title": "General Relativity",
        "chunks": [
            "General relativity is the geometric theory of gravitation published by Albert Einstein in 1915. It describes gravity not as a force but as the curvature of spacetime caused by mass and energy.",
            "The Einstein field equations relate spacetime curvature to the energy-momentum tensor of matter. These ten coupled equations are the core of general relativity.",
            "General relativity predicted black holes, where spacetime curvature becomes extreme, and gravitational waves, ripples in spacetime caused by accelerating masses.",
            "Spacetime is a four-dimensional manifold. Massive objects warp this manifold; smaller objects follow curved paths (geodesics) that we perceive as gravitational attraction.",
            "The first experimental confirmation of general relativity came in 1919 when Eddington observed light bending around the Sun during a solar eclipse, matching Einstein's prediction.",
        ],
    },
    {
        "id": "dna",
        "title": "DNA",
        "chunks": [
            "Deoxyribonucleic acid (DNA) is a polymer composed of two polynucleotide chains that coil around each other to form a double helix. It carries the genetic instructions for development, functioning, growth, and reproduction of all known organisms and viruses.",
            "DNA is made of four chemical bases: adenine (A), thymine (T), guanine (G), and cytosine (C). Base-pairing rules (A with T, G with C) give the double helix its ladder-like structure.",
            "The human genome contains approximately 3 billion base pairs of DNA, organized into 23 chromosome pairs. Genes, segments of DNA encoding proteins, represent about 2% of the total genome.",
            "DNA replication creates an identical copy before cell division. Helicase unwinds the double helix; DNA polymerase synthesizes new complementary strands using each original strand as a template.",
            "The central dogma of molecular biology: DNA is transcribed into RNA, which is translated into proteins. This information flow underpins all cellular function.",
        ],
    },
    {
        "id": "photosynthesis",
        "title": "Photosynthesis",
        "chunks": [
            "Photosynthesis is the biological process by which plants, algae, and cyanobacteria convert light energy (usually from the Sun), water, and carbon dioxide into glucose and oxygen. It is the primary source of energy for nearly all life on Earth.",
            "Photosynthesis occurs in two stages: the light-dependent reactions in the thylakoid membranes and the Calvin cycle in the stroma of chloroplasts.",
            "In the light-dependent reactions, chlorophyll absorbs sunlight to split water molecules, releasing oxygen as a byproduct and generating ATP and NADPH.",
            "Chlorophyll absorbs primarily red (~680 nm) and blue (~430 nm) light while reflecting green, giving plants their color. Accessory pigments like carotenoids broaden the light-absorption spectrum.",
            "Overall photosynthesis equation: 6CO2 + 6H2O + light energy -> C6H12O6 + 6O2. About 40% of solar energy absorbed is converted to chemical energy.",
        ],
    },
    {
        "id": "electron",
        "title": "Electron",
        "chunks": [
            "The electron is a subatomic particle with a negative electric charge of -1.602e-19 coulombs. It belongs to the lepton family of particles and has no known substructure.",
            "Electrons were discovered by J.J. Thomson in 1897 through cathode ray tube experiments. He demonstrated that cathode rays were streams of particles much lighter than hydrogen atoms.",
            "In an atom, electrons occupy regions called orbitals around the nucleus. Electron configuration determines chemical properties; atoms seek to fill their outermost shell.",
            "In chemical bonds, electrons are shared between atoms (covalent bond) or fully transferred from one atom to another (ionic bond).",
            "Electrons carry electric current in conductors. In semiconductors like silicon, controlled electron flow via doping and junctions enables transistors and all modern electronics.",
        ],
    },
    {
        "id": "natural_selection",
        "title": "Natural Selection",
        "chunks": [
            "Natural selection is the mechanism by which organisms with heritable traits better suited to their environment tend to survive and produce more offspring, driving evolution over generations.",
            "Charles Darwin and Alfred Russel Wallace independently formulated natural selection around 1858. Darwin published 'On the Origin of Species' in 1859, providing extensive evidence.",
            "Four conditions are required for natural selection: variation exists in traits, variation is heritable, some variants are fitter (more reproductive success), and resources are limited.",
            "Darwin developed his theory after observing variation among Galapagos finches and tortoises. The finches' beak shapes varied by island, each adapted to local food sources.",
            "Natural selection was independently proposed by Alfred Russel Wallace at the same time. Combined with Mendelian genetics, it forms the Modern Synthesis of evolutionary biology.",
        ],
    },
    {
        "id": "covalent_bond",
        "title": "Covalent Bond",
        "chunks": [
            "A covalent bond is a type of chemical bond where atoms share one or more pairs of electrons. Covalent bonds typically form between nonmetal atoms with similar electronegativities.",
            "When two atoms share electrons, both nuclei are attracted to the shared electrons, lowering the overall energy of the system and creating a stable bond. The sharing can be equal (nonpolar) or unequal (polar).",
            "Water (H2O) is a polar covalent molecule: oxygen's higher electronegativity draws the shared electrons closer, creating partial negative and positive charges. This polarity drives hydrogen bonding.",
            "Double bonds (2 shared pairs) and triple bonds (3 shared pairs) are stronger and shorter than single bonds. Carbon-carbon triple bonds are among the strongest covalent bonds.",
            "Lewis structures represent covalent bonds as lines between atoms. VSEPR theory predicts molecular geometry from the arrangement of bonding and lone-pair electrons.",
        ],
    },
    {
        "id": "nuclear_fission",
        "title": "Nuclear Fission",
        "chunks": [
            "Nuclear fission is a nuclear reaction in which the nucleus of a heavy atom (such as uranium-235 or plutonium-239) splits into two smaller nuclei upon absorbing a neutron, releasing a large amount of energy and additional neutrons.",
            "The energy released in fission comes from the mass defect — the difference in mass between the original nucleus and the products, converted via E=mc^2. A single fission event releases ~200 MeV.",
            "Fission neutrons can trigger further fissions, creating a chain reaction. In a nuclear reactor, control rods absorb excess neutrons to regulate the chain reaction and prevent runaway.",
            "Otto Hahn, Fritz Strassmann, Lise Meitner, and Otto Frisch identified nuclear fission in 1938. The Manhattan Project (1942-1945) weaponized fission, producing the first atomic bombs.",
            "Modern nuclear power plants use fission of uranium-235 to generate heat, which drives steam turbines. Nuclear power provides about 10% of the world's electricity.",
        ],
    },
    {
        "id": "speed_of_light",
        "title": "Speed of Light",
        "chunks": [
            "The speed of light in vacuum is exactly 299,792,458 metres per second (approximately 3e8 m/s), denoted by c. It is a fundamental physical constant and the maximum speed at which energy, matter, or information can travel.",
            "Einstein's special theory of relativity (1905) postulates that c is the same for all observers, regardless of the motion of the light source or observer. This leads to time dilation and length contraction at high speeds.",
            "The constancy of the speed of light was confirmed experimentally by the Michelson-Morley experiment (1887), which failed to detect the expected variation due to Earth's motion through the hypothetical aether.",
            "Light from the Sun takes approximately 8 minutes 20 seconds to reach Earth. A light-year (9.461e15 m) is the distance light travels in one year.",
            "The speed of light defines the metre: 1 m = distance light travels in 1/299,792,458 s. It also appears in mass-energy equivalence: E = mc^2.",
        ],
    },
    {
        "id": "quantum_mechanics",
        "title": "Quantum Mechanics",
        "chunks": [
            "Quantum mechanics is the branch of physics that describes the behavior of matter and energy at the atomic and subatomic scale. It introduces the concept of wave-particle duality and the probabilistic nature of physical systems.",
            "Heisenberg's uncertainty principle states that the position and momentum of a particle cannot both be precisely known simultaneously: delta_x * delta_p >= h-bar/2. This is a fundamental feature, not a measurement limitation.",
            "The Schrodinger equation describes the time evolution of a quantum system's wave function. The squared magnitude of the wave function gives the probability density of finding a particle at a location.",
            "Quantum mechanics underpins chemistry (electron orbitals), materials science (semiconductors), and technologies like lasers, MRI scanners, and quantum computers.",
            "Key figures in quantum mechanics include Max Planck, Niels Bohr, Werner Heisenberg, Erwin Schrodinger, and Paul Dirac. The field emerged in the early 20th century.",
        ],
    },
    {
        "id": "carbon",
        "title": "Carbon",
        "chunks": [
            "Carbon is a chemical element with symbol C and atomic number 6. It is a nonmetal with four valence electrons, allowing it to form up to four covalent bonds. Carbon is the backbone of all organic molecules and the basis of all known life.",
            "Carbon has several allotropes with distinct properties: diamond (extremely hard, insulator), graphite (soft, electrical conductor), graphene (2D single layer, extraordinary strength), and fullerenes (C60 and related structures).",
            "Carbon's ability to bond with itself and other elements creates an enormous diversity of compounds — millions of organic compounds are known. Organic chemistry is essentially the study of carbon compounds.",
            "The carbon cycle describes how carbon moves through the atmosphere (CO2), biosphere (photosynthesis/respiration), oceans (dissolved CO2), and lithosphere (fossil fuels, limestone).",
            "Carbon-14 (14C) is a radioactive isotope formed in the atmosphere. It decays with a half-life of 5,730 years and is used in radiocarbon dating of organic materials up to ~50,000 years old.",
        ],
    },
]

# ── Embedding via HuggingFace API ──────────────────────────────────────────────
HF_URL = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction"

def get_embedding(text: str) -> list:
    payload = json.dumps({"inputs": text}).encode()
    req = urllib.request.Request(
        HF_URL,
        data=payload,
        headers={"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
            vec = data[0] if isinstance(data[0], list) else data
            return [float(x) for x in vec]
        except Exception as e:
            if attempt < 2:
                print(f"  [embed retry {attempt+1}] {e}")
                time.sleep(2)
            else:
                raise

# ── TigerGraph REST helpers ────────────────────────────────────────────────────
RESTPP = f"{TG_HOST}/restpp"

def tg_request(method: str, path: str, body: dict = None) -> dict:
    payload = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        f"{RESTPP}{path}",
        data=payload,
        headers={"Authorization": TG_AUTH_HEADER, "Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_bytes = e.read()
        print(f"\nHTTP {e.code} {e.reason} for {method} {path}")
        print("Response:", body_bytes.decode(errors="replace")[:1000])
        raise

def tg_post(path: str, body: dict) -> dict:
    return tg_request("POST", path, body)

def tg_get(path: str) -> dict:
    return tg_request("GET", path)

def upsert_batch(vertices: dict, edges: dict = None) -> None:
    body = {"vertices": vertices}
    if edges:
        body["edges"] = edges
    result = tg_post(f"/graph/{TG_GRAPH}", body)
    if not result.get("error", False) and result.get("code") not in ("REST-0000",):
        pass  # success; TG returns {"results":[{"accepted_vertices":n}],...}

# ── Main ingestion ─────────────────────────────────────────────────────────────
def check_graph():
    """Verify the graph schema exists and vectorSearchChunks is installed."""
    # Count existing Chunk vertices (GET on a vertex type is valid)
    try:
        r = tg_get(f"/graph/{TG_GRAPH}/vertices/Chunk?limit=1")
        count = r.get("results", [{}])[0].get("count", "?") if r.get("results") else "?"
        print(f"Graph OK: {TG_GRAPH}  (Chunk vertices reachable, existing count={count})")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        if "Graph" in body and ("not exist" in body or "not found" in body.lower()):
            print("ERROR: Graph not found. Run setup_tigergraph.py first to create schema.")
            sys.exit(1)
        # 400 "no data" is fine — schema exists but empty
        print(f"Schema check: {e.code} (non-fatal, continuing)")

    # Check installed queries
    try:
        r = tg_get(f"/query/{TG_GRAPH}")
        names = [q.get("queryName","") for q in (r.get("results") or [])]
        if "vectorSearchChunks" in names:
            print("vectorSearchChunks: installed")
        else:
            print(f"WARNING: vectorSearchChunks not installed. Found: {names or 'none'}")
            print("         Run setup_tigergraph.py (or graphrag.main ingest) to install queries first.")
    except Exception as e:
        print(f"Query check (non-fatal): {e}")
    print()

def ingest():
    check_graph()
    total_chunks = sum(len(doc["chunks"]) for doc in CORPUS)
    print(f"Ingesting {len(CORPUS)} articles / {total_chunks} chunks into {TG_GRAPH} @ {TG_HOST}")
    print()

    done = 0
    for doc in CORPUS:
        doc_id = doc["id"]
        title  = doc["title"]
        print(f"[{doc_id}] {title}")

        # Upsert Document vertex
        upsert_batch({"Document": {
            doc_id: {
                "title":   {"value": title,     "op": "ignore_if_exists"},
                "content": {"value": " ".join(doc["chunks"]), "op": "ignore_if_exists"},
                "source":  {"value": "wikipedia", "op": "ignore_if_exists"},
            }
        }})

        # Upsert each chunk with its embedding
        for i, text in enumerate(doc["chunks"]):
            chunk_id = f"{doc_id}_chunk_{i}"
            sys.stdout.write(f"  chunk {i+1}/{len(doc['chunks'])}: embedding... ")
            sys.stdout.flush()
            emb = get_embedding(text)
            sys.stdout.write(f"upserting... ")
            sys.stdout.flush()

            upsert_batch(
                vertices={"Chunk": {
                    chunk_id: {
                        "text":        {"value": text,          "op": "ignore_if_exists"},
                        "embedding":   {"value": emb,           "op": "ignore_if_exists"},
                        "chunk_index": {"value": i,             "op": "ignore_if_exists"},
                        "token_count": {"value": len(text.split()), "op": "ignore_if_exists"},
                        "doc_id":      {"value": doc_id,        "op": "ignore_if_exists"},
                    }
                }},
                edges={"PART_OF": {"Chunk": {chunk_id: {"Document": {doc_id: {"position": {"value": i, "op": "ignore_if_exists"}}}}}}},
            )
            done += 1
            print(f"done ({done}/{total_chunks})")
            time.sleep(0.2)  # be polite to the API

        print()

    print(f"Ingestion complete. {done} chunks written to TigerGraph.")
    print()
    print("Test with curl:")
    print(f'  curl -s -X POST "{TG_HOST}/restpp/query/{TG_GRAPH}/vectorSearchChunks" \\')
    print(f'       -H "Authorization: Bearer {TG_TOKEN}" \\')
    print(f'       -H "Content-Type: application/json" \\')
    print(f'       -d \'{{"queryVec":[0.1]*384,"topK":3}}\' | python -m json.tool')

if __name__ == "__main__":
    ingest()