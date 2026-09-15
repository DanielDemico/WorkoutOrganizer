import sqlite3
import unicodedata
from pathlib import Path
from typing import TypedDict
from rapidfuzz import fuzz, process

ROOT_DIR = Path(__file__).resolve().parent
DB_PATH = (ROOT_DIR / ".." / "workout.db").resolve()


def normalize(text: str | None) -> str:
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFD", text)
    stripped = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return " ".join(stripped.lower().split())


class SuggestedExercise(TypedDict):
    id: str
    name: str


class MatchResult(TypedDict):
    exercise_id: str | None
    matched_name: str | None
    confidence: float
    suggested_exercises: list[SuggestedExercise]


class CatalogExercise:
    __slots__ = ("id", "name_en", "name_pt", "norm_en", "norm_pt")

    def __init__(self, id: str, name_en: str, name_pt: str):
        self.id = id
        self.name_en = name_en
        self.name_pt = name_pt
        self.norm_en = normalize(name_en)
        self.norm_pt = normalize(name_pt)


class ExerciseCatalog:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self.exercises: list[CatalogExercise] = []
        self._id_to_exercise: dict[str, CatalogExercise] = {}
        self._exact_map: dict[str, CatalogExercise] = {}
        self._search_corpus_pt: list[str] = []
        self._search_corpus_en: list[str] = []
        self._prompt_context_cache: dict[str, str] = {}
        self._load()

    def _load(self):
        if not self.db_path.exists():
            raise FileNotFoundError(f"Database not found at {self.db_path}")

        conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
        try:
            cur = conn.cursor()
            query = """
                SELECT e.id, e.name, coalesce(i.name, e.name)
                FROM exercises e
                LEFT JOIN exercise_i18n i ON i.exercise_id = e.id AND i.lang = 'pt'
                ORDER BY e.id
            """
            cur.execute(query)
            rows = cur.fetchall()

            self.exercises.clear()
            self._id_to_exercise.clear()
            self._exact_map.clear()
            self._search_corpus_pt.clear()
            self._search_corpus_en.clear()

            for ex_id, name_en, name_pt in rows:
                item = CatalogExercise(id=ex_id, name_en=name_en, name_pt=name_pt)
                self.exercises.append(item)
                self._id_to_exercise[ex_id] = item

                # Exact lookup keys
                if item.norm_pt:
                    self._exact_map[item.norm_pt] = item
                if item.norm_en:
                    self._exact_map[item.norm_en] = item

                self._search_corpus_pt.append(item.norm_pt)
                self._search_corpus_en.append(item.norm_en)
        finally:
            conn.close()

    def display_name(self, ex: CatalogExercise, lang: str = "pt") -> str:
        return ex.name_pt if lang == "pt" else ex.name_en

    def get_by_id(self, exercise_id: str | None) -> CatalogExercise | None:
        """Validates an id the LLM claims to have chosen. A model asked to pick from
        1324 items will occasionally invent one; nothing reaches the database on the
        model's word alone (spec 0008 §5.1, stage 2)."""
        if not exercise_id:
            return None
        return self._id_to_exercise.get(exercise_id.strip())

    def find_exact(self, query: str) -> CatalogExercise | None:
        """Accent- and case-insensitive exact hit against either language."""
        return self._exact_map.get(normalize(query))

    def get_catalog_prompt_context(self, lang: str = "pt") -> str:
        """The whole catalog as `[id] name`, one per line, for grounding the LLM.
        ~58 KB / ~15k tokens in pt — measured, not estimated (spec 0008 §3). Cached
        because it is rebuilt on every request otherwise."""
        cached = self._prompt_context_cache.get(lang)
        if cached is not None:
            return cached

        lines = [f"[{ex.id}] {self.display_name(ex, lang)}" for ex in self.exercises]
        context = "\n".join(lines)
        self._prompt_context_cache[lang] = context
        return context

    def suggest(self, query: str, lang: str = "pt", limit: int = 3) -> tuple[float, list[SuggestedExercise]]:
        """Fuzzy candidates for a name the LLM could not ground.

        Deliberately does NOT return a binding match. Every scorer measured against
        real gym vocabulary either missed almost everything (token_sort at 0.85: 3/46)
        or bound the wrong exercise with full confidence ("Remada máquina" ->
        "Remada alta na máquina articulada", a shoulder movement). See spec 0008 §5.1.

        Searches both languages: sheets mix them freely ("Leg press", "Pulldown",
        "Face pull"), and the pt corpus alone scored 0.42 on "Pulldown" against 0.73
        in en.
        """
        query_norm = normalize(query)
        if not query_norm:
            return 0.0, []

        scored: dict[str, tuple[float, int, CatalogExercise]] = {}
        for corpus in (self._search_corpus_pt, self._search_corpus_en):
            for _, score, idx in process.extract(
                query_norm, corpus, scorer=fuzz.token_set_ratio, limit=20
            ):
                ex = self.exercises[idx]
                # Length is the tiebreaker: token_set_ratio saturates at 100 for every
                # catalog name that merely contains the query's tokens, so "Leg press"
                # ties "Leg press 45°" with "Panturrilha no leg press 45°". The shorter
                # name carries less unrequested meaning.
                key_len = len(corpus[idx])
                prev = scored.get(ex.id)
                if prev is None or (score, -key_len) > (prev[0], -prev[1]):
                    scored[ex.id] = (score, key_len, ex)

        if not scored:
            return 0.0, []

        ranked = sorted(scored.values(), key=lambda t: (-t[0], t[1]))
        top_confidence = round(ranked[0][0] / 100.0, 2)
        suggested: list[SuggestedExercise] = [
            {"id": ex.id, "name": self.display_name(ex, lang)}
            for _, _, ex in ranked[:limit]
        ]
        return top_confidence, suggested

    def match(self, query: str, lang: str = "pt") -> MatchResult:
        """Deterministic stages only (spec 0008 §5.1 stages 1, 3 and 4). The LLM's
        grounded choice is applied by the caller, which knows whether there was one."""
        ex = self.find_exact(query)
        if ex is not None:
            return {
                "exercise_id": ex.id,
                "matched_name": self.display_name(ex, lang),
                "confidence": 1.0,
                "suggested_exercises": [],
            }

        confidence, suggested = self.suggest(query, lang=lang)
        return {
            "exercise_id": None,
            "matched_name": None,
            "confidence": confidence,
            "suggested_exercises": suggested,
        }


# Singleton catalog instance for fast in-memory lookups
_catalog_instance: ExerciseCatalog | None = None


def get_catalog() -> ExerciseCatalog:
    global _catalog_instance
    if _catalog_instance is None:
        _catalog_instance = ExerciseCatalog()
    return _catalog_instance
