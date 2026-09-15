import base64
import io
import json
import logging
import os
import re
from pathlib import Path
from typing import Any
import httpx
import pandas as pd
from dotenv import load_dotenv
from pydantic import BaseModel, Field
import pypdf
from PIL import Image

from catalog import get_catalog

# Load .env from document-service directory
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

logger = logging.getLogger("document-service.extractor")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
PRIMARY_MODEL = os.getenv("OPENROUTER_PRIMARY_MODEL", "google/gemini-2.5-flash").strip()
FALLBACK_MODEL = os.getenv("OPENROUTER_FALLBACK_MODEL", "openai/gpt-4o-mini").strip()
SITE_URL = os.getenv("OPENROUTER_SITE_URL", "http://localhost:5173").strip()
APP_TITLE = os.getenv("OPENROUTER_APP_TITLE", "WorkoutOrganizer").strip()

VALID_DAYS = ["segunda", "terça", "quarta", "quinta", "sexta", "sabado", "domingo"]

DAY_MAPPING = {
    "segunda": "segunda",
    "seg": "segunda",
    "segunda-feira": "segunda",
    "monday": "segunda",
    "mon": "segunda",
    "terca": "terça",
    "terça": "terça",
    "ter": "terça",
    "terca-feira": "terça",
    "terça-feira": "terça",
    "tuesday": "terça",
    "tue": "terça",
    "quarta": "quarta",
    "qua": "quarta",
    "quarta-feira": "quarta",
    "wednesday": "quarta",
    "wed": "quarta",
    "quinta": "quinta",
    "qui": "quinta",
    "quinta-feira": "quinta",
    "thursday": "quinta",
    "thu": "quinta",
    "sexta": "sexta",
    "sex": "sexta",
    "sexta-feira": "sexta",
    "friday": "sexta",
    "fri": "sexta",
    "sabado": "sabado",
    "sábado": "sabado",
    "sab": "sabado",
    "sáb": "sabado",
    "saturday": "sabado",
    "sat": "sabado",
    "domingo": "domingo",
    "dom": "domingo",
    "sunday": "domingo",
    "sun": "domingo",
}


