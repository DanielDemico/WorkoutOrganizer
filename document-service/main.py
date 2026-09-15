import logging
import os
from contextlib import asynccontextmanager
from typing import Literal
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from catalog import get_catalog
from extractor import (
    UnreadableFileError,
    extract_workout_from_file,
    normalize_day,
    sanitize_series,
)

AI_MARK = "\U0001f916"  # 🤖


def build_provenance(original_name: str, matched_name: str | None, note: str | None) -> str:
    """Wraps the AI's reading of one line of the sheet in 🤖 … 🤖 (spec 0008 §5.3).

    Applied here rather than asked of the model: the frame has to reflect whichever
    stage actually resolved the link, and a model that forgets it would leave the
    user unable to tell an AI guess from something they typed themselves.
    """
    if matched_name:
        body = f'Ficha: "{original_name}" ➜ Catálogo: "{matched_name}"'
    else:
        body = f'Ficha: "{original_name}" ➜ Não identificado no catálogo'

    if note and note.strip():
        body += f" | {note.strip()}"

    return f"{AI_MARK} {body} {AI_MARK}"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("document-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up exercise catalog on startup
    logger.info("Pre-loading exercise catalog...")
    cat = get_catalog()
    logger.info(f"Exercise catalog ready with {len(cat.exercises)} exercises.")
    yield


app = FastAPI(
    title="WorkoutOrganizer Document Service",
    description="Microservice for extracting workout routines from documents via LLM and matching them against the exercise catalog.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SuggestedExerciseModel(BaseModel):
    id: str
    name: str


class ParsedItemModel(BaseModel):
    dia: str
    exercise_id: str | None
    matched_name: str | None
    original_name: str
    confidence: float
    series: str | None
    observacao: str | None
    suggested_exercises: list[SuggestedExerciseModel] = []


class ParseResponse(BaseModel):
    workout_name: str
    items: list[ParsedItemModel]
    # Set only when a type-specific preparer failed and the file was read as plain
    # text instead. Optional, so existing clients stay valid (spec 0009 §6).
    degraded_reason: str | None = None


ALLOWED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".webp", ".heic",
    ".pdf", ".xlsx", ".xls", ".csv", ".txt"
}


@app.get("/health")
def health_check():
    catalog = get_catalog()
    return {
        "status": "ok",
        "service": "document-service",
        "catalog_size": len(catalog.exercises),
    }


@app.post("/parse", response_model=ParseResponse)
async def parse_document(
    file: UploadFile = File(...),
    lang: Literal["pt", "en"] = Form("pt"),
):
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo não fornecido ou nome de arquivo inválido.",
        )

    _, ext = os.path.splitext(file.filename.lower())
    if ext not in ALLOWED_EXTENSIONS and not (file.content_type and file.content_type.startswith("image/")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensão '{ext}' não suportada. Use: {', '.join(sorted(ALLOWED_EXTENSIONS))}.",
        )

    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O arquivo enviado está vazio.",
            )

        # Max file limit check: 15 MB
        if len(content) > 15 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Arquivo excede o tamanho máximo de 15 MB.",
            )

        extracted, degraded_reason = await extract_workout_from_file(
            file_bytes=content,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
            lang=lang,
        )
    except HTTPException:
        raise
    except UnreadableFileError as unreadable:
        # The file's own reader failed. Say which reader, rather than telling the user
        # their document has no workout in it — that 422 blamed the document for a
        # service-side defect (spec 0009 §6).
        logger.warning(f"Unreadable {unreadable.kind}: {unreadable.detail}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Não foi possível ler este arquivo ({unreadable.kind}). {unreadable.detail}",
        )
    except ValueError as val_err:
        logger.warning(f"Validation error during extraction: {val_err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except RuntimeError as run_err:
        logger.error(f"OpenRouter LLM gateway error: {run_err}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Falha de comunicação com o serviço de inteligência artificial (OpenRouter).",
        )
    except Exception as exc:
        logger.error(f"Unexpected error parsing document: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Não foi possível identificar uma rotina de treino legível neste arquivo.",
        )

    if not extracted.days or all(len(d.exercises) == 0 for d in extracted.days):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Nenhum exercício foi identificado no documento.",
        )

    catalog = get_catalog()
    items: list[ParsedItemModel] = []

    grounded_count = 0

    for day_group in extracted.days:
        canonical_day = normalize_day(day_group.day)
        for ex in day_group.exercises:
            clean_series, clean_obs = sanitize_series(ex.series, ex.observacao)

            # Authority chain, most trustworthy first (spec 0008 §5.1).
            exercise_id: str | None = None
            matched_name: str | None = None
            confidence = 0.0
            suggested: list[SuggestedExerciseModel] = []

            # Stage 1 — the sheet used the catalog's own wording.
            exact = catalog.find_exact(ex.original_name)
            if exact is not None:
                exercise_id = exact.id
                matched_name = catalog.display_name(exact, lang)
                confidence = 1.0
            else:
                # Stage 2 — the LLM picked an id from the injected catalog. Verified
                # here, never trusted: an invented id falls through to suggestions.
                grounded = catalog.get_by_id(ex.matched_exercise_id)
                if grounded is not None:
                    exercise_id = grounded.id
                    matched_name = catalog.display_name(grounded, lang)
                    confidence = 0.95
                    grounded_count += 1
                elif ex.matched_exercise_id:
                    logger.warning(
                        f"LLM returned unknown exercise id '{ex.matched_exercise_id}' "
                        f"for '{ex.original_name}'; falling back to suggestions."
                    )

                # Stage 3 — fuzzy only proposes; it never binds.
                if exercise_id is None:
                    confidence, raw_suggestions = catalog.suggest(ex.original_name, lang=lang)
                    suggested = [
                        SuggestedExerciseModel(id=s["id"], name=s["name"])
                        for s in raw_suggestions
                    ]

            items.append(
                ParsedItemModel(
                    dia=canonical_day,
                    exercise_id=exercise_id,
                    matched_name=matched_name,
                    original_name=ex.original_name,
                    confidence=confidence,
                    series=clean_series,
                    observacao=build_provenance(ex.original_name, matched_name, clean_obs),
                    suggested_exercises=suggested,
                )
            )

    resolved = sum(1 for i in items if i.exercise_id)
    logger.info(
        f"Parsed {len(items)} items: {resolved} resolved "
        f"({grounded_count} grounded by LLM), {len(items) - resolved} pending review."
    )

    return ParseResponse(
        workout_name=extracted.workout_name or "Treino Importado",
        items=items,
        degraded_reason=degraded_reason,
    )


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    port = int(os.getenv("PORT", 5200))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=False)
