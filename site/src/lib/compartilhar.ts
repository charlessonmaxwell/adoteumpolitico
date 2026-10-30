/** Mensagens de WhatsApp: sempre os mesmos fatos para todos (neutralidade), em linguagem do povo. */
import type { ResumoParlamentar } from "../../../pipeline/src/rotina/agregacao.js";
import { taxaPresenca } from "../../../pipeline/src/rotina/panorama.js";
import { formatarMoedaCurta } from "./formato.js";

export function mensagemPerfil(r: ResumoParlamentar, emendas: number | null, desde = 2023): string {
  const p = r.parlamentar;
  const fatos: string[] = [];
  const t = taxaPresenca(r);
  if (t !== null)
    fatos.push(
      p.casa === "camara"
        ? `foi a ${Math.round(t * 100)}% das sessões`
        : `participou de ${Math.round(t * 100)}% das votações`,
    );
  if (r.gastos.total > 0) fatos.push(`gastou ${formatarMoedaCurta(r.gastos.total)} da cota`);
  if (emendas && emendas > 0) fatos.push(`indicou ${formatarMoedaCurta(emendas)} em emendas`);
  const lista =
    fatos.length > 1 ? `${fatos.slice(0, -1).join(", ")} e ${fatos.at(-1)}` : (fatos[0] ?? "");
  return lista
    ? `${p.nome} (${p.partido}-${p.uf}) ${lista} desde ${desde}. Confira e fiscalize:`
    : `Veja o que ${p.nome} (${p.partido}-${p.uf}) fez no mandato e fiscalize:`;
}