def normalize_day(day_str: str, default_day: str = "segunda") -> str:
    cleaned = (day_str or "").strip().lower()
    cleaned = re.sub(r"[^\w\s-]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if cleaned in DAY_MAPPING:
        return DAY_MAPPING[cleaned]

    # Labels rarely arrive clean: the LLM tends to echo the document heading, so
    # "QUARTA — SUPERIORES" has to resolve by the token it contains, not by equality.
    for token in cleaned.split(" "):
        if token in DAY_MAPPING:
            return DAY_MAPPING[token]

    # "Treino A", "Ficha B", "A" — only where the letter is the label itself, never a
    # stray word. A bare \b[a-g]\b also matches the "e" in "Peito e Tríceps" and used
    # to send the whole chest day to sexta.
    match_letter = re.match(r"^(?:treino|ficha|dia|day|workout)?\s*([a-g])$", cleaned)
    if match_letter:
        idx = ord(match_letter.group(1)) - ord("a")
        if 0 <= idx < len(VALID_DAYS):
            return VALID_DAYS[idx]

    return default_day


def sanitize_series(series_str: str | None, obs_str: str | None) -> tuple[str | None, str | None]:
    """Ensures series strictly adheres to ^\\d+x\\d+$ regex.
    Moves extra details (e.g. rep ranges, rest) to observacao.
    """
    if not series_str:
        return None, obs_str

    raw = series_str.strip()
    # If already strict
    if re.match(r"^\d+x\d+$", raw):
        return raw, obs_str

    # Look for patterns like 4x10, 4 x 10, 3x12-15, 4*10, 4×12, "4 séries de 12".
    # "×" (U+00D7) is what phone note apps and most printed sheets actually produce,
    # and dropping it sent every set/rep pair on such a sheet into observacao.
    match = re.search(
        r"(\d+)\s*(?:[xX×*]|s[ée]ries?\s+de|de|vezes)\s*(\d+)(?:\s*(?:a|à|-|–)\s*(\d+))?",
        raw,
    )
    if match:
        sets = match.group(1)
        reps1 = match.group(2)
        reps2 = match.group(3)
        chosen_reps = reps2 if reps2 else reps1
        clean_series = f"{sets}x{chosen_reps}"

        # If there were extra details, append to observacao
        notes = []
        if reps2:
            notes.append(f"{reps1} a {reps2} repetições")
        remainder = raw[: match.start()] + " " + raw[match.end() :]
        remainder = re.sub(r"\s+", " ", remainder).strip()
        if remainder:
            notes.append(remainder)
        if obs_str:
            notes.append(obs_str.strip())

        new_obs = "; ".join(notes) if notes else None
        return clean_series, new_obs

    # Could not match NxM; put entire string in observacao
    combined = f"Séries originais: {raw}" + (f" | {obs_str}" if obs_str else "")
    return None, combined


class RawExtractedExercise(BaseModel):
    original_name: str = Field(description="Nome do exercício conforme aparece no documento")
    matched_exercise_id: str | None = Field(
        default=None, description="ID do exercício correspondente no catálogo oficial, ou null"
    )
    series: str | None = Field(default=None, description="Séries no formato NxM, ex: 4x10")
    observacao: str | None = Field(default=None, description="Observações, descanso ou repetições variáveis")


class RawExtractedDay(BaseModel):
    day: str = Field(description="Dia da semana ou identificação do treino")
    exercises: list[RawExtractedExercise] = Field(default_factory=list)


class RawExtractedWorkout(BaseModel):
    workout_name: str = Field(description="Nome do treino sugerido ou identificado")
    days: list[RawExtractedDay] = Field(default_factory=list)


SYSTEM_PROMPT = """Você é um especialista em educação física e análise de rotinas de treino de academia.
Sua tarefa é analisar o documento fornecido (foto, print, PDF, planilha ou texto) e extrair toda a rotina de treino estruturada.

Regras fundamentais:
1. `workout_name`: Crie ou extraia um título descritivo para a rotina (ex: "Treino Hipertrofia ABC", "Ficha de Treino Superior e Inferior").
2. `days`: Organize os exercícios agrupados por dia da semana (`segunda`, `terça`, `quarta`, `quinta`, `sexta`, `sabado`, `domingo`).
   - Se o documento usa "Treino A, B, C", distribua ordenadamente a partir de `segunda` (ex: A=segunda, B=terça, C=quarta).
   - Se for uma rotina dividida por grupos (ex: Peito/Tríceps, Costas/Bíceps, Pernas), coloque cada grupo em um dia consecutivo.
3. `original_name`: O nome exato ou mais claro do exercício encontrado (ex: "Supino Reto com Barra", "Puxada Frontal", "Leg Press 45").
4. `matched_exercise_id`: O ID do exercício equivalente no CATÁLOGO OFICIAL fornecido abaixo. Esta é a sua tarefa mais importante — veja as regras de correspondência.
5. `series`: Deve seguir a convenção NxM (ex: "4x10", "3x12"). Se o documento indicar variação como "4 x 10 a 12", extraia "4x12" em `series` e mencione "10 a 12 reps" em `observacao`. Se não houver séries/reps explícitas, deixe null.
6. `observacao`: Coloque orientações de descanso, bi-set, drop-set, carga ou notas técnicas aqui. NÃO repita o nome do exercício aqui.

## Regras de correspondência com o catálogo (`matched_exercise_id`)

O catálogo oficial completo está no fim deste prompt, uma linha por exercício no formato `[id] nome`.
Para cada exercício que você extrair do documento, encontre o item equivalente e devolva o `id` dele.

- **Traduza o nome popular do aparelho para o nome do movimento.** O catálogo nomeia pelo movimento
  executado; a ficha de academia brasileira quase sempre nomeia pelo aparelho. Exemplos reais:
  - "Cadeira extensora" → `[0585] Extensão de pernas na máquina articulada`
  - "Cadeira abdutora" → `[0597] Abdução de quadril sentado na máquina articulada`
  - "Mesa flexora" → o exercício de flexão de pernas deitado na máquina
  - "Voador" / "Peck deck" → o crucifixo na máquina correspondente
- **Aceite abreviações e termos em inglês** correntes na academia: "Pulldown" é a puxada na polia,
  "Leg press" é o leg press, "Stiff" é o levantamento terra romeno.
- **Prefira o item mais específico que o documento sustenta.** Se a ficha diz "Supino máquina",
  escolha o supino na máquina — não o supino com barra nem um supino de outro ângulo. Se a ficha
  diz apenas "Supino", escolha o supino reto padrão.
- **Respeite o equipamento indicado.** "Rosca com halteres" não é a rosca com barra.
- **Devolva `null` quando não houver equivalente plausível.** Um `null` honesto é muito melhor que
  um vínculo forçado: o usuário confirma o item pendente em um toque, mas um exercício errado entra
  no treino sem que ele perceba. Não force correspondência por semelhança superficial de palavras
  (ex: "Remada máquina" NÃO é "Remada alta na máquina articulada" — remada alta é exercício de ombro).
- Use **apenas** IDs que aparecem literalmente no catálogo abaixo. Não invente IDs.

Responda APENAS em formato JSON válido obedecendo ao seguinte schema:
{
  "workout_name": "string",
  "days": [
    {
      "day": "segunda|terça|quarta|quinta|sexta|sabado|domingo",
      "exercises": [
        {
          "original_name": "string",
          "matched_exercise_id": "0025 ou null",
          "series": "4x10 ou null",
          "observacao": "string ou null"
        }
      ]
    }
  ]
}
"""


def build_system_prompt(lang: str = "pt") -> str:
    """System prompt with the full catalog appended for grounding (spec 0008 §5.2).

    The catalog is the bulk of the prompt (~15k tokens) and never varies between
    requests, so it goes last as one stable block — the shape prompt caches reward.
    """
    catalog = get_catalog().get_catalog_prompt_context(lang)
    return (
        f"{SYSTEM_PROMPT}\n"
        "\n=== CATÁLOGO OFICIAL DE EXERCÍCIOS ===\n"
        "Use exclusivamente estes IDs em `matched_exercise_id`.\n\n"
        f"{catalog}\n"
    )


class UnreadableFileError(ValueError):
    """A file whose own parser failed and whose bytes must not reach the LLM.

    Carries the file kind so the caller can say "não consegui ler esta planilha"
    instead of blaming the user's document for a service-side failure.
    """

    def __init__(self, kind: str, detail: str):
        self.kind = kind
        self.detail = detail
        super().__init__(detail)


# Leading bytes of formats that are never text. A parser failure on one of these
# used to fall through to the plain-text branch, which handed the LLM the raw ZIP
# of an .xlsx — the defect this spec exists to close (spec 0009 §1.1).
BINARY_SIGNATURES: list[tuple[bytes, str]] = [
    (b"PK\x03\x04", "planilha ou documento compactado"),
    (b"%PDF", "PDF"),
    (b"\xff\xd8\xff", "imagem JPEG"),
    (b"\x89PNG", "imagem PNG"),
    (b"GIF8", "imagem GIF"),
    (b"RIFF", "arquivo RIFF (WEBP/WAV)"),
    (b"\xd0\xcf\x11\xe0", "documento Office antigo"),
]

MAX_IMAGE_EDGE = 1500
PDF_TEXT_CHARS_PER_PAGE_FLOOR = 100


def looks_binary(data: bytes) -> str | None:
    """Returns a human label when the bytes are certainly not text, else None."""
    head = data[:16]
    for signature, label in BINARY_SIGNATURES:
        if head.startswith(signature):
            return label
    # Null bytes in the first block: no text encoding this service accepts produces them.
    if b"\x00" in data[:4096]:
        return "arquivo binário"
    return None


def _image_content(image_bytes: bytes, mime: str, prompt: str) -> list[dict[str, Any]]:
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
    ]


