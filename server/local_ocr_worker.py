import base64
import contextlib
import io
import json
import math
import sys
import traceback

import cv2
import numpy as np
from rapidocr import RapidOCR


_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        with contextlib.redirect_stdout(sys.stderr):
            _engine = RapidOCR()
    return _engine


def _decode_image(data_url):
    if not isinstance(data_url, str) or not data_url.startswith("data:image/"):
        raise ValueError("OCR 输入必须是图片 Data URL。")
    encoded = data_url.split(",", 1)[1]
    image_bytes = base64.b64decode(encoded, validate=True)
    image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("无法解码 OCR 页面图片。")
    return image


def _as_score(value):
    score = float(value)
    return score if math.isfinite(score) else 0.0


def _recognize(data_url):
    image = _decode_image(data_url)
    height, width = image.shape[:2]
    with contextlib.redirect_stdout(sys.stderr):
        result = _get_engine()(image, use_det=True, use_cls=True, use_rec=True)

    boxes = result.boxes if result.boxes is not None else []
    texts = result.txts if result.txts is not None else []
    scores = result.scores if result.scores is not None else []
    lines = []
    for index, text in enumerate(texts):
        if index >= len(boxes) or not str(text).strip():
            continue
        polygon = [[round(float(point[0]), 3), round(float(point[1]), 3)] for point in boxes[index]]
        if len(polygon) != 4:
            continue
        lines.append({
            "text": str(text).strip(),
            "score": round(_as_score(scores[index]) if index < len(scores) else 0.0, 6),
            "polygon": polygon,
        })

    return {"width": int(width), "height": int(height), "lines": lines}


def _respond(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def main():
    for raw_line in sys.stdin:
        request_id = None
        try:
            request = json.loads(raw_line)
            request_id = request.get("id")
            if request.get("action") == "warm":
                _get_engine()
                result = {"ready": True}
            else:
                result = _recognize(request.get("imageDataUrl"))
            _respond({"id": request_id, "ok": True, "result": result})
        except Exception as error:
            traceback.print_exc(file=sys.stderr)
            _respond({"id": request_id, "ok": False, "error": str(error)[:500]})


if __name__ == "__main__":
    main()
