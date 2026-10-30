/** Textos fixos sobre emendas (sem IA), no tom do site. */
import type { EmendasDoParlamentar } from "../../../pipeline/src/emendas/rotina.js";
import { formatarMoedaCurta, formatarNumero, plural } from "./formato.js";

type V = EmendasDoParlamentar["total"];
/** Pago até agora: pago no ano + restos a pagar pagos depois, nunca acima do reservado. */
export const pagoTotal = (v: V) => Math.min(v.pago + v.restosPagos, v.empenhado);
export const pctPago = (v: V) =>
  v.empenhado > 0 ? Math.round((pagoTotal(v) / v.empenhado) * 100) : 0;
export const AREA_PIX = "Encargos especiais";
export const area = (a: string) => (a === AREA_PIX ? "Livre (emenda Pix)" : a);

export function frasesEmendas(e: EmendasDoParlamentar | null, anoInicial: number) {
  if (!e || e.emendas === 0) return null;
  const destinos = e.destinos
    .slice(0, 3)
    .map(
      (d) =>
        `${d.nome}${d.nivel === "municipio" && d.uf ? ` (${d.uf})` : ""}, ${formatarMoedaCurta(d.valores.empenhado)}`,
    );
  const detalhes = [`Para onde mais foi: ${destinos.join("; ")}.`];
  if (e.pix.emendas > 0)
    detalhes.push(
      `${formatarNumero(e.pix.emendas)} ${plural(e.pix.emendas, "foi emenda Pix", "foram emendas Pix")}, somando ${formatarMoedaCurta(e.pix.valores.empenhado)}.`,
    );
  const principais = e.porArea
    .filter((a) => a.area !== AREA_PIX)
    .slice(0, 2)
    .map((a) => a.area.toLowerCase());
  if (principais.length) detalhes.push(`Áreas que mais receberam: ${principais.join(" e ")}.`);
  return {
    destaque: {
      valor: formatarMoedaCurta(e.total.empenhado),
      rotulo: `indicados em emendas desde ${anoInicial}`,
    },
    principal: `Indicou ${formatarNumero(e.emendas)} ${plural(e.emendas, "emenda", "emendas")} ao orçamento desde ${anoInicial}. Desse dinheiro, ${formatarMoedaCurta(pagoTotal(e.total))} (${pctPago(e.total)}%) já foi pago.`,
    detalhes,
  };
}

export const TIPO_FAVORECIDO: Record<string, string> = {
  prefeitura: "Prefeitura e fundos municipais",
  estado: "Governo do estado e órgãos estaduais",
  entidade: "Entidades (associações, fundações, cooperativas)",
  empresa: "Empresas",
  orgao_publico: "Órgãos e empresas públicas federais",
  outro: "Outros",
};
export const TIPO_EMENDA: Record<string, string> = {
  individual: "Individual",
  bancada: "Bancada do estado",
  comissao: "Comissão",
  relator: "Relator",
  outra: "Outra",
};
export { idCidade } from "../../../pipeline/src/emendas/cidades.js";