def prepare_image(file_bytes: bytes, ext: str, content_type: str) -> list[dict[str, Any]]:
    """HEIC becomes JPEG, oversized photos are scaled down, everything else passes through.

    A 3 MB phone photo inflates to 4 MB of base64 on the wire; capping the long edge
    at 1500px keeps handwriting on a gym sheet legible while cutting that cost.
    """
    mime = content_type if content_type.startswith("image/") else "image/jpeg"
    if ext == ".png":
        mime = "image/png"
    elif ext == ".webp":
        mime = "image/webp"
    elif ext in (".heic", ".heif"):
        mime = "image/heic"

    try:
        if mime == "image/heic":
            # No model reads HEIC, and it is the iPhone default. Convert or nothing works.
            from pillow_heif import register_heif_opener

            register_heif_opener()

        img = Image.open(io.BytesIO(file_bytes))
        img.load()

        needs_convert = mime == "image/heic"
        needs_resize = max(img.size) > MAX_IMAGE_EDGE

        if not needs_convert and not needs_resize:
            return _image_content(file_bytes, mime, "Extraia os exercícios desta imagem de treino:")

        if needs_resize:
            img.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE), Image.LANCZOS)

        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=88)
        logger.info(
            f"Image prepared: {len(file_bytes)} B -> {buf.tell()} B "
            f"(convert={needs_convert}, resize={needs_resize})"
        )
        return _image_content(buf.getvalue(), "image/jpeg", "Extraia os exercícios desta imagem de treino:")
    except Exception as exc:
        raise UnreadableFileError("imagem", f"Falha ao preparar a imagem: {exc}") from exc


