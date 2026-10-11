export const MENSAGEM_LIMITE_DIARIO = "Você atingiu o limite de 2 gerações por dia. Tente novamente amanhã, após 00h (horário de Brasília).";

// O contador acompanha o mesmo dia de Brasília usado pelo banco.
export function proximoReinicioDiario(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", hourCycle: "h23",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(agora);
  const valor = (tipo: string) => Number(partes.find(parte => parte.type === tipo)?.value);
  const decorrido = ((valor("hour") * 60 + valor("minute")) * 60 + valor("second")) * 1000 + agora.getUTCMilliseconds();
  return agora.getTime() + 86_400_000 - decorrido;
}

export function formatarTempoLimite(reiniciaEm: number, agora = Date.now()) {
  const minutos = Math.ceil(Math.max(0, reiniciaEm - agora) / 60_000);
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}
