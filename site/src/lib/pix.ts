/**
 * Pix "copia e cola" estático (padrão BR Code do Banco Central, EMV), sem valor fixo:
 * a pessoa escolhe quanto doar no app do banco.
 */
const campo = (id: string, valor: string) =>
  `${id}${String(valor.length).padStart(2, "0")}${valor}`;

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no campo 63. */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (const b of new TextEncoder().encode(s)) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const semAcento = (s: string, max: number) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .slice(0, max)
    .trim();

export function codigoPix(o: {
  chave: string;
  nome: string;
  cidade: string;
  mensagem?: string;
}): string {
  const conta =
    campo("00", "br.gov.bcb.pix") +
    campo("01", o.chave.trim()) +
    (o.mensagem ? campo("02", o.mensagem.slice(0, 40)) : "");
  const corpo =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("58", "BR") +
    campo("59", semAcento(o.nome, 25)) +
    campo("60", semAcento(o.cidade, 15)) +
    campo("62", campo("05", "***")) +
    "6304";
  return corpo + crc16(corpo);
}