def prepare_pdf(file_bytes: bytes) -> list[dict[str, Any]]:
    """Digital PDF goes as text; scanned PDF is rasterised and goes as images.

    Sending the PDF itself as a base64 `image_url` (what this used to do alongside
    the text) is not a documented OpenRouter input shape — dropped in favour of the
    branch that matches what the file actually is.
    """
    pages_text: list[str] = []
    try:
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        page_count = len(reader.pages)
        for page_num, page in enumerate(reader.pages, start=1):
            txt = (page.extract_text() or "").strip()
            if txt:
                pages_text.append(f"--- Página {page_num} ---\n{txt}")
    except Exception as exc:
        raise UnreadableFileError("PDF", f"Falha ao abrir o PDF: {exc}") from exc

    if page_count == 0:
        raise UnreadableFileError("PDF", "O PDF não contém páginas.")

    total_chars = sum(len(t) for t in pages_text)
    if total_chars / page_count >= PDF_TEXT_CHARS_PER_PAGE_FLOOR:
        body = "\n\n".join(pages_text)
        logger.info(f"PDF treated as digital: {total_chars} chars over {page_count} page(s).")
        return [{
            "type": "text",
            "text": f"Extraia a rotina de treino deste PDF:\n\n{body}",
        }]

    # Sparse text means a scan: hand the pages to the vision path instead.
    logger.info(
        f"PDF treated as scanned ({total_chars} chars over {page_count} page(s)); rasterising."
    )
    try:
        import pymupdf
    except ImportError as exc:
        raise UnreadableFileError(
            "PDF",
            "Este PDF parece ser digitalizado e o suporte a rasterização não está instalado "
            "(PyMuPDF). Envie a ficha como foto.",
        ) from exc

    try:
        items: list[dict[str, Any]] = [{
            "type": "text",
            "text": "Este PDF é digitalizado. Extraia os exercícios das páginas a seguir:",
        }]
        with pymupdf.open(stream=file_bytes, filetype="pdf") as doc:
            for page in doc:
                pix = page.get_pixmap(dpi=150)
                png = pix.tobytes("png")
                items.extend(_image_content(png, "image/png", f"Página {page.number + 1}:")[1:])
        return items
    except UnreadableFileError:
        raise
    except Exception as exc:
        raise UnreadableFileError("PDF", f"Falha ao rasterizar o PDF: {exc}") from exc


def prepare_spreadsheet(file_bytes: bytes, ext: str) -> list[dict[str, Any]]:
    """Serialises the grid faithfully, not prettily.

    `header=None` keeps every row as data: a gym sheet's first row is a title, not a
    header, and the model reads the raw grid — padding and all — without trouble.
    No `to_markdown` here: it needs `tabulate`, whose absence is what silently broke
    this whole path (spec 0009 §1.1).
    """
    try:
        blocks: list[str] = []
        if ext == ".csv":
            df = pd.read_csv(io.BytesIO(file_bytes), header=None, dtype=str, keep_default_na=False)
            blocks.append(df.to_csv(index=False, header=False).strip())
        else:
            xls = pd.ExcelFile(io.BytesIO(file_bytes))
            for sheet_name in xls.sheet_names:
                df = pd.read_excel(xls, sheet_name=sheet_name, header=None, dtype=str)
                df = df.dropna(how="all").fillna("")
                if df.empty:
                    continue
                blocks.append(f"### Aba: {sheet_name}\n" + df.to_csv(index=False, header=False).strip())

        combined = "\n\n".join(b for b in blocks if b.strip())
        if not combined.strip():
            raise UnreadableFileError("planilha", "A planilha está vazia.")

        logger.info(f"Spreadsheet serialised: {len(combined)} chars over {len(blocks)} sheet(s).")
        return [{
            "type": "text",
            "text": f"Extraia a rotina de treino desta planilha:\n\n{combined}",
        }]
    except UnreadableFileError:
        raise
    except Exception as exc:
        raise UnreadableFileError("planilha", f"Falha ao ler a planilha: {exc}") from exc


def prepare_text(file_bytes: bytes) -> list[dict[str, Any]]:
    raw_text = file_bytes.decode("utf-8", errors="replace").strip()
    if not raw_text:
        raise UnreadableFileError("arquivo de texto", "O arquivo de texto está vazio.")
    return [{
        "type": "text",
        "text": f"Extraia a rotina de treino a partir do seguinte texto:\n\n{raw_text}",
    }]


