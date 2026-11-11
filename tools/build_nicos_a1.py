#!/usr/bin/env python3
"""Rebuild data/nicos.js from tools/nicos_a1_vocab.json."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOCAB = Path(__file__).resolve().parent / "nicos_a1_vocab.json"
OUT = ROOT / "data" / "nicos.js"
BN = "০১২৩৪৫৬৭৮৯"


def bn(n: int | str) -> str:
    return "".join(BN[int(d)] if d.isdigit() else d for d in str(n))


def aid(*parts: str) -> str:
    return hashlib.md5(("nicos-a1|" + "|".join(parts)).encode()).hexdigest()[:12]


def esc(s: str) -> str:
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def gender_class(g: str | None) -> str:
    return {"m": "m", "f": "f", "n": "n", "pl": "pl"}.get(g or "", "")


def word_html(de: str, g: str | None) -> str:
    cls = gender_class(g)
    return f'<span class="{cls}">{esc(de)}</span>' if cls else esc(de)


def data_t(de: str) -> str:
    return de.split(",")[0].strip()


def build() -> None:
    raw = json.loads(VOCAB.read_text(encoding="utf-8"))
    chapters = []
    for unit, unit_de, unit_bn, folge, title_de, title_bn, words in raw:
        cid = f"l{folge:02d}"
        if folge == 77:
            num = "চূড়ান্ত পরীক্ষা"
        elif unit == 0:
            num = f"স্বাগতম · লেসন {bn(folge)}"
        else:
            num = f"ইউনিট {bn(unit)} · লেসন {bn(folge)}"

        voc_rows, ex_rows = [], []
        for w in words:
            de, pr, bn_m = w["de"], w["pr"], w["bn"]
            ex, ex_pr, ex_bn, g = w["ex"], w["ex_pr"], w["ex_bn"], w.get("g")
            t = data_t(de)
            wid = aid("w", str(folge), t)
            eid = aid("e", str(folge), ex)
            voc_rows.append(
                f'<tr><td class="de say" data-a="{wid}" data-label="Deutsch" data-t="{esc(t)}">{word_html(de, g)}</td>'
                f'<td class="pr" data-label="উচ্চারণ">{esc(pr)}</td>'
                f'<td class="bn" data-label="অর্থ">{esc(bn_m)}</td></tr>'
            )
            ex_rows.append(
                f'<tr><td class="de say" data-a="{eid}" data-label="উদাহরণ" data-t="{esc(ex)}">{esc(ex)}</td>'
                f'<td class="pr" data-label="উচ্চারণ">{esc(ex_pr)}</td>'
                f'<td class="bn" data-label="অর্থ">{esc(ex_bn)}</td></tr>'
            )

        sec_v, sec_e = f"l{folge:02d}-v", f"l{folge:02d}-e"
        html = (
            f'<h1 class="chapter" id="{cid}"><span class="num">{esc(num)}</span>{esc(title_bn)}'
            f'<span class="de say" data-a="{aid("title", str(folge), title_de)}" data-t="{esc(title_de)}">{esc(title_de)}</span></h1>'
            f'<p class="lead">Nicos Weg A1 · {esc(unit_de)} ({esc(unit_bn)}). মূল শব্দগুলো ফ্ল্যাশকার্ডে ও উদাহরণ বাক্য শুনে অনুশীলন করুন। '
            f'<a href="https://learngerman.dw.com/en/nicos-weg/c-36519789" target="_blank" rel="noopener">DW-তে পাঠ</a></p>'
            f'<h2 id="{sec_v}">শব্দভান্ডার <span class="de">Wortschatz</span></h2>'
            f'<table class="voc"><thead><tr><th>Deutsch</th><th>উচ্চারণ</th><th>অর্থ</th></tr></thead><tbody>'
            + "".join(voc_rows)
            + "</tbody></table>"
            f'<h2 id="{sec_e}">উদাহরণ বাক্য <span class="de">Beispiele</span></h2>'
            f'<p class="small">এই বাক্যগুলো শুনে বোঝার অনুশীলনেও আসে। DW-এর পাঠ্য নকল নয় — মূল বাক্য।</p>'
            f'<table class="cards"><thead><tr><th>Deutsch</th><th>উচ্চারণ</th><th>অর্থ</th></tr></thead><tbody>'
            + "".join(ex_rows)
            + "</tbody></table>"
        )
        chapters.append(
            {
                "id": cid,
                "num": num,
                "title": title_de,
                "de": title_bn + " · " + unit_bn,
                "unit": unit,
                "unitDe": unit_de,
                "unitBn": unit_bn,
                "folge": folge,
                "sections": [
                    {"id": sec_v, "title": "শব্দভান্ডার"},
                    {"id": sec_e, "title": "উদাহরণ বাক্য"},
                ],
                "html": html,
            }
        )

    level = {"id": "nicos", "title": "Nicos", "name": "Nicos Weg A1", "chapters": chapters}
    OUT.write_text(
        "window.LEVELS_DATA=window.LEVELS_DATA||{};window.LEVELS_DATA.nicos="
        + json.dumps(level, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes, {len(chapters)} lessons)")


if __name__ == "__main__":
    build()
