"""Diagnóstico do cartão corporativo (CPGF) da Presidência.

Lê o CSV mensal do Portal da Transparência e imprime só agregados
(nunca CPF ou nome de portador). Uso: python3 cpgf_amostra.py arquivo.csv
"""
import csv
import sys
from collections import defaultdict


def valor(txt):
    txt = (txt or "0").strip().replace(".", "").replace(",", ".")
    try:
        return float(txt)
    except ValueError:
        return 0.0


def col(cab, *partes):
    for c in cab:
        if all(p in c.upper() for p in partes):
            return c
    return None


def main(caminho):
    with open(caminho, encoding="latin-1", newline="") as f:
        linhas = list(csv.DictReader(f, delimiter=";"))
    cab = list(linhas[0].keys()) if linhas else []
    print("COLUNAS:", " | ".join(cab))
    print("TOTAL DE LINHAS:", len(linhas))

    c_sup = col(cab, "NOME", "SUPERIOR")
    c_org = col(cab, "NOME", "ÓRGÃO") if col(cab, "NOME", "ÓRGÃO") != c_sup else None
    c_org = next((c for c in cab if "NOME" in c.upper() and "RG" in c.upper() and "SUPERIOR" not in c.upper()), None)
    c_ug_cod = col(cab, "CÓDIGO", "UNIDADE")
    c_ug = col(cab, "NOME", "UNIDADE")
    c_val = col(cab, "VALOR")
    c_fav = col(cab, "NOME", "FAVORECIDO")
    c_tra = col(cab, "TRANSA")

    def eh_pr(l):
        return "PRESID" in (l.get(c_sup) or "").upper() or "PRESID" in (l.get(c_org) or "").upper()

    pr = [l for l in linhas if eh_pr(l)]
    print(f"\nLINHAS DA PRESIDÊNCIA: {len(pr)}  TOTAL R$ {sum(valor(l[c_val]) for l in pr):,.2f}")

    por_ug = defaultdict(lambda: [0, 0.0, 0.0])
    for l in pr:
        k = f"{l.get(c_ug_cod)} | {l.get(c_org)} | {l.get(c_ug)}"
        v = valor(l[c_val])
        sig = "SIGIL" in ((l.get(c_fav) or "") + (l.get(c_tra) or "")).upper()
        por_ug[k][0] += 1
        por_ug[k][1] += v
        por_ug[k][2] += v if sig else 0
    print("\nPOR UNIDADE GESTORA (cód | órgão | unidade -> linhas, total, % sigiloso):")
    for k, (n, t, s) in sorted(por_ug.items(), key=lambda x: -x[1][1]):
        print(f"  {k} -> {n}, R$ {t:,.2f}, {100 * s / t if t else 0:.0f}%")

    print("\nTIPOS DE TRANSAÇÃO (Presidência):")
    tipos = defaultdict(float)
    for l in pr:
        tipos[l.get(c_tra)] += valor(l[c_val])
    for k, v in sorted(tipos.items(), key=lambda x: -x[1]):
        print(f"  {k}: R$ {v:,.2f}")

    print("\nTOP 10 FAVORECIDOS (Presidência, só empresas/'sigiloso'):")
    fav = defaultdict(float)
    for l in pr:
        fav[l.get(c_fav)] += valor(l[c_val])
    for k, v in sorted(fav.items(), key=lambda x: -x[1])[:10]:
        print(f"  {k}: R$ {v:,.2f}")


if __name__ == "__main__":
    main(sys.argv[1])