async def prepare_content(
    file_bytes: bytes, filename: str, content_type: str
) -> tuple[list[dict[str, Any]], str, str | None]:
    """Dispatches to the preparer for this file's type (spec 0009 §5.1).

    Returns the content items, the kind that handled them, and a degraded_reason that
    is set only when a specific preparer failed and the bytes were plausibly text.
    """
    ext = Path(filename).suffix.lower()
    content_type = (content_type or "").lower()

    if ext in (".png", ".jpg", ".jpeg", ".webp", ".heic", ".heif") or content_type.startswith("image/"):
        kind = "image"
    elif ext == ".pdf" or content_type == "application/pdf":
        kind = "pdf"
    elif ext in (".xlsx", ".xls", ".csv"):
        kind = "spreadsheet"
    elif ext == ".txt" or content_type.startswith("text/"):
        kind = "text"
    else:
        kind = "unknown"

    try:
        if kind == "image":
            return prepare_image(file_bytes, ext, content_type), kind, None
        if kind == "pdf":
            return prepare_pdf(file_bytes), kind, None
        if kind == "spreadsheet":
            return prepare_spreadsheet(file_bytes, ext), kind, None
        if kind == "text":
            return prepare_text(file_bytes), kind, None
    except UnreadableFileError:
        # A recognised type whose own parser failed. Degrading to text is only safe
        # if the bytes are text; for a real binary it would resend the ZIP garbage.
        binary_label = looks_binary(file_bytes)
        if binary_label is not None:
            raise
        logger.warning(f"{kind} preparer failed on text-like content; degrading to plain text.")
        reason = f"O arquivo foi lido como texto simples porque o leitor de {kind} falhou."
        return prepare_text(file_bytes), "text", reason

    # Unknown extension: accept it only if it really looks like text.
    binary_label = looks_binary(file_bytes)
    if binary_label is not None:
        raise UnreadableFileError(
            binary_label,
            f"Formato não suportado: o arquivo é {binary_label} e não pôde ser interpretado.",
        )

    reason = "O arquivo não tem um formato reconhecido e foi lido como texto simples."
    return prepare_text(file_bytes), "text", reason


def parse_llm_json(raw_response: str) -> RawExtractedWorkout:
    """Cleans code blocks and parses JSON into RawExtractedWorkout."""
    cleaned = raw_response.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    data = json.loads(cleaned)
    return RawExtractedWorkout.model_validate(data)


async def call_openrouter(
    messages: list[dict[str, Any]],
    model: str | None = None,
    models: list[str] | None = None,
) -> str:
    """Calls OpenRouter chat completions API."""
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY is not set.")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": SITE_URL,
        "X-Title": APP_TITLE,
        "Content-Type": "application/json",
    }

    payload: dict[str, Any] = {
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        # A full weekly sheet (7 days, ~40 exercises with notes) lands near 4k tokens
        # of JSON. Without a ceiling, a provider's low default truncates the object,
        # json.loads fails, and the model fallback gets spent on what is not an
        # availability problem at all (spec 0009 §1.4).
        "max_tokens": 8000,
    }

    if models:
        payload["models"] = models
    elif model:
        payload["model"] = model
    else:
        payload["model"] = PRIMARY_MODEL

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def extract_workout_from_file(
    file_bytes: bytes, filename: str, content_type: str, lang: str = "pt"
) -> tuple[RawExtractedWorkout, str | None]:
    """Orchestrates LLM extraction with OpenRouter dual-layer fallback.

    Returns the extraction and the degraded_reason from the preparer, so the caller
    can tell the user their file was read in a lesser way (spec 0009 §6).
    """
    content_items, file_type, degraded_reason = await prepare_content(
        file_bytes, filename, content_type
    )
    logger.info(f"Prepared '{filename}' as {file_type}" + (" (degraded)" if degraded_reason else ""))

    messages = [
        {"role": "system", "content": build_system_prompt(lang)},
        {"role": "user", "content": content_items},
    ]

    # 1. First attempt: Use OpenRouter gateway fallback models: [PRIMARY, FALLBACK]
    try:
        logger.info(f"Attempting extraction with models: [{PRIMARY_MODEL}, {FALLBACK_MODEL}]")
        raw_text = await call_openrouter(messages, models=[PRIMARY_MODEL, FALLBACK_MODEL])
        return parse_llm_json(raw_text), degraded_reason
    except Exception as exc:
        logger.warning(
            f"Primary extraction attempt failed ({type(exc).__name__}: {exc}). "
            f"Retrying explicitly with fallback model '{FALLBACK_MODEL}'..."
        )

    # 2. Second attempt: Client-side retry explicitly on FALLBACK_MODEL
    try:
        raw_text = await call_openrouter(messages, model=FALLBACK_MODEL)
        return parse_llm_json(raw_text), degraded_reason
    except Exception as exc2:
        logger.error(f"Fallback extraction attempt failed too ({type(exc2).__name__}: {exc2})")
        raise RuntimeError(f"OpenRouter extraction failed after fallback: {exc2}") from exc2
